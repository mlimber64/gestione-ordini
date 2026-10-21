package it.limber.ordini.catalog.adapter.in.web;

import it.limber.ordini.catalog.application.ProductService;
import it.limber.ordini.catalog.application.ProductService.ProductCommand;
import it.limber.ordini.catalog.application.ProductService.ProductFilter;
import it.limber.ordini.catalog.application.ProductService.ProductView;
import it.limber.ordini.shared.web.PageResponse;
import it.limber.ordini.shared.web.PageableFactory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/products")
class ProductController {

	private static final Set<String> SORTABLE = Set.of("name", "sku", "unitPrice", "createdAt");

	record ProductRequest(
			@NotBlank @Size(max = 40) @Pattern(regexp = "[A-Za-z0-9._-]+",
					message = "ammessi solo lettere, numeri, punto, trattino e underscore") String sku,
			@NotBlank @Size(max = 150) String name, @Size(max = 2000) String description, @NotNull UUID categoryId,
			@NotNull @DecimalMin("0.00") @Digits(integer = 10, fraction = 2) BigDecimal unitPrice,
			@NotNull BigDecimal vatRate) {

		ProductCommand toCommand() {
			return new ProductCommand(sku, name, description, categoryId, unitPrice, vatRate);
		}

	}

	record ActiveRequest(@NotNull Boolean active) {
	}

	private final ProductService products;

	ProductController(ProductService products) {
		this.products = products;
	}

	@GetMapping
	PageResponse<ProductView> search(@RequestParam(required = false) String q,
			@RequestParam(required = false) UUID categoryId, @RequestParam(required = false) Boolean active,
			@RequestParam(defaultValue = "0") @Min(0) int page,
			@RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
			@RequestParam(required = false) String sort) {
		var pageable = PageableFactory.of(page, size, sort, SORTABLE, Sort.by("name").and(Sort.by("id")));
		return PageResponse.from(products.search(new ProductFilter(q, categoryId, active), pageable), view -> view);
	}

	@GetMapping("/{id}")
	ProductView get(@PathVariable UUID id) {
		return products.get(id);
	}

	@PostMapping
	@PreAuthorize("hasRole('ADMIN')")
	ResponseEntity<ProductView> create(@Valid @RequestBody ProductRequest request) {
		ProductView created = products.create(request.toCommand());
		URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(created.id()).toUri();
		return ResponseEntity.created(location).body(created);
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasRole('ADMIN')")
	ProductView update(@PathVariable UUID id, @Valid @RequestBody ProductRequest request) {
		return products.update(id, request.toCommand());
	}

	@PatchMapping("/{id}/active")
	@PreAuthorize("hasRole('ADMIN')")
	ProductView setActive(@PathVariable UUID id, @Valid @RequestBody ActiveRequest request) {
		return products.setActive(id, request.active());
	}

}
