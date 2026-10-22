package it.limber.ordini.shared.outbox;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Legge gli eventi non ancora pubblicati e li invia a Kafka, nell'ordine in cui sono stati creati.
 *
 * <ul>
 * <li>{@code FOR UPDATE SKIP LOCKED}: più istanze del servizio possono girare insieme senza pubblicare lo stesso
 * evento due volte né bloccarsi a vicenda.</li>
 * <li>L'evento si segna come pubblicato solo dopo la conferma di Kafka. Se il servizio cade tra l'invio e il
 * segno, l'evento viene reinviato: la garanzia è "almeno una volta", per questo i consumer sono idempotenti.</li>
 * <li>Al primo errore il lotto si ferma, così un evento non supera mai quelli che lo precedono.</li>
 * </ul>
 * Esiste solo con {@code app.outbox.mode=polling} (il valore di base): con {@code cdc} gli eventi li porta Debezium.
 */
@Component
@ConditionalOnProperty(name = "app.outbox.mode", havingValue = "polling", matchIfMissing = true)
class OutboxRelay {

	private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);

	private record Pending(UUID id, String topic, String key, String type, String payload) {
	}

	private final JdbcClient jdbc;

	private final KafkaTemplate<String, String> kafka;

	private final TransactionTemplate transaction;

	private final int batchSize;

	private final long sendTimeoutSeconds;

	private final Counter published;

	private final Counter failed;

	OutboxRelay(JdbcClient jdbc, KafkaTemplate<String, String> kafka, TransactionTemplate transaction,
			MeterRegistry metrics, @Value("${app.outbox.relay.batch-size:50}") int batchSize,
			@Value("${app.outbox.relay.send-timeout-seconds:10}") long sendTimeoutSeconds) {
		this.jdbc = jdbc;
		this.kafka = kafka;
		this.transaction = transaction;
		this.batchSize = batchSize;
		this.sendTimeoutSeconds = sendTimeoutSeconds;
		this.published = Counter.builder("outbox.events.published").description("Eventi pubblicati su Kafka").register(metrics);
		this.failed = Counter.builder("outbox.events.failed").description("Invii a Kafka falliti").register(metrics);
		Gauge.builder("outbox.events.pending", this, OutboxRelay::pendingCount)
			.description("Eventi in attesa di pubblicazione")
			.register(metrics);
	}

	@Scheduled(fixedDelayString = "${app.outbox.relay.poll-interval:1s}")
	void relay() {
		boolean more = true;
		while (more) {
			Integer sent = transaction.execute(status -> relayBatch());
			more = sent != null && sent >= batchSize;
		}
	}

	/** Pubblica un lotto e restituisce quanti eventi ha inviato. Gira in una transazione: i lock durano fino alla fine. */
	private int relayBatch() {
		List<Pending> batch = jdbc.sql("""
				SELECT id, topic, aggregate_id, event_type, payload::text AS payload
				FROM orders.outbox_event
				WHERE published_at IS NULL
				ORDER BY created_at, id
				LIMIT :limit
				FOR UPDATE SKIP LOCKED""")
			.param("limit", batchSize)
			.query((rs, row) -> new Pending(rs.getObject("id", UUID.class), rs.getString("topic"),
					rs.getString("aggregate_id"), rs.getString("event_type"), rs.getString("payload")))
			.list();

		int sent = 0;
		for (Pending event : batch) {
			try {
				kafka.send(toMessage(event)).get(sendTimeoutSeconds, TimeUnit.SECONDS);
			}
			catch (InterruptedException ex) {
				Thread.currentThread().interrupt();
				return sent;
			}
			catch (Exception ex) {
				failed.increment();
				log.warn("Invio dell'evento {} ({}) a Kafka non riuscito: {}", event.id(), event.type(), ex.toString());
				jdbc.sql("UPDATE orders.outbox_event SET attempts = attempts + 1, last_error = :error WHERE id = :id")
					.param("error", abbreviate(ex.toString()))
					.param("id", event.id())
					.update();
				return sent;
			}
			jdbc.sql("UPDATE orders.outbox_event SET published_at = now(), last_error = NULL WHERE id = :id")
				.param("id", event.id())
				.update();
			published.increment();
			sent++;
		}
		return sent;
	}

	private static ProducerRecord<String, String> toMessage(Pending event) {
		ProducerRecord<String, String> message = new ProducerRecord<>(event.topic(), event.key(), event.payload());
		message.headers().add("event-id", event.id().toString().getBytes(StandardCharsets.UTF_8));
		message.headers().add("event-type", event.type().getBytes(StandardCharsets.UTF_8));
		return message;
	}

	private double pendingCount() {
		Long count = jdbc.sql("SELECT count(*) FROM orders.outbox_event WHERE published_at IS NULL")
			.query(Long.class)
			.single();
		return count == null ? 0 : (double) count;
	}

	private static String abbreviate(String text) {
		return text.length() <= 500 ? text : text.substring(0, 500);
	}

}
