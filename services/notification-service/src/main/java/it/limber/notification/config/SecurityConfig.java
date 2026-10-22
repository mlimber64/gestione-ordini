package it.limber.notification.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusReactiveJwtDecoder;
import org.springframework.security.oauth2.jwt.ReactiveJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;

/**
 * notification-service non emette token: li verifica soltanto. Accetta i token di accesso di order-service e
 * rifiuta quelli di refresh. Ogni utente autenticato può leggere le notifiche.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebFluxSecurity
@EnableConfigurationProperties({ SecurityProperties.class, AuthProperties.class })
class SecurityConfig {

	private static final String TOKEN_USE_CLAIM = "token_use";

	private static final String ACCESS = "access";

	private static final String ROLES_CLAIM = "roles";

	@Bean
	@ConditionalOnProperty(name = "app.auth.mode", havingValue = "local", matchIfMissing = true)
	ReactiveJwtDecoder jwtDecoder(SecurityProperties properties) {
		NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder.withSecretKey(properties.jwtKey())
			.macAlgorithm(MacAlgorithm.HS256)
			.build();
		decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
				JwtValidators.createDefaultWithIssuer(properties.jwt().issuer()), accessTokensOnly()));
		return decoder;
	}

	/**
	 * Con Keycloak i token si verificano con le chiavi pubbliche del realm (JWKS, scaricate al primo uso: il servizio
	 * parte anche se Keycloak non è ancora pronto). Si controlla l'emittente e che sia un token di accesso
	 * ({@code typ=Bearer}), perché Keycloak firma con la stessa chiave anche i token di refresh.
	 */
	@Bean
	@ConditionalOnProperty(name = "app.auth.mode", havingValue = "oidc")
	ReactiveJwtDecoder oidcJwtDecoder(AuthProperties properties) {
		AuthProperties.Oidc oidc = properties.oidc();
		NimbusReactiveJwtDecoder decoder = NimbusReactiveJwtDecoder
			.withJwkSetUri(oidc.backchannel() + "/protocol/openid-connect/certs")
			.build();
		decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(oidc.issuer()),
				bearerTokensOnly()));
		return decoder;
	}

	@Bean
	SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http, ReactiveJwtDecoder decoder) {
		JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
		authorities.setAuthoritiesClaimName(ROLES_CLAIM);
		authorities.setAuthorityPrefix("ROLE_");
		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(authorities);

		return http.csrf(ServerHttpSecurity.CsrfSpec::disable)
			.authorizeExchange(exchanges -> exchanges.pathMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus")
				.permitAll()
				.pathMatchers("/actuator/**")
				.hasRole("ADMIN")
				.anyExchange()
				.authenticated())
			.oauth2ResourceServer(oauth2 -> oauth2
				.jwt(jwt -> jwt.jwtDecoder(decoder)
					.jwtAuthenticationConverter(new ReactiveJwtAuthenticationConverterAdapter(converter))))
			.build();
	}

	private static OAuth2TokenValidator<Jwt> bearerTokensOnly() {
		return jwt -> "Bearer".equals(jwt.getClaimAsString("typ")) ? OAuth2TokenValidatorResult.success()
				: OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Tipo di token non valido", null));
	}

	private static OAuth2TokenValidator<Jwt> accessTokensOnly() {
		return jwt -> ACCESS.equals(jwt.getClaimAsString(TOKEN_USE_CLAIM)) ? OAuth2TokenValidatorResult.success()
				: OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Tipo di token non valido", null));
	}

}
