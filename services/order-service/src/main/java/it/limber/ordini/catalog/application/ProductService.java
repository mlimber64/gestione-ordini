package it.limber.ordini.catalog.application;

import it.limber.ordini.catalog.domain.Category;
import it.limber.ordini.catalog.domain.CategoryRepository;
import it.limber.ordini.catalog.domain.Product;
import it.limber.ordini.catalog.domain.ProductRepository;
import it.limber.ordini.shared.error.BusinessRuleException;
import it.limber.ordini.shared.error.ConflictException;
import it.limber.ordini.shared.error.NotFoundException;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class ProductService {

	/** Aliquote IVA italiane ammesse: ordinaria, ridotta e super ridotta. */
	private static final Set<BigDecimal> VAT_RATES = Set.of(new BigDecimal("22.00"), new BigDecimal("10.00"),
			new BigDecimal("4.00"));

	public record ProductCommand(String sku, String name, String description, UUID categoryId, BigDecimal unitPrice,
			BigDecimal vatRate) {
	}

	public record ProductFilter(String query, UUID categoryId, Boolean active) {
	}

	public record ProductView(UUID id, String sku, String name, String description, UUID categoryId,
			String categoryName, BigDecimal unitPrice, BigDecimal vatRate, boolean active, Instant createdAt,
			Instant updatedAt) {

		static ProductView of(Product product) {
			return new ProductView(product.getId(), product.getSku(), product.getName(), product.getDescription(),
					product.getCategory().getId(), product.getCategory().getName(), product.getUnitPrice(),
					product.getVatRate(), product.isActive(), product.getCreatedAt(), product.getUpdatedAt());
		}

	}

	private final ProductRepository products;

	private final CategoryRepository categories;

	public ProductService(ProductRepository products, CategoryRepository categories) {
		this.products = products;
		this.categories = categories;
	}

	@Transactional(readOnly = true)
	public Page<ProductView> search(ProductFilter filter, Pageable pageable) {
		return products.findAll(toSpecification(filter), pageable).map(ProductView::of);
	}

	@Transactional(readOnly = true)
	public ProductView get(UUID id) {
		return ProductView.of(find(id));
	}

	@Transactional
	public ProductView create(ProductCommand command) {
		String sku = Product.normalizeSku(command.sku());
		if (products.existsBySku(sku)) {
			throw new ConflictException("Esiste già un prodotto con SKU " + sku);
		}
		checkVatRate(command.vatRate());
		Product product = new Product(sku, command.name(), command.description(), category(command.categoryId()),
				command.unitPrice(), command.vatRate());
		return ProductView.of(products.saveAndFlush(product));
	}

	@Transactional
	public ProductView update(UUID id, ProductCommand command) {
		Product product = find(id);
		if (!product.getSku().equals(Product.normalizeSku(command.sku()))) {
			throw new BusinessRuleException("Lo SKU di un prodotto non può essere modificato");
		}
		checkVatRate(command.vatRate());
		product.update(command.name(), command.description(), category(command.categoryId()), command.unitPrice(),
				command.vatRate());
		products.flush();
		return ProductView.of(product);
	}

	@Transactional
	public ProductView setActive(UUID id, boolean active) {
		Product product = find(id);
		product.setActive(active);
		products.flush();
		return ProductView.of(product);
	}

	private Product find(UUID id) {
		return products.findById(id).orElseThrow(() -> new NotFoundException("Prodotto non trovato: " + id));
	}

	private Category category(UUID categoryId) {
		return categories.findById(categoryId)
			.orElseThrow(() -> new BusinessRuleException("La categoria non esiste: " + categoryId));
	}

	private static void checkVatRate(BigDecimal vatRate) {
		boolean allowed = VAT_RATES.stream().anyMatch(rate -> rate.compareTo(vatRate) == 0);
		if (!allowed) {
			throw new BusinessRuleException("Aliquota IVA non ammessa: " + vatRate + ". Valori ammessi: 22, 10, 4");
		}
	}

	private static Specification<Product> toSpecification(ProductFilter filter) {
		return (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (filter.active() != null) {
				predicates.add(cb.equal(root.get("active"), filter.active()));
			}
			if (filter.categoryId() != null) {
				predicates.add(cb.equal(root.get("category").get("id"), filter.categoryId()));
			}
			if (filter.query() != null && !filter.query().isBlank()) {
				String pattern = "%" + filter.query().trim().toLowerCase(Locale.ROOT) + "%";
				predicates.add(cb.or(cb.like(cb.lower(root.get("name")), pattern),
						cb.like(cb.lower(root.get("sku")), pattern)));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}

}
