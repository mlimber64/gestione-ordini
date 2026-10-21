package it.limber.notification.notification;

import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/** Notifica ricavata da un evento, non ancora salvata. */
public record NewNotification(UUID eventId, String eventType, String topic, String aggregateId, Severity severity,
		String title, String message, JsonNode data, Instant occurredAt) {
}
