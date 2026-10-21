package it.limber.ordini.order;

import com.jayway.jsonpath.JsonPath;
import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.CommittedIntegrationTest;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.kafka.core.ConsumerFactory;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Dall'API a Kafka: un cambiamento confermato nel database arriva come evento sul topic giusto, e un cambiamento
 * annullato non lascia nessun evento. Usa dati realmente confermati (il relay gira in un altro thread).
 */
@CommittedIntegrationTest
class OutboxEventsIntegrationTest extends ApiTestSupport {

	private static final String ORDER_CREATED = "orders.order-created.v1";

	private static final String ORDER_STATUS_CHANGED = "orders.order-status-changed.v1";

	private static final String STOCK_LOW = "inventory.stock-low.v1";

	@Autowired
	private ConsumerFactory<String, String> consumerFactory;

	@Autowired
	private JdbcClient jdbc;

	private final List<UUID> products = new ArrayList<>();

	private final List<UUID> customers = new ArrayList<>();

	@AfterEach
	void cleanUp() {
		if (customers.isEmpty() && products.isEmpty()) {
			return;
		}
		jdbc.sql("DELETE FROM orders.sales_order WHERE customer_id IN (:ids)").param("ids", customers).update();
		jdbc.sql("DELETE FROM orders.stock_movement WHERE product_id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.inventory WHERE product_id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.product WHERE id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.customer WHERE id IN (:ids)").param("ids", customers).update();
		products.clear();
		customers.clear();
	}

	private String product(String token, int stock) throws Exception {
		String id = createProduct(token, "10.00", "22");
		products.add(UUID.fromString(id));
		receiveStock(token, id, stock);
		return id;
	}

	private String customer(String token) throws Exception {
		String id = createCustomerWithAddress(token);
		customers.add(UUID.fromString(id));
		return id;
	}

	/** Legge il topic dall'inizio e restituisce i record che soddisfano la condizione, aspettando fino a 20 secondi. */
	private List<ConsumerRecord<String, String>> await(String topic, Predicate<ConsumerRecord<String, String>> match,
			int expected) {
		Properties overrides = new Properties();
		overrides.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
		List<ConsumerRecord<String, String>> found = new ArrayList<>();
		try (Consumer<String, String> consumer = consumerFactory.createConsumer("test-" + UUID.randomUUID(), "test",
				"", overrides)) {
			consumer.subscribe(List.of(topic));
			long deadline = System.nanoTime() + Duration.ofSeconds(20).toNanos();
			while (found.size() < expected && System.nanoTime() < deadline) {
				consumer.poll(Duration.ofMillis(300)).forEach(message -> {
					if (match.test(message)) {
						found.add(message);
					}
				});
			}
		}
		return found;
	}

	private static String header(ConsumerRecord<String, String> message, String name) {
		Header header = message.headers().lastHeader(name);
		return header == null ? null : new String(header.value(), StandardCharsets.UTF_8);
	}

