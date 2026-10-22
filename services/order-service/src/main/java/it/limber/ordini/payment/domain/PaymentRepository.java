package it.limber.ordini.payment.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Porta di uscita dei pagamenti. */
public interface PaymentRepository {

	Optional<Payment> findById(UUID id);

	/** I pagamenti di un ordine, dal più vecchio. */
	List<Payment> findByOrder(UUID orderId);

	void insert(Payment payment);

	/**
	 * Salva il nuovo stato. Fallisce con un errore di modifica concorrente se nel frattempo qualcun altro ha già
	 * modificato lo stesso pagamento.
	 */
	void update(Payment payment);

	/**
	 * Blocca, fino alla fine della transazione, la registrazione di altri pagamenti per lo stesso ordine: due
	 * richieste simultanee non possono così superare insieme l'importo dell'ordine.
	 */
	void lockOrder(UUID orderId);

}
