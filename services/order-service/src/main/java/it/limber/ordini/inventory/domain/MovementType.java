package it.limber.ordini.inventory.domain;

public enum MovementType {

	/** Merce in ingresso. */
	RECEIPT,

	/** Rettifica manuale (inventario, rotture): la quantità può essere negativa. */
	ADJUSTMENT,

	/** Quantità riservata a un ordine. */
	RESERVATION,

	/** Riserva annullata (ordine cancellato). */
	RELEASE,

	/** Merce uscita dal magazzino con la spedizione di un ordine. */
	SHIPMENT

}
