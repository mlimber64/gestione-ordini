package it.limber.ordini.order.domain;

import it.limber.ordini.shared.error.BusinessRuleException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Aggregato ordine: contiene le regole di business (totali, transizioni di stato) senza dipendere da Spring né da
 * JPA, quindi si testa con un semplice test unitario. Le righe non cambiano dopo la creazione.
 */
public final class Order {

	private static final int MAX_LINES = 100;

	private final UUID id;

	private final String number;

	private final UUID customerId;

	private final String customerCode;

	private final String customerName;

	private final ShippingAddress shippingAddress;

	private final String notes;

	private final List<OrderLine> lines;

	private final String createdBy;

	private final Instant createdAt;

	private final List<StatusChange> history;

	private final List<StatusChange> pendingChanges = new ArrayList<>();

	private OrderStatus status;

	private Instant updatedAt;

	// Le firme lunghe qui sotto servono a costruire e ricostruire l'aggregato con tutti i suoi campi immutabili
	@SuppressWarnings("java:S107")
	private Order(UUID id, String number, UUID customerId, String customerCode, String customerName,
			ShippingAddress shippingAddress, String notes, List<OrderLine> lines, String createdBy, Instant createdAt,
			OrderStatus status, Instant updatedAt, List<StatusChange> history) {
		this.id = id;
		this.number = number;
		this.customerId = customerId;
		this.customerCode = customerCode;
		this.customerName = customerName;
		this.shippingAddress = shippingAddress;
		this.notes = notes;
		this.lines = List.copyOf(lines);
		this.createdBy = createdBy;
		this.createdAt = createdAt;
		this.status = status;
		this.updatedAt = updatedAt;
		this.history = new ArrayList<>(history);
	}

	/** Crea un ordine nuovo, in attesa. */
	@SuppressWarnings("java:S107")
	public static Order place(UUID id, String number, UUID customerId, String customerCode, String customerName,
			ShippingAddress shippingAddress, String notes, List<OrderLine> lines, String actor, Instant now) {
		if (lines == null || lines.isEmpty()) {
			throw new BusinessRuleException("L'ordine deve contenere almeno una riga");
		}
		if (lines.size() > MAX_LINES) {
			throw new BusinessRuleException("L'ordine non può contenere più di " + MAX_LINES + " righe");
		}
		Set<UUID> products = new HashSet<>();
		for (OrderLine line : lines) {
			if (!products.add(line.productId())) {
				throw new BusinessRuleException("Il prodotto " + line.sku() + " compare più di una volta");
			}
		}
		String cleanNotes = notes == null || notes.isBlank() ? null : notes.trim();
		Order order = new Order(id, number, customerId, customerCode, customerName, shippingAddress, cleanNotes,
				lines, actor, now, OrderStatus.PENDING, now, List.of());
		order.pendingChanges.add(new StatusChange(null, OrderStatus.PENDING, null, actor, now));
		return order;
	}

	/** Ricostruisce un ordine già salvato. */
	@SuppressWarnings("java:S107")
	public static Order restore(UUID id, String number, UUID customerId, String customerCode, String customerName,
			ShippingAddress shippingAddress, String notes, List<OrderLine> lines, String createdBy, Instant createdAt,
			OrderStatus status, Instant updatedAt, List<StatusChange> history) {
		return new Order(id, number, customerId, customerCode, customerName, shippingAddress, notes, lines,
				createdBy, createdAt, status, updatedAt, history);
	}

	public void confirm(String actor, Instant now) {
		moveTo(OrderStatus.CONFIRMED, null, actor, now);
	}

	public void ship(String actor, Instant now) {
		moveTo(OrderStatus.SHIPPED, null, actor, now);
	}

	public void deliver(String actor, Instant now) {
		moveTo(OrderStatus.DELIVERED, null, actor, now);
	}

	public void cancel(String reason, String actor, Instant now) {
		if (reason == null || reason.isBlank()) {
			throw new BusinessRuleException("Per annullare un ordine serve un motivo");
		}
		moveTo(OrderStatus.CANCELLED, reason.trim(), actor, now);
	}

	private void moveTo(OrderStatus target, String reason, String actor, Instant now) {
		if (!status.canTransitionTo(target)) {
			throw new BusinessRuleException(
					"Transizione non consentita: un ordine %s non può passare a %s".formatted(status, target));
		}
		pendingChanges.add(new StatusChange(status, target, reason, actor, now));
		status = target;
		updatedAt = now;
	}

	public BigDecimal totalNet() {
		return lines.stream().map(OrderLine::net).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	public BigDecimal totalVat() {
		return lines.stream().map(OrderLine::vat).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	public BigDecimal totalGross() {
		return totalNet().add(totalVat());
	}

	/** Cambi di stato non ancora salvati. */
	public List<StatusChange> pendingChanges() {
		return List.copyOf(pendingChanges);
	}

	public UUID id() {
		return id;
	}

	public String number() {
		return number;
	}

	public UUID customerId() {
		return customerId;
	}

	public String customerCode() {
		return customerCode;
	}

	public String customerName() {
		return customerName;
	}

	public ShippingAddress shippingAddress() {
		return shippingAddress;
	}

	public String notes() {
		return notes;
	}

	public List<OrderLine> lines() {
		return lines;
	}

	public String createdBy() {
		return createdBy;
	}

	public Instant createdAt() {
		return createdAt;
	}

	public OrderStatus status() {
		return status;
	}

	public Instant updatedAt() {
		return updatedAt;
	}

	/** Storico degli stati già salvati, dal più vecchio al più recente. */
	public List<StatusChange> history() {
		return List.copyOf(history);
	}

}