	@Test
	void un_ordine_creato_arriva_su_kafka_con_busta_e_intestazioni() throws Exception {
		String token = adminToken();
		String productId = product(token, 10);
		String customerId = customer(token);
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 3)));

		List<ConsumerRecord<String, String>> records = await(ORDER_CREATED, r -> orderId.equals(r.key()), 1);

		assertThat(records).hasSize(1);
		ConsumerRecord<String, String> message = records.getFirst();
		assertThat(JsonPath.<String>read(message.value(), "$.eventType")).isEqualTo("OrderCreated");
		assertThat(JsonPath.<String>read(message.value(), "$.eventId")).isEqualTo(header(message, "event-id"));
		assertThat(header(message, "event-type")).isEqualTo("OrderCreated");
		assertThat(JsonPath.<String>read(message.value(), "$.data.orderId")).isEqualTo(orderId);
		assertThat(JsonPath.<String>read(message.value(), "$.data.customerId")).isEqualTo(customerId);
		assertThat(JsonPath.<Integer>read(message.value(), "$.data.lineCount")).isEqualTo(1);
		assertThat(JsonPath.<Number>read(message.value(), "$.data.totalGross").doubleValue()).isEqualTo(36.60);
		assertThat(JsonPath.<String>read(message.value(), "$.occurredAt")).isNotBlank();

		// Una volta confermato da Kafka, l'evento risulta pubblicato nel database
		String eventId = header(message, "event-id");
		assertThat(jdbc.sql("SELECT published_at IS NOT NULL FROM orders.outbox_event WHERE id = :id")
			.param("id", UUID.fromString(eventId))
			.query(Boolean.class)
			.single()).isTrue();
	}

	@Test
	void ogni_cambio_di_stato_e_un_evento_con_stato_precedente_e_nuovo() throws Exception {
		String token = adminToken();
		String productId = product(token, 10);
		String customerId = customer(token);
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 2)));
		postJson("/api/v1/orders/" + orderId + "/confirm", token, "").andExpect(status().isOk());
		postJson("/api/v1/orders/" + orderId + "/cancel", token, "{\"reason\":\"Errore di inserimento\"}")
			.andExpect(status().isOk());

		List<ConsumerRecord<String, String>> records = await(ORDER_STATUS_CHANGED, r -> orderId.equals(r.key()), 2);

		assertThat(records).hasSize(2);
		// Stessa chiave, quindi stessa partizione: l'ordine di arrivo è quello dei fatti
		assertThat(JsonPath.<String>read(records.get(0).value(), "$.data.fromStatus")).isEqualTo("PENDING");
		assertThat(JsonPath.<String>read(records.get(0).value(), "$.data.toStatus")).isEqualTo("CONFIRMED");
		assertThat(JsonPath.<String>read(records.get(1).value(), "$.data.toStatus")).isEqualTo("CANCELLED");
		assertThat(JsonPath.<String>read(records.get(1).value(), "$.data.reason")).isEqualTo("Errore di inserimento");
	}

	@Test
	void la_scorta_bassa_si_annuncia_una_volta_sola_al_passaggio_della_soglia() throws Exception {
		String token = adminToken();
		String productId = product(token, 10);
		String customerId = customer(token);
		patchJson("/api/v1/inventory/" + productId + "/reorder-level", token, "{\"reorderLevel\":5}")
			.andExpect(status().isOk());

		// Disponibile 10 -> 7 -> 4 -> 3: l'evento deve partire solo al secondo ordine, quando 4 <= 5
		postJson("/api/v1/orders", token, orderJson(customerId, productId, 3)).andExpect(status().isCreated());
		postJson("/api/v1/orders", token, orderJson(customerId, productId, 3)).andExpect(status().isCreated());
		postJson("/api/v1/orders", token, orderJson(customerId, productId, 1)).andExpect(status().isCreated());

		List<ConsumerRecord<String, String>> records = await(STOCK_LOW, r -> productId.equals(r.key()), 2);

		assertThat(records).hasSize(1);
		assertThat(JsonPath.<Integer>read(records.getFirst().value(), "$.data.available")).isEqualTo(4);
		assertThat(JsonPath.<Integer>read(records.getFirst().value(), "$.data.reorderLevel")).isEqualTo(5);
	}

	@Test
	void una_transazione_annullata_non_lascia_nessun_evento() throws Exception {
		String token = adminToken();
		String abundant = product(token, 10);
		String scarce = product(token, 1);
		String customerId = customer(token);
		long before = outboxCount();

		postJson("/api/v1/orders", token, """
				{"customerId":"%s","items":[{"productId":"%s","quantity":2},{"productId":"%s","quantity":5}]}"""
			.formatted(customerId, abundant, scarce)).andExpect(status().isConflict());

		assertThat(outboxCount()).isEqualTo(before);
	}

	private long outboxCount() {
		return jdbc.sql("SELECT count(*) FROM orders.outbox_event").query(Long.class).single();
	}

}
