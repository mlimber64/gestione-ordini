package it.limber.ordini.payment.domain;

/**
 * Stati di un pagamento. Da {@code PENDING} si va a {@code PAID} (incassato) o {@code FAILED} (non andato a buon
 * fine); solo un pagamento incassato si può rimborsare. {@code FAILED} e {@code REFUNDED} sono finali.
 */
public enum PaymentStatus {

	PENDING, PAID, FAILED, REFUNDED;

	/** I pagamenti in attesa e incassati occupano una parte dell'importo dell'ordine; gli altri no. */
	public boolean countsTowardsOrder() {
		return this == PENDING || this == PAID;
	}

}
