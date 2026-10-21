package it.limber.ordini.identity.application;

/** Coppia di token restituita al login e al refresh. {@code expiresIn} è la durata del token di accesso in secondi. */
public record TokenPair(String accessToken, String refreshToken, String tokenType, long expiresIn) {

	public static TokenPair bearer(String accessToken, String refreshToken, long expiresIn) {
		return new TokenPair(accessToken, refreshToken, "Bearer", expiresIn);
	}

}
