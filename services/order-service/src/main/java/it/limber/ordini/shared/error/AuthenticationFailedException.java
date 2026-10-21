package it.limber.ordini.shared.error;

/** Credenziali o token di refresh non validi: diventa una risposta 401. */
public class AuthenticationFailedException extends RuntimeException {

	public AuthenticationFailedException(String message) {
		super(message);
	}

}
