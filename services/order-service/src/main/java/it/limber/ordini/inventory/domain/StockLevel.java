package it.limber.ordini.inventory.domain;

import java.util.UUID;

/**
 * Giacenza di un prodotto. {@code onHand} è la quantità fisicamente in magazzino, {@code reserved} quella già
 * promessa a ordini non ancora spediti: il venduto disponibile è la differenza.
 */
public record StockLevel(UUID productId, String sku, String productName, int onHand, int reserved,
		int reorderLevel) {

	public int available() {
		return onHand - reserved;
	}

	/** Sotto scorta: con una soglia impostata, il disponibile è sceso a quella soglia o meno. */
	public boolean lowStock() {
		return reorderLevel > 0 && available() <= reorderLevel;
	}

}
