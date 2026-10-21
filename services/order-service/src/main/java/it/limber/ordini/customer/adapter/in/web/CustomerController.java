package it.limber.ordini.customer.adapter.in.web;

import it.limber.ordini.customer.application.CustomerService;
import it.limber.ordini.customer.application.CustomerService.AddressCommand;
import it.limber.ordini.customer.application.CustomerService.AddressView;
import it.limber.ordini.customer.application.CustomerService.CustomerCommand;
import it.limber.ordini.customer.application.CustomerService.CustomerSummary;
import it.limber.ordini.customer.application.CustomerService.CustomerView;
import it.limber.ordini.customer.domain.AddressType;
import it.limber.ordini.customer.domain.CustomerStatus;
import it.limber.ordini.shared.validation.PartitaIva;
import it.limber.ordini.shared.web.PageResponse;
import it.limber.ordini.shared.web.PageableFactory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/customers")
class CustomerController {

	private static final Set<String> SORTABLE = Set.of("code", "name", "email", "createdAt");

	private static final String WRITE = "hasAnyRole('ADMIN','OPERATOR')";

	record CustomerRequest(@NotBlank @Size(max = 150) String name, @NotBlank @Email @Size(max = 160) String email,
			@Size(max = 30) String phone, @PartitaIva String vatNumber,
			@Pattern(regexp = "^([A-Za-z0-9]{16}|[0-9]{11})?$",
					message = "il codice fiscale deve avere 16 caratteri alfanumerici (o 11 cifre per le società)") String taxCode) {

		CustomerCommand toCommand() {
			return new CustomerCommand(name, email, phone, vatNumber, taxCode);
		}

	}

	record AddressRequest(@NotNull AddressType type, @NotBlank @Size(max = 200) String street,
			@NotBlank @Size(max = 100) String city,
			@NotBlank @Pattern(regexp = "^[A-Za-z]{2}$", message = "la provincia deve avere 2 lettere") String province,
			@NotBlank @Pattern(regexp = "^[0-9]{5}$", message = "il CAP deve avere 5 cifre") String postalCode,
			@Pattern(regexp = "^([A-Za-z]{2})?$", message = "il paese deve avere 2 lettere") String country,
			boolean defaultAddress) {

		AddressCommand toCommand() {
			return new AddressCommand(type, street, city, province, postalCode, country, defaultAddress);
		}

	}

	private final CustomerService customers;

	CustomerController(CustomerService customers) {
		this.customers = customers;
	}

	@GetMapping
	PageResponse<CustomerSummary> search(@RequestParam(required = false) String q,
			@RequestParam(required = false) CustomerStatus status, @RequestParam(defaultValue = "0") @Min(0) int page,
			@RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
			@RequestParam(required = false) String sort) {
		var pageable = PageableFactory.of(page, size, sort, SORTABLE, Sort.by("name").and(Sort.by("id")));
		return PageResponse.from(customers.search(q, status, pageable), summary -> summary);
	}

	@GetMapping("/{id}")
	CustomerView get(@PathVariable UUID id) {
		return customers.get(id);
	}

	@PostMapping
	@PreAuthorize(WRITE)
	ResponseEntity<CustomerView> create(@Valid @RequestBody CustomerRequest request) {
		CustomerView created = customers.create(request.toCommand());
		URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(created.id()).toUri();
		return ResponseEntity.created(location).body(created);
	}

	@PutMapping("/{id}")
	@PreAuthorize(WRITE)
	CustomerView update(@PathVariable UUID id, @Valid @RequestBody CustomerRequest request) {
		return customers.update(id, request.toCommand());
	}

	/** Cancellazione logica: il cliente passa allo stato BLOCKED. */
	@DeleteMapping("/{id}")
	@PreAuthorize(WRITE)
	ResponseEntity<Void> block(@PathVariable UUID id) {
		customers.block(id);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/{id}/addresses")
	@PreAuthorize(WRITE)
	ResponseEntity<AddressView> addAddress(@PathVariable UUID id, @Valid @RequestBody AddressRequest request) {
		AddressView created = customers.addAddress(id, request.toCommand());
		URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{addressId}").buildAndExpand(created.id()).toUri();
		return ResponseEntity.created(location).body(created);
	}

	@PutMapping("/{id}/addresses/{addressId}")
	@PreAuthorize(WRITE)
	AddressView updateAddress(@PathVariable UUID id, @PathVariable UUID addressId,
			@Valid @RequestBody AddressRequest request) {
		return customers.updateAddress(id, addressId, request.toCommand());
	}

	@DeleteMapping("/{id}/addresses/{addressId}")
	@PreAuthorize(WRITE)
	ResponseEntity<Void> deleteAddress(@PathVariable UUID id, @PathVariable UUID addressId) {
		customers.deleteAddress(id, addressId);
		return ResponseEntity.noContent().build();
	}

}
