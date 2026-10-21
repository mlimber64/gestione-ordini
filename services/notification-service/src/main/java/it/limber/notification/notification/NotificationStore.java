package it.limber.notification.notification;

import io.r2dbc.spi.Readable;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.UUID;

/** Accesso reattivo alle notifiche. Il database garantisce l'idempotenza con il vincolo UNIQUE su {@code event_id}. */
@Repository
public class NotificationStore {

	private static final String COLUMNS = "id, event_id, event_type, aggregate_id, severity, title, message, data::text AS data, occurred_at, received_at";

	private static final String SELECT_ALL = "SELECT " + COLUMNS + " FROM notifications.notification_event";

	private static final String LIMIT = "limit";

	private final DatabaseClient db;

	private final JsonMapper json;

	NotificationStore(DatabaseClient db, JsonMapper json) {
		this.db = db;
		this.json = json;
	}

	/**
	 * Salva la notifica solo se l'evento non è già stato ricevuto.
	 *
	 * @return la notifica salvata, o vuoto se l'evento era un duplicato
	 */
	public Mono<Notification> insertIfAbsent(NewNotification n) {
		return db.sql("""
				INSERT INTO notifications.notification_event
				    (event_id, event_type, topic, aggregate_id, severity, title, message, data, occurred_at)
				VALUES (:eventId, :eventType, :topic, :aggregateId, :severity, :title, :message,
				        CAST(:data AS jsonb), :occurredAt)
				ON CONFLICT (event_id) DO NOTHING
				RETURNING\s""" + COLUMNS)
			.bind("eventId", n.eventId())
			.bind("eventType", n.eventType())
			.bind("topic", n.topic())
			.bind("aggregateId", n.aggregateId())
			.bind("severity", n.severity().name())
			.bind("title", n.title())
			.bind("message", n.message())
			.bind("data", json.writeValueAsString(n.data()))
			.bind("occurredAt", n.occurredAt())
			.map(this::map)
			.one();
	}

	/** Le notifiche più recenti, dalla più nuova; con {@code beforeId} si scorre indietro nella cronologia. */
	public Flux<Notification> findRecent(int limit, Long beforeId) {
		if (beforeId == null) {
			return db.sql(SELECT_ALL + " ORDER BY id DESC LIMIT :limit")
				.bind(LIMIT, limit)
				.map(this::map)
				.all();
		}
		return db.sql(SELECT_ALL + " WHERE id < :before ORDER BY id DESC LIMIT :limit")
			.bind("before", beforeId)
			.bind(LIMIT, limit)
			.map(this::map)
			.all();
	}

	/** Le notifiche arrivate dopo {@code id}, dalla più vecchia: serve a riprendere uno stream interrotto. */
	public Flux<Notification> findAfter(long id, int limit) {
		return db.sql(SELECT_ALL + " WHERE id > :id ORDER BY id LIMIT :limit")
			.bind("id", id)
			.bind(LIMIT, limit)
			.map(this::map)
			.all();
	}

	private Notification map(Readable row) {
		return new Notification(row.get("id", Long.class), row.get("event_id", UUID.class),
				row.get("event_type", String.class), row.get("aggregate_id", String.class),
				Severity.valueOf(row.get("severity", String.class)), row.get("title", String.class),
				row.get("message", String.class), json.readTree(row.get("data", String.class)),
				row.get("occurred_at", Instant.class), row.get("received_at", Instant.class));
	}

}
