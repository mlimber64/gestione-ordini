package it.limber.ordini.identity;

import com.jayway.jsonpath.JsonPath;
import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.IntegrationTest;
import it.limber.ordini.identity.domain.Role;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasKey;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class AuthIntegrationTest extends ApiTestSupport {

	private String loginBody(String username, String password) {
		return "{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password);
	}

	private static final String REFRESH_COOKIE = "gestione_ordini_refresh";

	private MockHttpServletResponse login() throws Exception {
		return mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content(loginBody("admin", ADMIN_PASSWORD))).andReturn().getResponse();
	}

	private String refreshTokenOf(MockHttpServletResponse response) {
		Cookie cookie = response.getCookie(REFRESH_COOKIE);
		assertThat(cookie).isNotNull();
		return cookie.getValue();
	}

	@Test
	void il_login_con_credenziali_corrette_restituisce_il_token_di_accesso_nel_corpo() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content(loginBody("admin", ADMIN_PASSWORD)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isNotEmpty())
			.andExpect(jsonPath("$.tokenType").value("Bearer"))
			.andExpect(jsonPath("$.expiresIn").value(900));
	}

	@Test
	void il_token_di_refresh_non_compare_nel_corpo_ma_solo_in_un_cookie_http_only() throws Exception {
		MockHttpServletResponse response = login();

		assertThat(response.getContentAsString()).doesNotContain("refresh");
		String cookie = response.getHeader("Set-Cookie");
		assertThat(cookie).startsWith(REFRESH_COOKIE + "=")
			.contains("HttpOnly")
			.contains("SameSite=Strict")
			.contains("Path=/api/v1/auth")
			// Cookie «di sessione»: nessuna scadenza, si perde alla chiusura del browser
			.doesNotContain("Max-Age")
			.doesNotContain("Expires")
			// La richiesta di prova è in HTTP: il flag Secure compare solo dietro HTTPS
			.doesNotContain("Secure");
	}

	@Test
	void dietro_https_il_cookie_e_anche_secure() throws Exception {
		String cookie = mvc.perform(post("/api/v1/auth/login").secure(true)
			.contentType(MediaType.APPLICATION_JSON)
			.content(loginBody("admin", ADMIN_PASSWORD))).andReturn().getResponse().getHeader("Set-Cookie");

		assertThat(cookie).contains("Secure").contains("HttpOnly");
	}

	@Test
	void il_login_con_password_errata_restituisce_401_in_formato_problem_json() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content(loginBody("admin", "password-sbagliata")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.status").value(401))
			.andExpect(jsonPath("$.title").value("Autenticazione non riuscita"));
	}

	@Test
	void il_login_con_utente_inesistente_restituisce_lo_stesso_errore() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content(loginBody("non-esiste", "qualunque-password")))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.detail").value("Credenziali non valide"));
	}

	@Test
	void il_login_senza_campi_obbligatori_restituisce_400() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"\"}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors").value(hasKey("username")))
			.andExpect(jsonPath("$.errors").value(hasKey("password")));
	}

	@Test
	void le_risorse_protette_richiedono_il_token() throws Exception {
		mvc.perform(get("/api/v1/customers"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.status").value(401));
		mvc.perform(get("/api/v1/customers").header("Authorization", "Bearer token.non.valido"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void un_token_valido_permette_di_leggere() throws Exception {
		getJson("/api/v1/customers", adminToken()).andExpect(status().isOk());
	}

	@Test
	void il_token_di_refresh_non_vale_come_token_di_accesso() throws Exception {
		String refresh = refreshTokenOf(login());

		getJson("/api/v1/customers", refresh).andExpect(status().isUnauthorized());
	}

	@Test
	void il_token_di_accesso_non_vale_come_token_di_refresh_e_il_cookie_si_toglie() throws Exception {
		MockHttpServletResponse response = mvc
			.perform(post("/api/v1/auth/refresh").cookie(new Cookie(REFRESH_COOKIE, adminToken())))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.title").value("Autenticazione non riuscita"))
			.andReturn()
			.getResponse();

		assertThat(response.getHeader("Set-Cookie")).contains(REFRESH_COOKIE + "=").contains("Max-Age=0");
	}

	@Test
	void il_refresh_senza_cookie_restituisce_401() throws Exception {
		mvc.perform(post("/api/v1/auth/refresh"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.status").value(401));
	}

	@Test
	void il_refresh_con_il_cookie_valido_emette_un_nuovo_accesso_e_ruota_il_cookie() throws Exception {
		String refresh = refreshTokenOf(login());

		MockHttpServletResponse refreshed = mvc
			.perform(post("/api/v1/auth/refresh").cookie(new Cookie(REFRESH_COOKIE, refresh)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isNotEmpty())
			.andExpect(jsonPath("$.refreshToken").doesNotExist())
			.andReturn()
			.getResponse();

		getJson("/api/v1/customers", JsonPath.read(refreshed.getContentAsString(), "$.accessToken"))
			.andExpect(status().isOk());
		// Il cookie nuovo ha gli stessi attributi di sicurezza
		assertThat(refreshed.getHeader("Set-Cookie")).contains("HttpOnly").contains("SameSite=Strict");
	}

	@Test
	void il_refresh_non_accetta_il_token_nel_corpo() throws Exception {
		String refresh = refreshTokenOf(login());

		mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
			.content("{\"refreshToken\":\"%s\"}".formatted(refresh))).andExpect(status().isUnauthorized());
	}

	@Test
	void il_logout_toglie_il_cookie() throws Exception {
		MockHttpServletResponse response = mvc.perform(post("/api/v1/auth/logout"))
			.andExpect(status().isNoContent())
			.andReturn()
			.getResponse();

		assertThat(response.getHeader("Set-Cookie")).startsWith(REFRESH_COOKIE + "=;")
			.contains("Max-Age=0")
			.contains("HttpOnly");
	}

	@Test
	void solo_l_amministratore_gestisce_gli_utenti() throws Exception {
		getJson("/api/v1/users", tokenFor(Role.OPERATOR)).andExpect(status().isForbidden());
		getJson("/api/v1/users", tokenFor(Role.VIEWER)).andExpect(status().isForbidden());
		getJson("/api/v1/users", adminToken()).andExpect(status().isOk());
	}

	@Test
	void l_amministratore_crea_un_utente_che_poi_puo_accedere() throws Exception {
		String username = unique("operatore");
		postJson("/api/v1/users", adminToken(),
				"{\"username\":\"%s\",\"password\":\"una-password-lunga\",\"role\":\"OPERATOR\"}".formatted(username))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.username").value(username))
			.andExpect(jsonPath("$.role").value("OPERATOR"))
			.andExpect(jsonPath("$.passwordHash").doesNotExist());

		getJson("/api/v1/customers", login(username, "una-password-lunga")).andExpect(status().isOk());
	}

	@Test
	void non_si_possono_creare_due_utenti_con_lo_stesso_username() throws Exception {
		String token = adminToken();
		String body = "{\"username\":\"duplicato-1\",\"password\":\"una-password-lunga\",\"role\":\"VIEWER\"}";
		postJson("/api/v1/users", token, body).andExpect(status().isCreated());
		postJson("/api/v1/users", token, body).andExpect(status().isConflict());
	}

	@Test
	void la_password_troppo_corta_viene_rifiutata() throws Exception {
		postJson("/api/v1/users", adminToken(), "{\"username\":\"corto\",\"password\":\"abc\",\"role\":\"VIEWER\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors").value(hasKey("password")));
	}

	@Test
	void salute_e_metriche_sono_aperte_per_prometheus_ma_gli_altri_endpoint_di_gestione_no() throws Exception {
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
		mvc.perform(get("/actuator/prometheus")).andExpect(status().isOk());
		// Qualunque altro endpoint di gestione resta riservato all'amministratore
		mvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
		getJson("/actuator/env", tokenFor(Role.OPERATOR)).andExpect(status().isForbidden());
	}

}
