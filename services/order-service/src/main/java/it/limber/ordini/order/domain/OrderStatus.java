package it.limber.ordini.order.domain;

/**
 * Ciclo di vita di un ordine. Le transizioni consentite sono definite qui e in nessun altro posto:
 *
 * <pre>
 * PENDING ──► CONFIRMED ──► SHIPPED ──► DELIVERED
 *    └──────────┴──► CANCELLED
 * </pre>
 */
public enum OrderStatus {

	PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED;

	public boolean canTransitionTo(OrderStatus target) {
		return switch (this) {
			case PENDING -> target == CONFIRMED || target == CANCELLED;
			case CONFIRMED -> target == SHIPPED || target == CANCELLED;
			case SHIPPED -> target == DELIVERED;
			case DELIVERED, CANCELLED -> false;
		};
	}

	/** Finché l'ordine non è spedito o chiuso, le quantità restano riservate nel magazzino. */
	public boolean holdsReservation() {
		return this == PENDING || this == CONFIRMED;
	}

}
