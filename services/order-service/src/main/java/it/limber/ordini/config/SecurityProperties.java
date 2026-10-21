package it.limber.ordini.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/** Proprietà {@code app.security.*}: firma dei JWT e utente amministratore iniziale. */
@ConfigurationProperties("app.security")
public record SecurityProperties(Jwt jwt, BootstrapAdmin bootstrapAdmin) {

	public record Jwt(String secret, String issuer, Duration accessTtl, Duration refreshTtl) {

		public Jwt {
			if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
				throw new IllegalStateException(
						"app.security.jwt.secret (variabile JWT_SECRET) deve avere almeno 32 byte");
			}
		}

	}

	/** Se la password è vuota l'amministratore non viene creato. */
	public record BootstrapAdmin(String username, String password) {
	}

	public SecretKey jwtKey() {
		return new SecretKeySpec(jwt.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
	}

}
