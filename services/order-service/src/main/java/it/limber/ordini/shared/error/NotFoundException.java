package it.limber.ordini.shared.error;

/** Risorsa inesistente: diventa una risposta 404. */
public class NotFoundException extends RuntimeException {

	public NotFoundException(String message) {
		super(message);
	}

}
