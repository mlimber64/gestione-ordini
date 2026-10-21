package it.limber.ordini.shared.error;

/** Conflitto con i dati esistenti (duplicati, modifiche concorrenti): diventa una risposta 409. */
public class ConflictException extends RuntimeException {

	public ConflictException(String message) {
		super(message);
	}

}
