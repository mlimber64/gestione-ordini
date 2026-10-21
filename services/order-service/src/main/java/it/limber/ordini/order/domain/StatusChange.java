package it.limber.ordini.order.domain;

import java.time.Instant;

/** Una riga dello storico: da quale stato a quale, chi l'ha deciso e perché. {@code from} è nullo alla creazione. */
public record StatusChange(OrderStatus from, OrderStatus to, String reason, String changedBy, Instant changedAt) {
}
