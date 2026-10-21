package it.limber.ordini.customer.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "customer")
public class Customer {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@Column(nullable = false, updatable = false, length = 20)
	private String code;

	@Column(nullable = false, length = 150)
	private String name;

	@Column(nullable = false, length = 160)
	private String email;

	@Column(length = 30)
	private String phone;

	@Column(name = "vat_number", length = 11)
	private String vatNumber;

	@Column(name = "tax_code", length = 16)
	private String taxCode;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private CustomerStatus status = CustomerStatus.ACTIVE;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@Version
	private Long version;

	@OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, orphanRemoval = true)
	private List<Address> addresses = new ArrayList<>();

	protected Customer() {
	}

	public Customer(String code, String name, String email, String phone, String vatNumber, String taxCode) {
		this.code = code;
		updateDetails(name, email, phone, vatNumber, taxCode);
	}

	public void updateDetails(String name, String email, String phone, String vatNumber, String taxCode) {
		this.name = name.trim();
		this.email = email.trim().toLowerCase();
		this.phone = blankToNull(phone);
		this.vatNumber = blankToNull(vatNumber);
		this.taxCode = taxCode == null || taxCode.isBlank() ? null : taxCode.trim().toUpperCase();
	}

	public void block() {
		this.status = CustomerStatus.BLOCKED;
	}

	public Address addAddress(AddressType type, String street, String city, String province, String postalCode,
			String country, boolean defaultAddress) {
		Address address = new Address(this, type, street, city, province, postalCode, country, defaultAddress);
		addresses.add(address);
		return address;
	}

	public Optional<Address> findAddress(UUID addressId) {
		return addresses.stream().filter(address -> addressId.equals(address.getId())).findFirst();
	}

	public void removeAddress(Address address) {
		addresses.remove(address);
	}

	public void updateAddress(Address address, AddressType type, String street, String city, String province,
			String postalCode, String country, boolean defaultAddress) {
		address.update(type, street, city, province, postalCode, country, defaultAddress);
	}

	/** Toglie il flag di predefinito agli altri indirizzi dello stesso tipo. */
	public void clearDefaultsOfType(AddressType type, Address except) {
		addresses.stream()
			.filter(address -> address != except && address.getType() == type && address.isDefaultAddress())
			.forEach(address -> address.setDefaultAddress(false));
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

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	public UUID getId() {
		return id;
	}

	public String getCode() {
		return code;
	}

	public String getName() {
		return name;
	}

	public String getEmail() {
		return email;
	}

	public String getPhone() {
		return phone;
	}

	public String getVatNumber() {
		return vatNumber;
	}

	public String getTaxCode() {
		return taxCode;
	}

	public CustomerStatus getStatus() {
		return status;
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

	public List<Address> getAddresses() {
		return Collections.unmodifiableList(addresses);
	}

}
