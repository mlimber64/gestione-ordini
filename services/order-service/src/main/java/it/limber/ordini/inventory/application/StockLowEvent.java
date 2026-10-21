package it.limber.ordini.inventory.application;

import java.util.UUID;

/** Evento pubblicato quando un prodotto scende alla soglia di riordino o sotto. */
record StockLowEvent(UUID productId, String sku, String productName, int onHand, int reserved, int available,
		int reorderLevel) {
}
