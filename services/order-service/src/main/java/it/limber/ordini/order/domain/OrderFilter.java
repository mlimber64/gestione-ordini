package it.limber.ordini.order.domain;

import java.time.Instant;
import java.util.UUID;

/** Filtri di ricerca; ogni campo nullo è ignorato. {@code createdFrom} è incluso, {@code createdBefore} escluso. */
public record OrderFilter(OrderStatus status, UUID customerId, String number, Instant createdFrom,
		Instant createdBefore) {
}
