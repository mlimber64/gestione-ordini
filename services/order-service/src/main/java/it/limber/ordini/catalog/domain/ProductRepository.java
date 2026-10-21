package it.limber.ordini.catalog.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

	boolean existsBySku(String sku);

	/** Carica la categoria insieme ai prodotti, per evitare una query per ogni riga. */
	@Override
	@EntityGraph(attributePaths = "category")
	Page<Product> findAll(Specification<Product> spec, Pageable pageable);

}
