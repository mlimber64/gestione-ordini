package it.limber.ordini.order.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Vista compatta per gli elenchi, senza righe né storico. */
public record OrderSummary(UUID id, String number, UUID customerId, String customerCode, String customerName,
		OrderStatus status, BigDecimal totalGross, Instant createdAt) {
}
