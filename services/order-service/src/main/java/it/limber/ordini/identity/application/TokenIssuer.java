package it.limber.ordini.identity.application;

import it.limber.ordini.identity.domain.AppUser;

import java.util.Optional;

/** Porta di uscita: emissione e verifica dei token. L'implementazione concreta (JWT) sta in un adattatore. */
public interface TokenIssuer {

	TokenPair issue(AppUser user);

	/** Restituisce lo username contenuto in un token di refresh valido, altrimenti niente. */
	Optional<String> usernameFromRefreshToken(String refreshToken);

}
