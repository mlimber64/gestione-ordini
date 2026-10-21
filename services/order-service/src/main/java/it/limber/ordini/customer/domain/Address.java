package it.limber.ordini.customer.domain;

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

import java.util.UUID;

@Entity
@Table(name = "address")
public class Address {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "customer_id", nullable = false)
	private Customer customer;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private AddressType type;

	@Column(nullable = false, length = 200)
	private String street;

	@Column(nullable = false, length = 100)
	private String city;

	@Column(nullable = false, length = 2)
	private String province;

	@Column(name = "postal_code", nullable = false, length = 5)
	private String postalCode;

	@Column(nullable = false, length = 2)
	private String country;

	@Column(name = "is_default", nullable = false)
	private boolean defaultAddress;

	protected Address() {
	}

	@SuppressWarnings("java:S107") // inizializza tutti i campi dell'indirizzo: raggrupparli in un oggetto aggiungerebbe solo un livello
	Address(Customer customer, AddressType type, String street, String city, String province, String postalCode,
			String country, boolean defaultAddress) {
		this.customer = customer;
		update(type, street, city, province, postalCode, country, defaultAddress);
	}

	void update(AddressType type, String street, String city, String province, String postalCode, String country,
			boolean defaultAddress) {
		this.type = type;
		this.street = street.trim();
		this.city = city.trim();
		this.province = province.trim().toUpperCase();
		this.postalCode = postalCode.trim();
		this.country = (country == null || country.isBlank()) ? "IT" : country.trim().toUpperCase();
		this.defaultAddress = defaultAddress;
	}

	void setDefaultAddress(boolean defaultAddress) {
		this.defaultAddress = defaultAddress;
	}

	public UUID getId() {
		return id;
	}

	public AddressType getType() {
		return type;
	}

	public String getStreet() {
		return street;
	}

	public String getCity() {
		return city;
	}

	public String getProvince() {
		return province;
	}

	public String getPostalCode() {
		return postalCode;
	}

	public String getCountry() {
		return country;
	}

	public boolean isDefaultAddress() {
		return defaultAddress;
	}

}
