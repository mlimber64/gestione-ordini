package it.limber.ordini.order.adapter.out.persistence;

import it.limber.ordini.order.domain.OrderStatus;
import it.limber.ordini.order.domain.StatusChange;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_status_history")
class OrderStatusHistoryEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "order_id", nullable = false)
	private OrderEntity order;

	@Enumerated(EnumType.STRING)
	@Column(name = "from_status", length = 10)
	private OrderStatus fromStatus;

	@Enumerated(EnumType.STRING)
	@Column(name = "to_status", nullable = false, length = 10)
	private OrderStatus toStatus;

	@Column(length = 300)
	private String reason;

	@Column(name = "changed_by", nullable = false, length = 50)
	private String changedBy;

	@Column(name = "changed_at", nullable = false)
	private Instant changedAt;

	protected OrderStatusHistoryEntity() {
	}

	OrderStatusHistoryEntity(OrderEntity order, StatusChange change) {
		this.order = order;
		this.fromStatus = change.from();
		this.toStatus = change.to();
		this.reason = change.reason();
		this.changedBy = change.changedBy();
		this.changedAt = change.changedAt();
	}

	StatusChange toDomain() {
		return new StatusChange(fromStatus, toStatus, reason, changedBy, changedAt);
	}

}
