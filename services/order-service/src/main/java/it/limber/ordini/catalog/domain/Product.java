package it.limber.ordini.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "product")
public class Product {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, unique = true, length = 40)
	private String sku;

	@Column(nullable = false, length = 150)
	private String name;

	@Column(columnDefinition = "text")
	private String description;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "category_id", nullable = false)
	private Category category;

	@Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
	private BigDecimal unitPrice;

	@Column(name = "vat_rate", nullable = false, precision = 4, scale = 2)
	private BigDecimal vatRate;

	@Column(nullable = false)
	private boolean active = true;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	private Long version;

	protected Product() {
	}

	public Product(String sku, String name, String description, Category category, BigDecimal unitPrice,
			BigDecimal vatRate) {
		this.sku = normalizeSku(sku);
		update(name, description, category, unitPrice, vatRate);
	}

	public void update(String name, String description, Category category, BigDecimal unitPrice, BigDecimal vatRate) {
		this.name = name.trim();
		this.description = description == null || description.isBlank() ? null : description.trim();
		this.category = category;
		this.unitPrice = unitPrice.setScale(2, RoundingMode.HALF_UP);
		this.vatRate = vatRate.setScale(2, RoundingMode.HALF_UP);
	}

	public void setActive(boolean active) {
		this.active = active;
	}

	public static String normalizeSku(String sku) {
		return sku.trim().toUpperCase();
	}

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	public UUID getId() {
		return id;
	}

	public String getSku() {
		return sku;
	}

	public String getName() {
		return name;
	}

	public String getDescription() {
		return description;
	}

	public Category getCategory() {
		return category;
	}

	public BigDecimal getUnitPrice() {
		return unitPrice;
	}

	public BigDecimal getVatRate() {
		return vatRate;
	}

	public boolean isActive() {
		return active;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public Long getVersion() {
		return version;
	}

}
