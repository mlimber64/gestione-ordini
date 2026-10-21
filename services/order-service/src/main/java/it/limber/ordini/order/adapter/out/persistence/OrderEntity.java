package it.limber.ordini.order.adapter.out.persistence;

import it.limber.ordini.order.domain.Order;
import it.limber.ordini.order.domain.OrderLine;
import it.limber.ordini.order.domain.OrderStatus;
import it.limber.ordini.order.domain.ShippingAddress;
import it.limber.ordini.order.domain.StatusChange;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Modello di persistenza dell'ordine: tiene separato il database dalle regole del dominio. */
@Entity
@Table(name = "sales_order")
class OrderEntity {

	@Id
	private UUID id;

	@Column(nullable = false, unique = true, length = 20)
	private String number;

	@Column(name = "customer_id", nullable = false)
	private UUID customerId;

	@Column(name = "customer_code", nullable = false, length = 20)
	private String customerCode;

	@Column(name = "customer_name", nullable = false, length = 150)
	private String customerName;

	@Column(name = "ship_street", nullable = false, length = 200)
	private String shipStreet;

	@Column(name = "ship_city", nullable = false, length = 100)
	private String shipCity;

	@Column(name = "ship_province", nullable = false, length = 2)
	private String shipProvince;

	@Column(name = "ship_postal_code", nullable = false, length = 5)
	private String shipPostalCode;

	@Column(name = "ship_country", nullable = false, length = 2)
	private String shipCountry;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private OrderStatus status;

	@Column(length = 500)
	private String notes;

	@Column(name = "total_net", nullable = false, precision = 14, scale = 2)
	private BigDecimal totalNet;

	@Column(name = "total_vat", nullable = false, precision = 14, scale = 2)
	private BigDecimal totalVat;

	@Column(name = "total_gross", nullable = false, precision = 14, scale = 2)
	private BigDecimal totalGross;

	@Column(name = "created_by", nullable = false, length = 50)
	private String createdBy;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	private Long version;

	@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("sku")
	private List<OrderItemEntity> items = new ArrayList<>();

	@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
	@OrderBy("changedAt, id")
	private List<OrderStatusHistoryEntity> history = new ArrayList<>();

	protected OrderEntity() {
	}

	static OrderEntity from(Order order) {
		OrderEntity entity = new OrderEntity();
		entity.id = order.id();
		entity.number = order.number();
		entity.customerId = order.customerId();
		entity.customerCode = order.customerCode();
		entity.customerName = order.customerName();
		ShippingAddress address = order.shippingAddress();
		entity.shipStreet = address.street();
		entity.shipCity = address.city();
		entity.shipProvince = address.province();
		entity.shipPostalCode = address.postalCode();
		entity.shipCountry = address.country();
		entity.notes = order.notes();
		entity.totalNet = order.totalNet();
		entity.totalVat = order.totalVat();
		entity.totalGross = order.totalGross();
		entity.createdBy = order.createdBy();
		entity.createdAt = order.createdAt();
		for (OrderLine line : order.lines()) {
			entity.items.add(new OrderItemEntity(entity, line));
		}
		entity.apply(order);
		return entity;
	}

	/** Allinea lo stato e aggiunge allo storico i cambi non ancora salvati. */
	void apply(Order order) {
		this.status = order.status();
		this.updatedAt = order.updatedAt();
		for (StatusChange change : order.pendingChanges()) {
			history.add(new OrderStatusHistoryEntity(this, change));
		}
	}

	UUID id() {
		return id;
	}

	String number() {
		return number;
	}

	UUID customerId() {
		return customerId;
	}

	String customerCode() {
		return customerCode;
	}

	String customerName() {
		return customerName;
	}

	OrderStatus status() {
		return status;
	}

	BigDecimal totalGross() {
		return totalGross;
	}

	Instant createdAt() {
		return createdAt;
	}

	Order toDomain() {
		List<OrderLine> lines = items.stream().map(OrderItemEntity::toDomain).toList();
		List<StatusChange> changes = history.stream().map(OrderStatusHistoryEntity::toDomain).toList();
		return Order.restore(id, number, customerId, customerCode, customerName,
				new ShippingAddress(shipStreet, shipCity, shipProvince, shipPostalCode, shipCountry), notes, lines,
				createdBy, createdAt, status, updatedAt, changes);
	}

}
