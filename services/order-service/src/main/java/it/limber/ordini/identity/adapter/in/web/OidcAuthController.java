package it.limber.ordini.identity.adapter.in.web;

import it.limber.ordini.identity.application.OidcProvider;
import it.limber.ordini.identity.application.OidcProvider.OidcTokens;
import it.limber.ordini.shared.auth.OidcAuth;
import it.limber.ordini.shared.error.AuthenticationFailedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

/**
 * Accesso tramite un identity provider esterno con Authorization Code e PKCE (ADR 0021). L'utente digita le
 * credenziali nella pagina di Keycloak, mai da noi. Order-service fa da «backend dell'interfaccia»: scambia il codice
 * con i token (usando il segreto del client, che il browser non vede), tiene nel cookie {@code HttpOnly} il token di
 * refresh del provider (ADR 0020) e al browser restituisce solo il token di accesso, come in modalità locale.
 */
@RestController
@OidcAuth
@RequestMapping("/api/v1/auth")
class OidcAuthController {

	private static final String STATE_COOKIE = "gestione_ordini_oidc";

	private static final String STATE_PATH = "/api/v1/auth/oidc";

	private static final String CALLBACK = "/api/v1/auth/oidc/callback";

	private static final SecureRandom RANDOM = new SecureRandom();

	private final OidcProvider provider;

	OidcAuthController(OidcProvider provider) {
		this.provider = provider;
	}

	/** Manda il browser alla pagina di accesso del provider, ricordando stato e verifica PKCE in un cookie breve. */
	@GetMapping("/oidc/login")
	void login(HttpServletRequest http, HttpServletResponse response) throws IOException {
		String state = randomToken();
		String verifier = randomToken();
		response.addHeader(HttpHeaders.SET_COOKIE, stateCookie(state + "." + verifier, Duration.ofMinutes(5), http));
		response.sendRedirect(provider.authorizationUrl(redirectUri(http), state, challenge(verifier)));
	}

	/** Al ritorno dal provider: controlla lo stato, scambia il codice e apre la sessione con il cookie di refresh. */
	@GetMapping("/oidc/callback")
	void callback(@RequestParam(required = false) String code, @RequestParam(required = false) String state,
			@RequestParam(required = false) String error,
			@CookieValue(name = STATE_COOKIE, required = false) String saved, HttpServletRequest http,
			HttpServletResponse response) throws IOException {
		response.addHeader(HttpHeaders.SET_COOKIE, stateCookie("", Duration.ZERO, http));
		String[] parts = saved == null ? new String[0] : saved.split("[.]", 2);
		if (error != null || code == null || state == null || parts.length != 2 || !state.equals(parts[0])) {
			response.sendRedirect("/login?error=oidc");
			return;
		}
		try {
			OidcTokens tokens = provider.exchangeCode(code, redirectUri(http), parts[1]);
			response.addHeader(HttpHeaders.SET_COOKIE, RefreshCookie.set(tokens.refreshToken(), http));
			response.sendRedirect("/");
		}
		catch (AuthenticationFailedException ex) {
			response.sendRedirect("/login?error=oidc");
		}
	}

	@PostMapping("/refresh")
	ResponseEntity<?> refresh(@CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken,
			HttpServletRequest http) {
		try {
			if (refreshToken == null || refreshToken.isBlank()) {
				throw new AuthenticationFailedException("Sessione non valida o scaduta");
			}
			OidcTokens tokens = provider.refresh(refreshToken);
			return ResponseEntity.ok()
				.header(HttpHeaders.SET_COOKIE, RefreshCookie.set(tokens.refreshToken(), http))
				.body(new AuthController.AccessTokenResponse(tokens.accessToken(), "Bearer", tokens.expiresIn()));
		}
		catch (AuthenticationFailedException ex) {
			ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
			problem.setTitle("Autenticazione non riuscita");
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
				.header(HttpHeaders.SET_COOKIE, RefreshCookie.clear(http))
				.body(problem);
		}
	}

	/** Chiude la sessione anche presso il provider, altrimenti il prossimo accesso entrerebbe senza chiedere nulla. */
	@PostMapping("/logout")
	ResponseEntity<Void> logout(@CookieValue(name = RefreshCookie.NAME, required = false) String refreshToken,
			HttpServletRequest http) {
		if (refreshToken != null && !refreshToken.isBlank()) {
			provider.logout(refreshToken);
		}
		return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, RefreshCookie.clear(http)).build();
	}

	private static String redirectUri(HttpServletRequest http) {
		return ServletUriComponentsBuilder.fromContextPath(http).path(CALLBACK).build().toUriString();
	}

	private static String stateCookie(String value, Duration maxAge, HttpServletRequest http) {
		return ResponseCookie.from(STATE_COOKIE, value)
			.httpOnly(true)
			.secure(http.isSecure())
			// Lax: il ritorno dal provider è una navigazione da un altro sito e con Strict il browser non manderebbe il cookie
			.sameSite("Lax")
			.path(STATE_PATH)
			.maxAge(maxAge)
			.build()
			.toString();
	}

	private static String randomToken() {
		byte[] bytes = new byte[32];
		RANDOM.nextBytes(bytes);
		return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
	}

	private static String challenge(String verifier) {
		try {
			byte[] hash = MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII));
			return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException(ex);
		}
	}

}
