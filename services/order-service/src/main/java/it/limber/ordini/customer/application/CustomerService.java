package it.limber.ordini.customer.application;

import it.limber.ordini.customer.domain.Address;
import it.limber.ordini.customer.domain.AddressType;
import it.limber.ordini.customer.domain.Customer;
import it.limber.ordini.customer.domain.CustomerRepository;
import it.limber.ordini.customer.domain.CustomerStatus;
import it.limber.ordini.shared.error.ConflictException;
import it.limber.ordini.shared.error.NotFoundException;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class CustomerService {

	public record CustomerCommand(String name, String email, String phone, String vatNumber, String taxCode) {
	}

	public record AddressCommand(AddressType type, String street, String city, String province, String postalCode,
			String country, boolean defaultAddress) {
	}

	public record AddressView(UUID id, AddressType type, String street, String city, String province,
			String postalCode, String country, boolean defaultAddress) {

		static AddressView of(Address address) {
			return new AddressView(address.getId(), address.getType(), address.getStreet(), address.getCity(),
					address.getProvince(), address.getPostalCode(), address.getCountry(), address.isDefaultAddress());
		}

	}

	public record CustomerSummary(UUID id, String code, String name, String email, String vatNumber,
			CustomerStatus status) {

		static CustomerSummary of(Customer customer) {
			return new CustomerSummary(customer.getId(), customer.getCode(), customer.getName(), customer.getEmail(),
					customer.getVatNumber(), customer.getStatus());
		}

	}

	public record CustomerView(UUID id, String code, String name, String email, String phone, String vatNumber,
			String taxCode, CustomerStatus status, java.time.Instant createdAt, java.time.Instant updatedAt,
			List<AddressView> addresses) {

		static CustomerView of(Customer customer) {
			return new CustomerView(customer.getId(), customer.getCode(), customer.getName(), customer.getEmail(),
					customer.getPhone(), customer.getVatNumber(), customer.getTaxCode(), customer.getStatus(),
					customer.getCreatedAt(), customer.getUpdatedAt(),
					customer.getAddresses().stream().map(AddressView::of).toList());
		}

	}

	private final CustomerRepository customers;

	public CustomerService(CustomerRepository customers) {
		this.customers = customers;
	}

	@Transactional(readOnly = true)
	public Page<CustomerSummary> search(String query, CustomerStatus status, Pageable pageable) {
		return customers.findAll(filter(query, status), pageable).map(CustomerSummary::of);
	}

	@Transactional(readOnly = true)
	public CustomerView get(UUID id) {
		return CustomerView.of(find(id));
	}

	@Transactional
	public CustomerView create(CustomerCommand command) {
		String email = command.email().trim().toLowerCase();
		String vat = blankToNull(command.vatNumber());
		if (customers.existsByEmail(email)) {
			throw new ConflictException("Esiste già un cliente con l'email " + email);
		}
		if (vat != null && customers.existsByVatNumber(vat)) {
			throw new ConflictException("Esiste già un cliente con la partita IVA " + vat);
		}
		String code = "CLI-%06d".formatted(customers.nextCodeNumber());
		Customer customer = new Customer(code, command.name(), command.email(), command.phone(), vat,
				command.taxCode());
		return CustomerView.of(customers.save(customer));
	}

	@Transactional
	public CustomerView update(UUID id, CustomerCommand command) {
		Customer customer = find(id);
		String email = command.email().trim().toLowerCase();
		String vat = blankToNull(command.vatNumber());
		if (customers.existsByEmailAndIdNot(email, id)) {
			throw new ConflictException("Esiste già un cliente con l'email " + email);
		}
		if (vat != null && customers.existsByVatNumberAndIdNot(vat, id)) {
			throw new ConflictException("Esiste già un cliente con la partita IVA " + vat);
		}
		customer.updateDetails(command.name(), command.email(), command.phone(), vat, command.taxCode());
		customers.flush();
		return CustomerView.of(customer);
	}

	/** Cancellazione logica: il cliente resta nei dati (e negli ordini storici) ma risulta bloccato. */
	@Transactional
	public void block(UUID id) {
		find(id).block();
	}

	@Transactional
	public AddressView addAddress(UUID customerId, AddressCommand command) {
		Customer customer = find(customerId);
		if (command.defaultAddress()) {
			customer.clearDefaultsOfType(command.type(), null);
			customers.flush();
		}
		Address address = customer.addAddress(command.type(), command.street(), command.city(), command.province(),
				command.postalCode(), command.country(), command.defaultAddress());
		customers.flush();
		return AddressView.of(address);
	}

	@Transactional
	public AddressView updateAddress(UUID customerId, UUID addressId, AddressCommand command) {
		Customer customer = find(customerId);
		Address address = findAddress(customer, addressId);
		if (command.defaultAddress()) {
			customer.clearDefaultsOfType(command.type(), address);
			customers.flush();
		}
		customer.updateAddress(address, command.type(), command.street(), command.city(), command.province(),
				command.postalCode(), command.country(), command.defaultAddress());
		customers.flush();
		return AddressView.of(address);
	}

	@Transactional
	public void deleteAddress(UUID customerId, UUID addressId) {
		Customer customer = find(customerId);
		customer.removeAddress(findAddress(customer, addressId));
	}

	private Customer find(UUID id) {
		return customers.findById(id).orElseThrow(() -> new NotFoundException("Cliente non trovato: " + id));
	}

	private static Address findAddress(Customer customer, UUID addressId) {
		return customer.findAddress(addressId)
			.orElseThrow(() -> new NotFoundException("Indirizzo non trovato: " + addressId));
	}

	private static Specification<Customer> filter(String query, CustomerStatus status) {
		return (root, cq, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (status != null) {
				predicates.add(cb.equal(root.get("status"), status));
			}
			if (query != null && !query.isBlank()) {
				String pattern = "%" + query.trim().toLowerCase(Locale.ROOT) + "%";
				predicates.add(cb.or(cb.like(cb.lower(root.get("name")), pattern),
						cb.like(cb.lower(root.get("email")), pattern), cb.like(cb.lower(root.get("code")), pattern),
						cb.like(root.get("vatNumber"), pattern)));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

}
