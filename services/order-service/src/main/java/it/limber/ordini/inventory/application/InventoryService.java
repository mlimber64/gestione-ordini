package it.limber.ordini.inventory.application;

import it.limber.ordini.inventory.domain.MovementType;
import it.limber.ordini.inventory.domain.StockLevel;
import it.limber.ordini.inventory.domain.StockMovement;
import it.limber.ordini.inventory.domain.StockRepository;
import it.limber.ordini.shared.error.BusinessRuleException;
import it.limber.ordini.shared.error.ConflictException;
import it.limber.ordini.shared.error.NotFoundException;
import it.limber.ordini.shared.outbox.OutboxPublisher;
import it.limber.ordini.shared.outbox.Topics;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class InventoryService {

	public record StockView(UUID productId, String sku, String productName, int onHand, int reserved, int available,
			int reorderLevel, boolean lowStock) {

		static StockView of(StockLevel level) {
			return new StockView(level.productId(), level.sku(), level.productName(), level.onHand(),
					level.reserved(), level.available(), level.reorderLevel(), level.lowStock());
		}

	}

	public record MovementView(UUID id, MovementType type, int quantity, String referenceType, UUID referenceId,
			String note, String createdBy, Instant createdAt) {

		static MovementView of(StockMovement movement) {
			return new MovementView(movement.id(), movement.type(), movement.quantity(), movement.referenceType(),
					movement.referenceId(), movement.note(), movement.createdBy(), movement.createdAt());
		}

	}

	private final StockRepository stock;

	private final OutboxPublisher outbox;

	public InventoryService(StockRepository stock, OutboxPublisher outbox) {
		this.stock = stock;
		this.outbox = outbox;
	}

	@Transactional(readOnly = true)
	public StockView get(UUID productId) {
		return StockView.of(find(productId));
	}

	@Transactional(readOnly = true)
	public Page<StockView> list(String query, boolean lowStockOnly, Pageable pageable) {
		return stock.list(query, lowStockOnly, pageable).map(StockView::of);
	}

	@Transactional(readOnly = true)
	public Page<MovementView> movements(UUID productId, Pageable pageable) {
		find(productId);
		return stock.movements(productId, pageable).map(MovementView::of);
	}

	@Transactional
	public StockView receive(UUID productId, int quantity, String note, String actor) {
		find(productId);
		if (quantity < 1) {
			throw new BusinessRuleException("La quantità in ingresso deve essere almeno 1");
		}
		stock.receive(productId, quantity);
		stock.recordMovement(StockMovement.of(productId, MovementType.RECEIPT, quantity, null, null, note, actor));
		return get(productId);
	}

	@Transactional
	public StockView adjust(UUID productId, int delta, String note, String actor) {
		find(productId);
		if (delta == 0) {
			throw new BusinessRuleException("La rettifica non può essere zero");
		}
		if (delta > 0) {
			stock.receive(productId, delta);
		}
		else if (!stock.adjust(productId, delta)) {
			throw new BusinessRuleException(
					"La rettifica porterebbe la giacenza sotto la quantità già riservata agli ordini");
		}
		stock.recordMovement(StockMovement.of(productId, MovementType.ADJUSTMENT, delta, null, null, note, actor));
		StockLevel level = find(productId);
		announceIfBecameLow(level, level.available() - delta);
		return StockView.of(level);
	}

	@Transactional
	public StockView setReorderLevel(UUID productId, int reorderLevel) {
		find(productId);
		if (reorderLevel < 0) {
			throw new BusinessRuleException("La soglia di riordino non può essere negativa");
		}
		stock.setReorderLevel(productId, reorderLevel);
		return get(productId);
	}

	/**
	 * Riserva la quantità per un ordine. L'operazione è atomica nel database: con richieste concorrenti sullo
	 * stesso prodotto, il disponibile non scende mai sotto zero.
	 *
	 * @throws ConflictException se il disponibile non basta
	 */
	@Transactional
	public void reserve(UUID productId, int quantity, UUID orderId, String actor) {
		if (!stock.reserve(productId, quantity)) {
			StockLevel level = find(productId);
			throw new ConflictException("Giacenza insufficiente per %s: richiesti %d, disponibili %d"
				.formatted(level.sku(), quantity, level.available()));
		}
		stock.recordMovement(StockMovement.of(productId, MovementType.RESERVATION, quantity, StockMovement.REFERENCE_ORDER,
				orderId, null, actor));
		StockLevel level = find(productId);
		announceIfBecameLow(level, level.available() + quantity);
	}

	@Transactional
	public void release(UUID productId, int quantity, UUID orderId, String actor) {
		if (!stock.release(productId, quantity)) {
			throw new IllegalStateException("Riserva incoerente per il prodotto " + productId + " (ordine " + orderId + ")");
		}
		stock.recordMovement(StockMovement.of(productId, MovementType.RELEASE, quantity, StockMovement.REFERENCE_ORDER,
				orderId, null, actor));
	}

	@Transactional
	public void ship(UUID productId, int quantity, UUID orderId, String actor) {
		if (!stock.ship(productId, quantity)) {
			throw new IllegalStateException("Spedizione incoerente per il prodotto " + productId + " (ordine " + orderId + ")");
		}
		stock.recordMovement(StockMovement.of(productId, MovementType.SHIPMENT, quantity, StockMovement.REFERENCE_ORDER,
				orderId, null, actor));
	}

	/** Pubblica l'evento solo al passaggio da "scorta sufficiente" a "scorta bassa", non a ogni movimento. */
	private void announceIfBecameLow(StockLevel after, int availableBefore) {
		boolean wasLow = after.reorderLevel() > 0 && availableBefore <= after.reorderLevel();
		if (after.lowStock() && !wasLow) {
			outbox.publish(Topics.STOCK_LOW, "Product", after.productId().toString(), "StockLow",
					new StockLowEvent(after.productId(), after.sku(), after.productName(), after.onHand(),
							after.reserved(), after.available(), after.reorderLevel()));
		}
	}

	private StockLevel find(UUID productId) {
		return stock.find(productId).orElseThrow(() -> new NotFoundException("Prodotto non trovato: " + productId));
	}

}
