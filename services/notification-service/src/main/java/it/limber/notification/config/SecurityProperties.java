package it.limber.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

/** Verifica dei JWT emessi da order-service: stesso segreto HS256 e stesso emittente. */
@ConfigurationProperties("app.security")
public record SecurityProperties(Jwt jwt) {

	public record Jwt(String secret, String issuer) {

		public Jwt {
			if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
				throw new IllegalStateException(
						"app.security.jwt.secret (variabile JWT_SECRET) deve avere almeno 32 byte");
			}
		}

	}

	public SecretKey jwtKey() {
		return new SecretKeySpec(jwt.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
	}

}
