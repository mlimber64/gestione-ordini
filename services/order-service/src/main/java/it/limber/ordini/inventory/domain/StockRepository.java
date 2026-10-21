package it.limber.ordini.inventory.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

/**
 * Porta di uscita del magazzino. Le operazioni che cambiano la giacenza sono <b>condizionali e atomiche</b>:
 * restituiscono {@code false} se la condizione (per esempio "disponibile sufficiente") non è soddisfatta, senza mai
 * leggere il valore e poi riscriverlo. Questo evita la vendita dello stesso pezzo a due ordini concorrenti.
 */
public interface StockRepository {

	/** Giacenza di un prodotto esistente (zero se non ha mai avuto movimenti); vuoto se il prodotto non esiste. */
	Optional<StockLevel> find(UUID productId);

	Page<StockLevel> list(String query, boolean lowStockOnly, Pageable pageable);

	void receive(UUID productId, int quantity);

	/** Applica una rettifica (anche negativa) solo se la giacenza fisica resta almeno pari al riservato. */
	boolean adjust(UUID productId, int delta);

	/** Riserva la quantità solo se il disponibile è sufficiente. */
	boolean reserve(UUID productId, int quantity);

	boolean release(UUID productId, int quantity);

	/** Scarica dal magazzino merce già riservata. */
	boolean ship(UUID productId, int quantity);

	void setReorderLevel(UUID productId, int reorderLevel);

	void record(StockMovement movement);

	Page<StockMovement> movements(UUID productId, Pageable pageable);

}
