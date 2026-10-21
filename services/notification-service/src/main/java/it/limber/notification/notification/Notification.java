package it.limber.notification.notification;

import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/** Notifica salvata. {@code id} cresce con l'ordine di arrivo ed è l'identificativo SSE. */
public record Notification(long id, UUID eventId, String eventType, String aggregateId, Severity severity,
		String title, String message, JsonNode data, Instant occurredAt, Instant receivedAt) {
}
