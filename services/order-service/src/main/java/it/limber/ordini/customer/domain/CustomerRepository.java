package it.limber.ordini.customer.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.UUID;

public interface CustomerRepository extends JpaRepository<Customer, UUID>, JpaSpecificationExecutor<Customer> {

	boolean existsByEmail(String email);

	boolean existsByEmailAndIdNot(String email, UUID id);

	boolean existsByVatNumber(String vatNumber);

	boolean existsByVatNumberAndIdNot(String vatNumber, UUID id);

	@Query(value = "select nextval('orders.customer_code_seq')", nativeQuery = true)
	long nextCodeNumber();

}
