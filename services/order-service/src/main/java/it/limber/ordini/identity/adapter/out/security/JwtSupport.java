package it.limber.ordini.identity.adapter.out.security;

import it.limber.ordini.config.SecurityProperties;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

/** Costanti e decoder condivisi tra chi emette i token e chi li verifica come resource server. */
public final class JwtSupport {

	public static final String TOKEN_USE_CLAIM = "token_use";

	public static final String ROLES_CLAIM = "roles";

	public static final String ACCESS = "access";

	public static final String REFRESH = "refresh";

	private JwtSupport() {
	}

	/** Decoder che accetta solo token firmati dall'applicazione e del tipo richiesto (accesso o refresh). */
	public static NimbusJwtDecoder decoder(SecurityProperties properties, String expectedUse) {
		NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(properties.jwtKey())
			.macAlgorithm(MacAlgorithm.HS256)
			.build();
		decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
				JwtValidators.createDefaultWithIssuer(properties.jwt().issuer()), tokenUse(expectedUse)));
		return decoder;
	}

	private static OAuth2TokenValidator<Jwt> tokenUse(String expected) {
		return jwt -> expected.equals(jwt.getClaimAsString(TOKEN_USE_CLAIM)) ? OAuth2TokenValidatorResult.success()
				: OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Tipo di token non valido", null));
	}

}
