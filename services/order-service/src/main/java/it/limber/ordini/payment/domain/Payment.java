package it.limber.ordini.payment.domain;

import it.limber.ordini.shared.error.BusinessRuleException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

/**
 * Un pagamento di un ordine, con le regole delle sue transizioni. Come l'ordine non dipende da Spring né dal
 * database, quindi si prova con un semplice test unitario.
 */
public final class Payment {

	private static final int MAX_REFERENCE = 100;

	private final UUID id;

	private final UUID orderId;

	private final PaymentMethod method;

	private final BigDecimal amount;

	private final String reference;

	private final String createdBy;

	private final Instant createdAt;

	private final long version;

	private PaymentStatus status;

	private String updatedBy;

	private Instant updatedAt;

	private Instant paidAt;

	// La firma lunga serve a ricostruire il pagamento con tutti i suoi campi
	@SuppressWarnings("java:S107")
	private Payment(UUID id, UUID orderId, PaymentMethod method, BigDecimal amount, String reference,
			PaymentStatus status, String createdBy, Instant createdAt, String updatedBy, Instant updatedAt,
			Instant paidAt, long version) {
		this.id = id;
		this.orderId = orderId;
		this.method = method;
		this.amount = amount;
		this.reference = reference;
		this.status = status;
		this.createdBy = createdBy;
		this.createdAt = createdAt;
		this.updatedBy = updatedBy;
		this.updatedAt = updatedAt;
		this.paidAt = paidAt;
		this.version = version;
	}

	/** Registra un pagamento nuovo, in attesa. */
	public static Payment register(UUID id, UUID orderId, PaymentMethod method, BigDecimal amount, String reference,
			String actor, Instant now) {
		if (method == null) {
			throw new BusinessRuleException("Indica il metodo di pagamento");
		}
		if (amount == null || amount.signum() <= 0) {
			throw new BusinessRuleException("L'importo del pagamento deve essere maggiore di zero");
		}
		if (amount.scale() > 2 && amount.stripTrailingZeros().scale() > 2) {
			throw new BusinessRuleException("L'importo può avere al massimo due decimali");
		}
		String cleanReference = reference == null || reference.isBlank() ? null : reference.trim();
		if (cleanReference != null && cleanReference.length() > MAX_REFERENCE) {
			throw new BusinessRuleException("Il riferimento non può superare " + MAX_REFERENCE + " caratteri");
		}
		return new Payment(id, orderId, method, amount.setScale(2, RoundingMode.UNNECESSARY), cleanReference,
				PaymentStatus.PENDING, actor, now, actor, now, null, 0);
	}

	/** Ricostruisce un pagamento già salvato. */
	@SuppressWarnings("java:S107")
	public static Payment restore(UUID id, UUID orderId, PaymentMethod method, BigDecimal amount, String reference,
			PaymentStatus status, String createdBy, Instant createdAt, String updatedBy, Instant updatedAt,
			Instant paidAt, long version) {
		return new Payment(id, orderId, method, amount, reference, status, createdBy, createdAt, updatedBy, updatedAt,
				paidAt, version);
	}

	/** Il denaro è arrivato. */
	public void markPaid(String actor, Instant now) {
		requireStatus(PaymentStatus.PENDING, PaymentStatus.PAID);
		paidAt = now;
		moveTo(PaymentStatus.PAID, actor, now);
	}

	/** Il pagamento non è andato a buon fine (carta rifiutata, bonifico mai arrivato). */
	public void markFailed(String actor, Instant now) {
		requireStatus(PaymentStatus.PENDING, PaymentStatus.FAILED);
		moveTo(PaymentStatus.FAILED, actor, now);
	}

	/** Restituisce il denaro al cliente: vale solo per ciò che era stato incassato. */
	public void refund(String actor, Instant now) {
		requireStatus(PaymentStatus.PAID, PaymentStatus.REFUNDED);
		moveTo(PaymentStatus.REFUNDED, actor, now);
	}

	private void requireStatus(PaymentStatus required, PaymentStatus target) {
		if (status != required) {
			throw new BusinessRuleException(
					"Transizione non consentita: un pagamento %s non può passare a %s".formatted(status, target));
		}
	}

	private void moveTo(PaymentStatus target, String actor, Instant now) {
		status = target;
		updatedBy = actor;
		updatedAt = now;
	}

	public UUID id() {
		return id;
	}

	public UUID orderId() {
		return orderId;
	}

	public PaymentMethod method() {
		return method;
	}

	public BigDecimal amount() {
		return amount;
	}

	public String reference() {
		return reference;
	}

	public PaymentStatus status() {
		return status;
	}

	public String createdBy() {
		return createdBy;
	}

	public Instant createdAt() {
		return createdAt;
	}

	public String updatedBy() {
		return updatedBy;
	}

	public Instant updatedAt() {
		return updatedAt;
	}

	public Instant paidAt() {
		return paidAt;
	}

	/** Versione letta dal database: serve a rifiutare la modifica di chi lavora su dati ormai superati. */
	public long version() {
		return version;
	}

}
