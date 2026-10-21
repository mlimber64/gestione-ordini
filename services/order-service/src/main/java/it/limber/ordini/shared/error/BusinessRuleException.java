package it.limber.ordini.shared.error;

/** Richiesta ben formata ma che viola una regola di business: diventa una risposta 422. */
public class BusinessRuleException extends RuntimeException {

	public BusinessRuleException(String message) {
		super(message);
	}

}
