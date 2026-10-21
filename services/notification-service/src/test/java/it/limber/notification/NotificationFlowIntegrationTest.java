package it.limber.notification;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import io.micrometer.core.instrument.MeterRegistry;
import it.limber.notification.notification.Notification;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Dal topic Kafka al client: PostgreSQL e Kafka reali, server HTTP vero e token firmati come li firma order-service.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class NotificationFlowIntegrationTest {

	private static final String ORDER_CREATED = "orders.order-created.v1";

	private static final String STOCK_LOW = "inventory.stock-low.v1";

	private static final String SECRET = "test-only-secret-0123456789abcdef-0123456789";

	@Value("${local.server.port}")
	private int port;

	@Autowired
	private KafkaTemplate<String, String> kafka;

	@Autowired
	private ConsumerFactory<String, String> consumerFactory;

	@Autowired
	private MeterRegistry metrics;

	private WebTestClient client() {
		return WebTestClient.bindToServer()
			.baseUrl("http://localhost:" + port)
			.responseTimeout(Duration.ofSeconds(30))
			.build();
	}

	private static String token(String use, String secret) {
		Instant now = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer("gestione-ordini")
			.subject("tester")
			.issuedAt(now)
			.expiresAt(now.plusSeconds(300))
			.claim("token_use", use)
			.claim("roles", List.of("VIEWER"))
			.build();
		NimbusJwtEncoder encoder = new NimbusJwtEncoder(
				new ImmutableSecret<>(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256")));
		return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
			.getTokenValue();
	}

	private static String access() {
		return token("access", SECRET);
	}

	private static String orderCreated(UUID eventId, String orderId, String number) {
		return """
				{"eventId":"%s","eventType":"OrderCreated","occurredAt":"2026-10-21T10:00:00Z",
				 "data":{"orderId":"%s","number":"%s","customerName":"Rossi Srl","totalGross":24.40,"lineCount":1}}"""
			.formatted(eventId, orderId, number);
	}

	private List<Notification> history() {
		return client().get()
			.uri("/api/v1/notifications?limit=200")
			.headers(h -> h.setBearerAuth(access()))
			.exchange()
			.expectStatus()
			.isOk()
			.expectBodyList(Notification.class)
			.returnResult()
			.getResponseBody();
	}

	private List<Notification> awaitNotifications(String aggregateId, int expected) {
		List<Notification> found = new ArrayList<>();
		await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(300)).untilAsserted(() -> {
			found.clear();
			history().stream().filter(n -> aggregateId.equals(n.aggregateId())).forEach(found::add);
			assertThat(found).hasSize(expected);
		});
		return found;
	}

	@Test
	void un_evento_su_kafka_diventa_una_notifica_in_italiano() {
		String orderId = UUID.randomUUID().toString();
		kafka.send(ORDER_CREATED, orderId, orderCreated(UUID.randomUUID(), orderId, "ORD-2026-000001"));

		Notification n = awaitNotifications(orderId, 1).getFirst();

		assertThat(n.title()).isEqualTo("Nuovo ordine ORD-2026-000001");
		assertThat(n.message()).contains("Rossi Srl").contains("24,40");
		assertThat(n.id()).isPositive();
		assertThat(n.data().get("number").asString()).isEqualTo("ORD-2026-000001");
	}

	@Test
	void lo_stesso_evento_consegnato_due_volte_genera_una_sola_notifica() {
		String orderId = UUID.randomUUID().toString();
		UUID eventId = UUID.randomUUID();
		String message = orderCreated(eventId, orderId, "ORD-DUP");
		kafka.send(ORDER_CREATED, orderId, message);
		kafka.send(ORDER_CREATED, orderId, message);
		// Un secondo evento diverso dopo i duplicati: quando arriva, i primi due sono già stati elaborati
		kafka.send(ORDER_CREATED, orderId, orderCreated(UUID.randomUUID(), orderId, "ORD-DUP-2"));

		List<Notification> found = awaitNotifications(orderId, 2);

		assertThat(found).extracting(Notification::eventId).contains(eventId).doesNotHaveDuplicates();
	}

	@Test
	void un_messaggio_illeggibile_va_nel_dead_letter_e_non_blocca_i_successivi() {
		String poison = "questo non è json " + UUID.randomUUID();
		kafka.send(ORDER_CREATED, "veleno", poison);
		String orderId = UUID.randomUUID().toString();
		kafka.send(ORDER_CREATED, orderId, orderCreated(UUID.randomUUID(), orderId, "ORD-DOPO-VELENO"));

		// Il messaggio valido che segue quello avvelenato viene elaborato comunque
		awaitNotifications(orderId, 1);

		Properties overrides = new Properties();
		overrides.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
		List<String> dead = new ArrayList<>();
		try (Consumer<String, String> consumer = consumerFactory.createConsumer("test-dlt-" + UUID.randomUUID(),
				"test", "", overrides)) {
			consumer.subscribe(List.of(ORDER_CREATED + ".DLT"));
			long deadline = System.nanoTime() + Duration.ofSeconds(20).toNanos();
			while (dead.isEmpty() && System.nanoTime() < deadline) {
				for (ConsumerRecord<String, String> record : consumer.poll(Duration.ofMillis(300))) {
					if (poison.equals(record.value())) {
						dead.add(record.value());
					}
				}
			}
		}
		assertThat(dead).containsExactly(poison);
	}

	@Test
	void la_scorta_bassa_e_un_avviso() {
		String productId = UUID.randomUUID().toString();
		kafka.send(STOCK_LOW, productId, """
				{"eventId":"%s","eventType":"StockLow","occurredAt":"2026-10-21T10:00:00Z",
				 "data":{"productId":"%s","sku":"PEN-01","productName":"Penna blu","available":4,"reorderLevel":5}}"""
			.formatted(UUID.randomUUID(), productId));

		Notification n = awaitNotifications(productId, 1).getFirst();

		assertThat(n.severity().name()).isEqualTo("WARNING");
		assertThat(n.title()).isEqualTo("Scorta bassa: PEN-01");
	}

	@Test
	void lo_stream_sse_consegna_in_diretta_le_nuove_notifiche() throws Exception {
		CompletableFuture<ServerSentEvent<Notification>> first = client().get()
			.uri("/api/v1/notifications/stream")
			.accept(MediaType.TEXT_EVENT_STREAM)
			.headers(h -> h.setBearerAuth(access()))
			.exchange()
			.expectStatus()
			.isOk()
			.returnResult(new ParameterizedTypeReference<ServerSentEvent<Notification>>() {
			})
			.getResponseBody()
			.filter(event -> event.data() != null)
			.next()
			.toFuture();
		await().atMost(Duration.ofSeconds(10)).until(() -> metrics.get("notifications.sse.subscribers").gauge().value() >= 1);

		String orderId = UUID.randomUUID().toString();
		kafka.send(ORDER_CREATED, orderId, orderCreated(UUID.randomUUID(), orderId, "ORD-LIVE"));

		ServerSentEvent<Notification> event = first.get(30, TimeUnit.SECONDS);
		assertThat(event.event()).isEqualTo("OrderCreated");
		assertThat(event.id()).isEqualTo(String.valueOf(event.data().id()));
		assertThat(event.data().title()).isEqualTo("Nuovo ordine ORD-LIVE");
	}

	@Test
	void riconnettendosi_con_last_event_id_si_recuperano_le_notifiche_perse() throws Exception {
		String orderId = UUID.randomUUID().toString();
		kafka.send(ORDER_CREATED, orderId, orderCreated(UUID.randomUUID(), orderId, "ORD-A"));
		long idOfA = awaitNotifications(orderId, 1).getFirst().id();
		// Notifiche arrivate mentre il client era scollegato
		kafka.send(ORDER_CREATED, orderId, orderCreated(UUID.randomUUID(), orderId, "ORD-B"));
		kafka.send(ORDER_CREATED, orderId, orderCreated(UUID.randomUUID(), orderId, "ORD-C"));
		awaitNotifications(orderId, 3);

		List<ServerSentEvent<Notification>> received = client().get()
			.uri("/api/v1/notifications/stream")
			.accept(MediaType.TEXT_EVENT_STREAM)
			.header("Last-Event-ID", String.valueOf(idOfA))
			.headers(h -> h.setBearerAuth(access()))
			.exchange()
			.expectStatus()
			.isOk()
			.returnResult(new ParameterizedTypeReference<ServerSentEvent<Notification>>() {
			})
			.getResponseBody()
			.filter(event -> event.data() != null && orderId.equals(event.data().aggregateId()))
			.take(2)
			.collectList()
			.block(Duration.ofSeconds(30));

		assertThat(received).extracting(event -> event.data().title())
			.containsExactly("Nuovo ordine ORD-B", "Nuovo ordine ORD-C");
	}

	@Test
	void senza_token_valido_non_si_entra() {
		client().get().uri("/api/v1/notifications").exchange().expectStatus().isUnauthorized();
		client().get().uri("/api/v1/notifications/stream").exchange().expectStatus().isUnauthorized();
		// Un token di refresh non vale come accesso
		client().get()
			.uri("/api/v1/notifications")
			.headers(h -> h.setBearerAuth(token("refresh", SECRET)))
			.exchange()
			.expectStatus()
			.isUnauthorized();
		// Firmato con un altro segreto
		client().get()
			.uri("/api/v1/notifications")
			.headers(h -> h.setBearerAuth(token("access", "un-altro-segreto-0123456789abcdef-0123456789")))
			.exchange()
			.expectStatus()
			.isUnauthorized();
	}

	@Test
	void salute_e_metriche_sono_aperte_per_prometheus_ma_gli_altri_endpoint_di_gestione_no() {
		client().get().uri("/actuator/health").exchange().expectStatus().isOk();
		client().get().uri("/actuator/prometheus").exchange().expectStatus().isOk();
		// Qualunque altro endpoint di gestione richiede l'amministratore: un utente normale riceve 403
		client().get().uri("/actuator/env").exchange().expectStatus().isUnauthorized();
		client().get()
			.uri("/actuator/env")
			.headers(h -> h.setBearerAuth(access()))
			.exchange()
			.expectStatus()
			.isForbidden();
	}

}
