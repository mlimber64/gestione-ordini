package it.limber.ordini.identity.application;

/**
 * Porta di uscita: l'identity provider esterno (Authorization Code con PKCE). Order-service non vede mai la password
 * dell'utente: la digita nella pagina di accesso del provider.
 */
public interface OidcProvider {

	/** Indirizzo della pagina di accesso del provider a cui mandare il browser. */
	String authorizationUrl(String redirectUri, String state, String codeChallenge);

	/** Scambia il codice ricevuto al ritorno dal provider con i token. */
	OidcTokens exchangeCode(String code, String redirectUri, String codeVerifier);

	/** Rinnova l'accesso con il token di refresh del provider (che ne restituisce uno nuovo). */
	OidcTokens refresh(String refreshToken);

	/** Chiude la sessione presso il provider, così il prossimo accesso chiede di nuovo le credenziali. */
	void logout(String refreshToken);

	record OidcTokens(String accessToken, String refreshToken, long expiresIn) {
	}

}
