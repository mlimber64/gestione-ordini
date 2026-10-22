package it.limber.notification.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Proprietà {@code app.auth.*}: in modalità {@code local} i token sono quelli di order-service (HS256); in modalità
 * {@code oidc} li emette Keycloak e qui si verificano con le sue chiavi pubbliche (JWKS).
 *
 * @param issuer indirizzo pubblico del realm, quello che compare nel claim {@code iss}
 * @param internalUri indirizzo del realm raggiungibile dal servizio (rete Docker); se vuoto vale {@code issuer}
 */
@ConfigurationProperties("app.auth")
public record AuthProperties(String mode, Oidc oidc) {

	public record Oidc(String issuer, String internalUri) {

		public String backchannel() {
			return internalUri == null || internalUri.isBlank() ? issuer : internalUri;
		}

	}

}
