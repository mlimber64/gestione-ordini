package it.limber.ordini.order.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

/** Porta di uscita degli ordini: il dominio la dichiara, la persistenza la implementa. */
public interface OrderRepository {

	/** Prossimo numero d'ordine progressivo, per esempio {@code ORD-2026-000042}. */
	String nextNumber();

	/** Salva un ordine nuovo o le modifiche di uno esistente e lo restituisce così com'è nel database. */
	Order save(Order order);

	Optional<Order> findById(UUID id);

	Page<OrderSummary> search(OrderFilter filter, Pageable pageable);

}
