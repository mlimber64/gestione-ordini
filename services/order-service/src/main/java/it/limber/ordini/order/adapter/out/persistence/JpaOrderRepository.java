package it.limber.ordini.order.adapter.out.persistence;

import it.limber.ordini.order.domain.Order;
import it.limber.ordini.order.domain.OrderFilter;
import it.limber.ordini.order.domain.OrderRepository;
import it.limber.ordini.order.domain.OrderSummary;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;

import java.time.Year;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Repository
class JpaOrderRepository implements OrderRepository {

	private final SpringDataOrderRepository jpa;

	private final EntityManager entityManager;

	JpaOrderRepository(SpringDataOrderRepository jpa, EntityManager entityManager) {
		this.jpa = jpa;
		this.entityManager = entityManager;
	}

	@Override
	public String nextNumber() {
		Number next = (Number) entityManager.createNativeQuery("SELECT nextval('orders.order_number_seq')")
			.getSingleResult();
		return "ORD-%d-%06d".formatted(Year.now().getValue(), next.longValue());
	}

	/**
	 * Il salvataggio forza subito la scrittura: se un altro utente ha modificato l'ordine nel frattempo, il conflitto
	 * di versione emerge qui, prima che il chiamante tocchi il magazzino.
	 */
	@Override
	public Order save(Order order) {
		OrderEntity entity = jpa.findById(order.id()).map(existing -> {
			existing.apply(order);
			return existing;
		}).orElseGet(() -> OrderEntity.from(order));
		return jpa.saveAndFlush(entity).toDomain();
	}

	@Override
	public Optional<Order> findById(UUID id) {
		return jpa.findById(id).map(OrderEntity::toDomain);
	}

	@Override
	public Page<OrderSummary> search(OrderFilter filter, Pageable pageable) {
		return jpa.findAll(toSpecification(filter), pageable)
			.map(entity -> new OrderSummary(entity.id(), entity.number(), entity.customerId(), entity.customerCode(),
					entity.customerName(), entity.status(), entity.totalGross(), entity.createdAt()));
	}

	private static Specification<OrderEntity> toSpecification(OrderFilter filter) {
		return (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (filter.status() != null) {
				predicates.add(cb.equal(root.get("status"), filter.status()));
			}
			if (filter.customerId() != null) {
				predicates.add(cb.equal(root.get("customerId"), filter.customerId()));
			}
			if (filter.number() != null && !filter.number().isBlank()) {
				predicates.add(cb.like(cb.lower(root.get("number")),
						"%" + filter.number().trim().toLowerCase(Locale.ROOT) + "%"));
			}
			if (filter.createdFrom() != null) {
				predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), filter.createdFrom()));
			}
			if (filter.createdBefore() != null) {
				predicates.add(cb.lessThan(root.get("createdAt"), filter.createdBefore()));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}

}
