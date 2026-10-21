package it.limber.notification.event;

import it.limber.notification.notification.NewNotification;
import it.limber.notification.notification.Severity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Traduce gli eventi di order-service in notifiche leggibili, in italiano. Non conosce Kafka né il database, quindi
 * si testa con semplici stringhe JSON.
 */
@Component
public class NotificationFactory {

	private static final Logger log = LoggerFactory.getLogger(NotificationFactory.class);

	private static final Map<String, String> STATUS_LABELS = Map.of("PENDING", "In attesa", "CONFIRMED", "Confermato",
			"SHIPPED", "Spedito", "DELIVERED", "Consegnato", "CANCELLED", "Annullato");

	private final JsonMapper json;

	public NotificationFactory(JsonMapper json) {
		this.json = json;
	}

	/**
	 * @return la notifica, o vuoto se il tipo di evento è sconosciuto (un servizio più nuovo può pubblicare eventi che
	 * questo non conosce: si ignorano senza errore)
	 * @throws InvalidEventException se il messaggio è malformato
	 */
	public Optional<NewNotification> create(String topic, String value) {
		JsonNode envelope;
		try {
			envelope = json.readTree(value);
		}
		catch (RuntimeException ex) {
			throw new InvalidEventException("Il messaggio non è un JSON valido", ex);
		}
		try {
			UUID eventId = UUID.fromString(text(envelope, "eventId"));
			String eventType = text(envelope, "eventType");
			Instant occurredAt = Instant.parse(text(envelope, "occurredAt"));
			JsonNode data = envelope.get("data");
			if (data == null || !data.isObject()) {
				throw new InvalidEventException("Manca il contenuto 'data'");
			}
			return switch (eventType) {
				case "OrderCreated" -> Optional.of(orderCreated(topic, eventId, eventType, occurredAt, data));
				case "OrderStatusChanged" -> Optional.of(statusChanged(topic, eventId, eventType, occurredAt, data));
				case "StockLow" -> Optional.of(stockLow(topic, eventId, eventType, occurredAt, data));
				default -> {
					log.info("Evento {} ignorato: tipo sconosciuto", eventType);
					yield Optional.empty();
				}
			};
		}
		catch (InvalidEventException ex) {
			throw ex;
		}
		catch (RuntimeException ex) {
			throw new InvalidEventException("Evento malformato: " + ex.getMessage(), ex);
		}
	}

	private static NewNotification orderCreated(String topic, UUID eventId, String type, Instant at, JsonNode data) {
		String number = text(data, "number");
		BigDecimal total = new BigDecimal(text(data, "totalGross"));
		int lines = data.get("lineCount").asInt();
		String message = "%s ha effettuato un ordine da %s (%d %s)".formatted(text(data, "customerName"),
				NumberFormat.getCurrencyInstance(Locale.ITALY).format(total), lines, lines == 1 ? "riga" : "righe");
		return new NewNotification(eventId, type, topic, text(data, "orderId"), Severity.INFO,
				"Nuovo ordine " + number, message, data, at);
	}

	private static NewNotification statusChanged(String topic, UUID eventId, String type, Instant at, JsonNode data) {
		String number = text(data, "number");
		String from = label(data.get("fromStatus"));
		String to = label(data.get("toStatus"));
		StringBuilder message = new StringBuilder("L'ordine %s di %s è passato da %s a %s".formatted(number,
				text(data, "customerName"), from, to.toLowerCase(Locale.ITALY)));
		JsonNode reason = data.get("reason");
		if (reason != null && !reason.isNull() && !reason.asString().isBlank()) {
			message.append(". Motivo: ").append(reason.asString());
		}
		Severity severity = "CANCELLED".equals(text(data, "toStatus")) ? Severity.WARNING : Severity.INFO;
		return new NewNotification(eventId, type, topic, text(data, "orderId"), severity,
				"Ordine %s: %s".formatted(number, to.toLowerCase(Locale.ITALY)), message.toString(), data, at);
	}

	private static NewNotification stockLow(String topic, UUID eventId, String type, Instant at, JsonNode data) {
		String sku = text(data, "sku");
		String message = "%s: disponibili %d, soglia di riordino %d".formatted(text(data, "productName"),
				data.get("available").asInt(), data.get("reorderLevel").asInt());
		return new NewNotification(eventId, type, topic, text(data, "productId"), Severity.WARNING,
				"Scorta bassa: " + sku, message, data, at);
	}

	private static String label(JsonNode status) {
		if (status == null || status.isNull()) {
			return "nuovo";
		}
		return STATUS_LABELS.getOrDefault(status.asString(), status.asString());
	}

	private static String text(JsonNode node, String field) {
		JsonNode value = node.get(field);
		if (value == null || value.isNull()) {
			throw new InvalidEventException("Manca il campo '" + field + "'");
		}
		return value.asString();
	}

}
