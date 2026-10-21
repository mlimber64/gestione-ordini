package it.limber.ordini.inventory.domain;

import java.time.Instant;
import java.util.UUID;

/** Registro immutabile di una variazione di giacenza: dice chi, quando e perché. */
public record StockMovement(UUID id, UUID productId, MovementType type, int quantity, String referenceType,
		UUID referenceId, String note, String createdBy, Instant createdAt) {

	public static final String REFERENCE_ORDER = "ORDER";

	/** Movimento da registrare: l'identificativo e la data li assegna il database. */
	public static StockMovement of(UUID productId, MovementType type, int quantity, String referenceType,
			UUID referenceId, String note, String createdBy) {
		return new StockMovement(null, productId, type, quantity, referenceType, referenceId, note, createdBy, null);
	}

}
