package it.limber.ordini.order.adapter.out.persistence;

import it.limber.ordini.order.domain.OrderLine;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "order_item")
class OrderItemEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "order_id", nullable = false)
	private OrderEntity order;

	@Column(name = "product_id", nullable = false)
	private UUID productId;

	@Column(nullable = false, length = 40)
	private String sku;

	@Column(name = "product_name", nullable = false, length = 150)
	private String productName;

	@Column(nullable = false)
	private int quantity;

	@Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
	private BigDecimal unitPrice;

	@Column(name = "vat_rate", nullable = false, precision = 4, scale = 2)
	private BigDecimal vatRate;

	@Column(name = "line_net", nullable = false, precision = 14, scale = 2)
	private BigDecimal lineNet;

	@Column(name = "line_vat", nullable = false, precision = 14, scale = 2)
	private BigDecimal lineVat;

	protected OrderItemEntity() {
	}

	OrderItemEntity(OrderEntity order, OrderLine line) {
		this.order = order;
		this.productId = line.productId();
		this.sku = line.sku();
		this.productName = line.productName();
		this.quantity = line.quantity();
		this.unitPrice = line.unitPrice();
		this.vatRate = line.vatRate();
		this.lineNet = line.net();
		this.lineVat = line.vat();
	}

	OrderLine toDomain() {
		return new OrderLine(productId, sku, productName, quantity, unitPrice, vatRate);
	}

}
