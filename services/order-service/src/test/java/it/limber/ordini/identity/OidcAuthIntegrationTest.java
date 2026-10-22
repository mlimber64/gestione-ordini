package it.limber.ordini.identity;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import it.limber.ordini.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.util.UriComponents;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URLDecoder;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Modalità {@code oidc} (ADR 0021) contro un identity provider finto: un piccolo server HTTP che pubblica le chiavi
 * (JWKS) e risponde agli endpoint {@code token} e {@code logout} di Keycloak. Il test di punta a punta con Keycloak
 * vero sta in {@code e2e/}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class OidcAuthIntegrationTest {

	private static final String REALM = "/realms/test";

	private static final String OIDC = REALM + "/protocol/openid-connect";

	private static final String CLIENT_SECRET = "segreto-del-client-di-prova";

	private static final RSAKey KEY = key();

	private static final RSAKey OTHER_KEY = key();

	private static final HttpServer IDP = startIdp();

	private static final String ISSUER = "http://localhost:" + IDP.getAddress().getPort() + REALM;

	/** Moduli del form ricevuti dagli endpoint token e logout, per verificare cosa ha mandato order-service. */
	private static final List<Map<String, String>> TOKEN_REQUESTS = new CopyOnWriteArrayList<>();

	private static final List<Map<String, String>> LOGOUT_REQUESTS = new CopyOnWriteArrayList<>();

	@DynamicPropertySource
	static void properties(DynamicPropertyRegistry registry) {
		registry.add("app.auth.mode", () -> "oidc");
		registry.add("app.auth.oidc.issuer", () -> ISSUER);
		registry.add("app.auth.oidc.client-id", () -> "gestione-ordini");
		registry.add("app.auth.oidc.client-secret", () -> CLIENT_SECRET);
	}

	@AfterAll
	static void stopIdp() {
		IDP.stop(0);
	}

	@Autowired
	private MockMvc mvc;

	@BeforeEach
	void clear() {
		TOKEN_REQUESTS.clear();
		LOGOUT_REQUESTS.clear();
	}

	@Test
	void la_configurazione_dice_che_l_accesso_e_con_keycloak() throws Exception {
		mvc.perform(get("/api/v1/auth/config")).andExpect(status().isOk()).andExpect(jsonPath("$.mode").value("oidc"));
	}

	@Test
	void il_login_manda_il_browser_al_provider_con_pkce_e_ricorda_stato_e_verifica_in_un_cookie() throws Exception {
		MockHttpServletResponse response = mvc.perform(get("/api/v1/auth/oidc/login")).andReturn().getResponse();

		assertThat(response.getStatus()).isEqualTo(302);
		UriComponents url = UriComponentsBuilder.fromUriString(response.getRedirectedUrl()).build();
		assertThat(url.toUriString()).startsWith(ISSUER + "/protocol/openid-connect/auth?");
		assertThat(url.getQueryParams().getFirst("client_id")).isEqualTo("gestione-ordini");
		assertThat(url.getQueryParams().getFirst("response_type")).isEqualTo("code");
		assertThat(url.getQueryParams().getFirst("code_challenge_method")).isEqualTo("S256");
		assertThat(url.getQueryParams().getFirst("code_challenge")).isNotBlank();
		assertThat(decode(url.getQueryParams().getFirst("redirect_uri")))
			.isEqualTo("http://localhost/api/v1/auth/oidc/callback");
		String cookie = response.getHeader("Set-Cookie");
		assertThat(cookie).startsWith("gestione_ordini_oidc=")
			.contains("HttpOnly")
			.contains("SameSite=Lax")
			.contains("Path=/api/v1/auth/oidc")
			.contains("Max-Age=300");
		// Il cookie contiene lo stesso stato mandato al provider; il segreto del client non compare mai nell'URL
		assertThat(cookie).contains(url.getQueryParams().getFirst("state") + ".");
		assertThat(url.toUriString()).doesNotContain(CLIENT_SECRET);
	}

	@Test
	void il_ritorno_dal_provider_scambia_il_codice_con_il_segreto_e_la_verifica_pkce_e_apre_la_sessione()
			throws Exception {
		Login login = startLogin();

		MockHttpServletResponse response = mvc
			.perform(get("/api/v1/auth/oidc/callback").param("code", "codice-buono")
				.param("state", login.state())
				.cookie(login.cookie()))
			.andReturn()
			.getResponse();

		assertThat(response.getStatus()).isEqualTo(302);
		assertThat(response.getRedirectedUrl()).isEqualTo("/");
		assertThat(response.getHeaders("Set-Cookie")).anySatisfy(
				c -> assertThat(c).startsWith("gestione_ordini_refresh=refresh-1;").contains("HttpOnly").contains("SameSite=Strict"))
			// il cookie temporaneo si cancella: serve una volta sola
			.anySatisfy(c -> assertThat(c).startsWith("gestione_ordini_oidc=;").contains("Max-Age=0"));
		Map<String, String> sent = TOKEN_REQUESTS.getFirst();
		assertThat(sent).containsEntry("grant_type", "authorization_code")
			.containsEntry("code", "codice-buono")
			.containsEntry("client_id", "gestione-ordini")
			.containsEntry("client_secret", CLIENT_SECRET)
			.containsEntry("redirect_uri", "http://localhost/api/v1/auth/oidc/callback");
		// PKCE: il provider riceve la verifica e il suo hash è la «challenge» mandata all'andata
		assertThat(sha256(sent.get("code_verifier"))).isEqualTo(login.challenge());
	}

	@Test
	void uno_stato_diverso_da_quello_ricordato_viene_rifiutato_senza_chiamare_il_provider() throws Exception {
		Login login = startLogin();

		MockHttpServletResponse response = mvc
			.perform(get("/api/v1/auth/oidc/callback").param("code", "codice-buono")
				.param("state", "stato-falsificato")
				.cookie(login.cookie()))
			.andReturn()
			.getResponse();

		assertThat(response.getRedirectedUrl()).isEqualTo("/login?error=oidc");
		assertThat(response.getHeaders("Set-Cookie")).noneMatch(c -> c.startsWith("gestione_ordini_refresh=refresh"));
		assertThat(TOKEN_REQUESTS).isEmpty();
	}

	@Test
	void senza_il_cookie_del_login_il_ritorno_dal_provider_viene_rifiutato() throws Exception {
		MockHttpServletResponse response = mvc
			.perform(get("/api/v1/auth/oidc/callback").param("code", "codice-buono").param("state", "x"))
			.andReturn()
			.getResponse();

		assertThat(response.getRedirectedUrl()).isEqualTo("/login?error=oidc");
		assertThat(TOKEN_REQUESTS).isEmpty();
	}

	@Test
	void un_codice_rifiutato_dal_provider_riporta_al_login() throws Exception {
		Login login = startLogin();

		MockHttpServletResponse response = mvc
			.perform(get("/api/v1/auth/oidc/callback").param("code", "codice-scaduto")
				.param("state", login.state())
				.cookie(login.cookie()))
			.andReturn()
			.getResponse();

		assertThat(response.getRedirectedUrl()).isEqualTo("/login?error=oidc");
		assertThat(response.getHeaders("Set-Cookie")).noneMatch(c -> c.startsWith("gestione_ordini_refresh=refresh"));
	}

	@Test
	void l_errore_del_provider_riporta_al_login() throws Exception {
		MockHttpServletResponse response = mvc
			.perform(get("/api/v1/auth/oidc/callback").param("error", "access_denied").param("state", "x"))
			.andReturn()
			.getResponse();

		assertThat(response.getRedirectedUrl()).isEqualTo("/login?error=oidc");
	}

	@Test
	void il_refresh_usa_il_token_del_cookie_e_ne_mette_uno_nuovo() throws Exception {
		MockHttpServletResponse response = mvc
			.perform(post("/api/v1/auth/refresh").cookie(new Cookie("gestione_ordini_refresh", "refresh-1")))
			.andReturn()
			.getResponse();

		assertThat(response.getStatus()).isEqualTo(200);
		assertThat(response.getContentAsString()).contains("\"accessToken\"").contains("\"tokenType\":\"Bearer\"")
			.doesNotContain("refresh-2");
		assertThat(response.getHeader("Set-Cookie")).startsWith("gestione_ordini_refresh=refresh-2;")
			.contains("HttpOnly");
		assertThat(TOKEN_REQUESTS.getFirst()).containsEntry("grant_type", "refresh_token")
			.containsEntry("refresh_token", "refresh-1")
			.containsEntry("client_secret", CLIENT_SECRET);
	}

	@Test
	void il_refresh_senza_cookie_o_con_un_token_rifiutato_e_401_e_toglie_il_cookie() throws Exception {
		mvc.perform(post("/api/v1/auth/refresh")).andExpect(status().isUnauthorized());

		MockHttpServletResponse response = mvc
			.perform(post("/api/v1/auth/refresh").cookie(new Cookie("gestione_ordini_refresh", "token-revocato")))
			.andReturn()
			.getResponse();

		assertThat(response.getStatus()).isEqualTo(401);
		assertThat(response.getHeader("Set-Cookie")).contains("gestione_ordini_refresh=;").contains("Max-Age=0");
	}

	@Test
	void il_logout_chiude_la_sessione_anche_presso_il_provider_e_toglie_il_cookie() throws Exception {
		MockHttpServletResponse response = mvc
			.perform(post("/api/v1/auth/logout").cookie(new Cookie("gestione_ordini_refresh", "refresh-1")))
			.andReturn()
			.getResponse();

		assertThat(response.getStatus()).isEqualTo(204);
		assertThat(response.getHeader("Set-Cookie")).contains("Max-Age=0");
		assertThat(LOGOUT_REQUESTS).singleElement()
			.satisfies(form -> assertThat(form).containsEntry("refresh_token", "refresh-1")
				.containsEntry("client_secret", CLIENT_SECRET));
	}

	@Test
	void le_api_accettano_i_token_del_provider_e_applicano_i_ruoli_del_claim_roles() throws Exception {
		String admin = accessToken(KEY, ISSUER, "Bearer", List.of("ADMIN"), 300);
		String viewer = accessToken(KEY, ISSUER, "Bearer", List.of("VIEWER"), 300);

		mvc.perform(get("/api/v1/customers").header("Authorization", "Bearer " + viewer)).andExpect(status().isOk());
		mvc.perform(post("/api/v1/categories").header("Authorization", "Bearer " + viewer)
			.contentType("application/json")
			.content("{\"name\":\"Prova\",\"parentId\":null}")).andExpect(status().isForbidden());
		mvc.perform(post("/api/v1/categories").header("Authorization", "Bearer " + admin)
			.contentType("application/json")
			.content("{\"name\":\"Prova\",\"parentId\":null}")).andExpect(status().isCreated());
	}

	@Test
	void le_api_rifiutano_token_firmati_con_un_altra_chiave_di_un_altro_emittente_scaduti_o_di_refresh()
			throws Exception {
		List<String> invalid = List.of(accessToken(OTHER_KEY, ISSUER, "Bearer", List.of("ADMIN"), 300),
				accessToken(KEY, "http://altro-emittente/realms/test", "Bearer", List.of("ADMIN"), 300),
				accessToken(KEY, ISSUER, "Bearer", List.of("ADMIN"), -300),
				// Keycloak firma con la stessa chiave anche i token di refresh: non devono valere come accesso
				accessToken(KEY, ISSUER, "Refresh", List.of("ADMIN"), 300));

		for (String token : invalid) {
			mvc.perform(get("/api/v1/customers").header("Authorization", "Bearer " + token))
				.andExpect(status().isUnauthorized());
		}
	}

	@Test
	void la_gestione_degli_utenti_e_il_login_con_password_non_esistono_in_questa_modalita() throws Exception {
		String admin = accessToken(KEY, ISSUER, "Bearer", List.of("ADMIN"), 300);

		mvc.perform(get("/api/v1/users").header("Authorization", "Bearer " + admin)).andExpect(status().isNotFound());
		mvc.perform(post("/api/v1/auth/login").contentType("application/json")
			.content("{\"username\":\"admin\",\"password\":\"x\"}")).andExpect(status().is4xxClientError());
	}

	// --- utilità ---

	private record Login(String state, String challenge, Cookie cookie) {
	}

	private Login startLogin() throws Exception {
		MockHttpServletResponse response = mvc.perform(get("/api/v1/auth/oidc/login")).andReturn().getResponse();
		UriComponents url = UriComponentsBuilder.fromUriString(response.getRedirectedUrl()).build();
		return new Login(url.getQueryParams().getFirst("state"), url.getQueryParams().getFirst("code_challenge"),
				response.getCookie("gestione_ordini_oidc"));
	}

	private static String decode(String value) {
		return URLDecoder.decode(value, StandardCharsets.UTF_8);
	}

	private static String sha256(String verifier) throws Exception {
		return Base64.getUrlEncoder()
			.withoutPadding()
			.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
	}

	private static String accessToken(RSAKey signer, String issuer, String type, List<String> roles, long ttlSeconds) {
		try {
			Instant now = Instant.now();
			JWTClaimsSet claims = new JWTClaimsSet.Builder().issuer(issuer)
				.subject("utente-di-prova")
				.claim("typ", type)
				.claim("preferred_username", "utente-di-prova")
				.claim("roles", roles)
				.issueTime(Date.from(now))
				.expirationTime(Date.from(now.plusSeconds(ttlSeconds)))
				.build();
			SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(signer.getKeyID())
				.type(JOSEObjectType.JWT)
				.build(), claims);
			jwt.sign(new RSASSASigner(signer));
			return jwt.serialize();
		}
		catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static RSAKey key() {
		try {
			return new RSAKeyGenerator(2048).keyID(java.util.UUID.randomUUID().toString()).generate();
		}
		catch (Exception ex) {
			throw new ExceptionInInitializerError(ex);
		}
	}

	private static HttpServer startIdp() {
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
			server.createContext(OIDC + "/certs", exchange -> respond(exchange, 200,
					new JWKSet(KEY.toPublicJWK()).toString()));
			server.createContext(OIDC + "/token", exchange -> {
				Map<String, String> form = form(exchange);
				TOKEN_REQUESTS.add(form);
				boolean validCode = "authorization_code".equals(form.get("grant_type"))
						&& "codice-buono".equals(form.get("code"));
				boolean validRefresh = "refresh_token".equals(form.get("grant_type"))
						&& "refresh-1".equals(form.get("refresh_token"));
				if (!validCode && !validRefresh) {
					respond(exchange, 400, "{\"error\":\"invalid_grant\"}");
					return;
				}
				String refresh = validCode ? "refresh-1" : "refresh-2";
				respond(exchange, 200, "{\"access_token\":\"%s\",\"refresh_token\":\"%s\",\"expires_in\":300}"
					.formatted(accessToken(KEY, ISSUER, "Bearer", List.of("ADMIN"), 300), refresh));
			});
			server.createContext(OIDC + "/logout", exchange -> {
				LOGOUT_REQUESTS.add(form(exchange));
				respond(exchange, 204, "");
			});
			server.start();
			return server;
		}
		catch (IOException ex) {
			throw new ExceptionInInitializerError(ex);
		}
	}

	private static Map<String, String> form(HttpExchange exchange) throws IOException {
		String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
		Map<String, String> form = new HashMap<>();
		for (String pair : body.split("&")) {
			String[] kv = pair.split("=", 2);
			form.put(decode(kv[0]), kv.length > 1 ? decode(kv[1]) : "");
		}
		return form;
	}

	private static void respond(HttpExchange exchange, int status, String body) throws IOException {
		byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
		exchange.getResponseHeaders().add("Content-Type", "application/json");
		exchange.sendResponseHeaders(status, status == 204 ? -1 : bytes.length);
		if (status != 204) {
			exchange.getResponseBody().write(bytes);
		}
		exchange.close();
	}

}
