package it.limber.ordini.identity.adapter.in.web;

import it.limber.ordini.identity.application.AuthService;
import it.limber.ordini.identity.application.TokenPair;
import it.limber.ordini.shared.error.AuthenticationFailedException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Accesso con le credenziali dell'applicazione. Il token di accesso (breve) torna nel corpo e il browser lo tiene
 * in memoria; il token di refresh (lungo) non compare mai nel corpo: viaggia solo in un cookie {@code HttpOnly},
 * che il codice JavaScript della pagina non può leggere, quindi un XSS non riesce a rubarlo.
 *
 * <p>Il cookie è {@code SameSite=Strict} (il browser non lo manda nelle richieste che partono da altri siti, il che
 * protegge refresh e logout da richieste falsificate), vale solo per {@code /api/v1/auth} ed è «di sessione»: si
 * perde alla chiusura del browser. È {@code Secure} quando la richiesta arriva in HTTPS.
 */
@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

	static final String REFRESH_COOKIE = "gestione_ordini_refresh";

	private static final String COOKIE_PATH = "/api/v1/auth";

	record LoginRequest(@NotBlank String username, @NotBlank String password) {
	}

	/** Risposta di login e refresh: solo il token di accesso. */
	record AccessTokenResponse(String accessToken, String tokenType, long expiresIn) {

		static AccessTokenResponse of(TokenPair pair) {
			return new AccessTokenResponse(pair.accessToken(), pair.tokenType(), pair.expiresIn());
		}

	}

	private final AuthService auth;

	AuthController(AuthService auth) {
		this.auth = auth;
	}

	@PostMapping("/login")
	ResponseEntity<AccessTokenResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
		return issued(auth.login(request.username(), request.password()), http);
	}

	/** Rinnova la sessione con il token di refresh del cookie e ne mette nel cookie uno nuovo. */
	@PostMapping("/refresh")
	ResponseEntity<?> refresh(@CookieValue(name = REFRESH_COOKIE, required = false) String refreshToken,
			HttpServletRequest http) {
		try {
			return issued(auth.refresh(refreshToken == null ? "" : refreshToken), http);
		}
		catch (AuthenticationFailedException ex) {
			// Un cookie non valido o scaduto non serve a niente: si toglie insieme alla risposta di errore
			ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
			problem.setTitle("Autenticazione non riuscita");
			return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
				.header(HttpHeaders.SET_COOKIE, cookie("", http).maxAge(0).build().toString())
				.body(problem);
		}
	}

	/** Chiude la sessione: toglie il cookie di refresh. Il token di accesso, non revocabile, scade da solo. */
	@PostMapping("/logout")
	ResponseEntity<Void> logout(HttpServletRequest http) {
		return ResponseEntity.noContent()
			.header(HttpHeaders.SET_COOKIE, cookie("", http).maxAge(0).build().toString())
			.build();
	}

	private static ResponseEntity<AccessTokenResponse> issued(TokenPair pair, HttpServletRequest http) {
		return ResponseEntity.ok()
			.header(HttpHeaders.SET_COOKIE, cookie(pair.refreshToken(), http).build().toString())
			.body(AccessTokenResponse.of(pair));
	}

	private static ResponseCookie.ResponseCookieBuilder cookie(String value, HttpServletRequest http) {
		return ResponseCookie.from(REFRESH_COOKIE, value)
			.httpOnly(true)
			.secure(http.isSecure())
			.sameSite("Strict")
			.path(COOKIE_PATH);
	}

}
