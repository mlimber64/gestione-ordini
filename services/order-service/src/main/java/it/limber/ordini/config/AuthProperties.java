package it.limber.ordini.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Proprietà {@code app.auth.*}: chi autentica gli utenti. In modalità {@code local} lo fa order-service con i propri
 * JWT; in modalità {@code oidc} lo fa un identity provider esterno (Keycloak) e order-service si limita a verificare
 * i suoi token con le chiavi pubbliche (JWKS).
 */
@ConfigurationProperties("app.auth")
public record AuthProperties(String mode, Oidc oidc) {

	/**
	 * @param issuer indirizzo pubblico del realm: è quello che compare nel claim {@code iss} e dove va il browser
	 * @param internalUri indirizzo del realm raggiungibile dal servizio (rete Docker); se vuoto vale {@code issuer}
	 */
	public record Oidc(String issuer, String internalUri, String clientId, String clientSecret) {

		public String backchannel() {
			return internalUri == null || internalUri.isBlank() ? issuer : internalUri;
		}

	}

}
