package it.limber.ordini.shared.outbox;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Salva l'evento in {@code outbox_event}. Richiede una transazione già aperta ({@code MANDATORY}): chiamarlo
 * fuori da una transazione sarebbe un errore di programmazione, perché perderebbe la garanzia di atomicità.
 *
 * <p>Il contenuto è una busta con identificativo, tipo e data, più i dati. L'identificativo permette ai consumer di
 * scartare i duplicati (Kafka garantisce "almeno una volta").
 */
@Component
class JdbcOutboxPublisher implements OutboxPublisher {

	private final JdbcClient jdbc;

	private final JsonMapper json;

	JdbcOutboxPublisher(JdbcClient jdbc, JsonMapper json) {
		this.jdbc = jdbc;
		this.json = json;
	}

	@Override
	@Transactional(propagation = Propagation.MANDATORY)
	public void publish(String topic, String aggregateType, String aggregateId, String eventType, Object data) {
		UUID eventId = UUID.randomUUID();
		Map<String, Object> envelope = new LinkedHashMap<>();
		envelope.put("eventId", eventId);
		envelope.put("eventType", eventType);
		envelope.put("occurredAt", Instant.now());
		envelope.put("data", data);

		jdbc.sql("""
				INSERT INTO orders.outbox_event (id, aggregate_type, aggregate_id, event_type, topic, payload)
				VALUES (:id, :aggregateType, :aggregateId, :eventType, :topic, CAST(:payload AS jsonb))""")
			.param("id", eventId)
			.param("aggregateType", aggregateType)
			.param("aggregateId", aggregateId)
			.param("eventType", eventType)
			.param("topic", topic)
			.param("payload", json.writeValueAsString(envelope))
			.update();
	}

}
