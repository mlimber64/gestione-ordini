package it.limber.ordini.order.application;

import it.limber.ordini.order.domain.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Contenuto degli eventi sugli ordini: è il contratto con gli altri servizi. Si possono aggiungere campi, mai
 * toglierli né cambiarne il significato (altrimenti serve un nuovo topic con versione successiva).
 */
final class OrderEvents {

	private OrderEvents() {
	}

	record OrderCreated(UUID orderId, String number, UUID customerId, String customerCode, String customerName,
			BigDecimal totalGross, int lineCount, String createdBy, Instant createdAt) {
	}

	record OrderStatusChanged(UUID orderId, String number, UUID customerId, String customerName,
			OrderStatus fromStatus, OrderStatus toStatus, String reason, String changedBy, Instant changedAt) {
	}

}
