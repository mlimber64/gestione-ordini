package it.limber.ordini.payment.domain;

/** Come paga il cliente. Il contrassegno resta «in attesa» finché non si incassa alla consegna. */
public enum PaymentMethod {

	BANK_TRANSFER, CARD, CASH_ON_DELIVERY

}
