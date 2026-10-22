package it.limber.ordini.identity.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;

/**
 * Il cookie del token di refresh (ADR 0020): {@code HttpOnly}, {@code SameSite=Strict}, limitato a {@code /api/v1/auth},
 * «di sessione» e {@code Secure} quando la richiesta arriva in HTTPS. Vale per i due modi di accesso.
 */
final class RefreshCookie {

	static final String NAME = "gestione_ordini_refresh";

	private static final String PATH = "/api/v1/auth";

	private RefreshCookie() {
	}

	static String set(String token, HttpServletRequest http) {
		return builder(token, http).build().toString();
	}

	static String clear(HttpServletRequest http) {
		return builder("", http).maxAge(0).build().toString();
	}

	private static ResponseCookie.ResponseCookieBuilder builder(String value, HttpServletRequest http) {
		return ResponseCookie.from(NAME, value).httpOnly(true).secure(http.isSecure()).sameSite("Strict").path(PATH);
	}

}
