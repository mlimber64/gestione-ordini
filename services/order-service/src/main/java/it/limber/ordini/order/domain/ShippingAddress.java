package it.limber.ordini.order.domain;

/** Indirizzo di consegna copiato nell'ordine: non cambia se poi cambia l'anagrafica del cliente. */
public record ShippingAddress(String street, String city, String province, String postalCode, String country) {
}
