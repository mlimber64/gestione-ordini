package it.limber.notification.config;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Verifica dei token di Keycloak (modalità {@code oidc}, ADR 0021) contro un server finto che pubblica le chiavi. */
class OidcJwtDecoderTest {

	private static final String REALM = "/realms/test";

	private static RSAKey key;

	private static RSAKey otherKey;

	private static HttpServer idp;

	private static String issuer;

	private static ReactiveJwtDecoder decoder;

	@BeforeAll
	static void start() throws Exception {
		key = new RSAKeyGenerator(2048).keyID(UUID.randomUUID().toString()).generate();
		otherKey = new RSAKeyGenerator(2048).keyID(UUID.randomUUID().toString()).generate();
		idp = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
		idp.createContext(REALM + "/protocol/openid-connect/certs", exchange -> {
			byte[] body = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json");
			exchange.sendResponseHeaders(200, body.length);
			exchange.getResponseBody().write(body);
			exchange.close();
		});
		idp.start();
		issuer = "http://localhost:" + idp.getAddress().getPort() + REALM;
		decoder = new SecurityConfig().oidcJwtDecoder(new AuthProperties("oidc", new AuthProperties.Oidc(issuer, "")));
	}

	@AfterAll
	static void stop() {
		idp.stop(0);
	}

	@Test
	void accetta_un_token_di_accesso_firmato_dal_provider() {
		TestToken ok = new TestToken(key, issuer, "Bearer", 300);

		assertThat(decoder.decode(ok.token()).block().getClaimAsStringList("roles")).containsExactly("VIEWER");
	}

	@Test
	void rifiuta_chiave_sbagliata_emittente_sbagliato_scadenza_e_token_di_refresh() {
		for (TestToken invalid : List.of(new TestToken(otherKey, issuer, "Bearer", 300),
				new TestToken(key, "http://altro/realms/test", "Bearer", 300), new TestToken(key, issuer, "Bearer", -300),
				new TestToken(key, issuer, "Refresh", 300))) {
			assertThatThrownBy(() -> decoder.decode(invalid.token()).block()).isInstanceOf(Exception.class);
		}
	}

	private record TestToken(RSAKey signer, String issuer, String type, long ttl) {

		String token() {
			try {
				Instant now = Instant.now();
				JWTClaimsSet claims = new JWTClaimsSet.Builder().issuer(issuer)
					.subject("tester")
					.claim("typ", type)
					.claim("roles", List.of("VIEWER"))
					.issueTime(Date.from(now))
					.expirationTime(Date.from(now.plusSeconds(ttl)))
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

	}

}
