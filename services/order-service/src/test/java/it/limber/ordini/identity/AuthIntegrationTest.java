package it.limber.ordini.identity;

import com.jayway.jsonpath.JsonPath;
import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.IntegrationTest;
import it.limber.ordini.identity.domain.Role;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

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

	@Test
	void il_login_con_credenziali_corrette_restituisce_i_token() throws Exception {
		mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content(loginBody("admin", ADMIN_PASSWORD)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isNotEmpty())
			.andExpect(jsonPath("$.refreshToken").isNotEmpty())
			.andExpect(jsonPath("$.tokenType").value("Bearer"))
			.andExpect(jsonPath("$.expiresIn").value(900));
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
		String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content(loginBody("admin", ADMIN_PASSWORD))).andReturn().getResponse().getContentAsString();
		String refresh = JsonPath.read(body, "$.refreshToken");

		getJson("/api/v1/customers", refresh).andExpect(status().isUnauthorized());
	}

	@Test
	void il_token_di_accesso_non_vale_come_token_di_refresh() throws Exception {
		mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
			.content("{\"refreshToken\":\"%s\"}".formatted(adminToken()))).andExpect(status().isUnauthorized());
	}

	@Test
	void il_refresh_con_token_valido_emette_nuovi_token() throws Exception {
		String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content(loginBody("admin", ADMIN_PASSWORD))).andReturn().getResponse().getContentAsString();
		String refresh = JsonPath.read(body, "$.refreshToken");

		String refreshed = mvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
			.content("{\"refreshToken\":\"%s\"}".formatted(refresh)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.accessToken").isNotEmpty())
			.andReturn()
			.getResponse()
			.getContentAsString();

		getJson("/api/v1/customers", JsonPath.read(refreshed, "$.accessToken")).andExpect(status().isOk());
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
	void l_health_e_pubblico_ma_le_metriche_richiedono_l_amministratore() throws Exception {
		mvc.perform(get("/actuator/health")).andExpect(status().isOk());
		mvc.perform(get("/actuator/prometheus")).andExpect(status().isUnauthorized());
		getJson("/actuator/prometheus", tokenFor(Role.OPERATOR)).andExpect(status().isForbidden());
		getJson("/actuator/prometheus", adminToken()).andExpect(status().isOk());
	}

}
