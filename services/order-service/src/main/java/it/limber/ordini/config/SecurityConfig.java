package it.limber.ordini.config;

import it.limber.ordini.identity.adapter.out.security.JwtSupport;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;

import java.nio.charset.StandardCharsets;

/**
 * API stateless protetta da JWT: l'applicazione emette i token e li verifica come resource server.
 * I permessi per ruolo sono dichiarati sui controller con {@code @PreAuthorize}.
 */
@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(SecurityProperties.class)
class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationConverter converter)
			throws Exception {
		http.csrf(AbstractHttpConfigurer::disable)
			.cors(Customizer.withDefaults())
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.authorizeHttpRequests(requests -> requests
				.requestMatchers("/api/v1/auth/**").permitAll()
				// Le metriche non contengono dati sensibili e servono a Prometheus, che non ha un token. Non sono raggiungibili
				// da fuori: il reverse proxy inoltra solo /api e le porte dei servizi non sono pubblicate (ADR 0014).
				.requestMatchers(HttpMethod.GET, "/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
				.requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
				.requestMatchers("/actuator/**").hasRole("ADMIN")
				.anyRequest().authenticated())
			.oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(converter))
				.authenticationEntryPoint(unauthorized())
				.accessDeniedHandler(forbidden()))
			.exceptionHandling(handling -> handling.authenticationEntryPoint(unauthorized())
				.accessDeniedHandler(forbidden()));
		return http.build();
	}

	@Bean
	JwtDecoder jwtDecoder(SecurityProperties properties) {
		return JwtSupport.decoder(properties, JwtSupport.ACCESS);
	}

	@Bean
	JwtAuthenticationConverter jwtAuthenticationConverter() {
		JwtGrantedAuthoritiesConverter authorities = new JwtGrantedAuthoritiesConverter();
		authorities.setAuthoritiesClaimName(JwtSupport.ROLES_CLAIM);
		authorities.setAuthorityPrefix("ROLE_");
		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(authorities);
		return converter;
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	private static AuthenticationEntryPoint unauthorized() {
		return (request, response, ex) -> problem(response, 401, "Non autenticato",
				"Token mancante, scaduto o non valido.");
	}

	private static AccessDeniedHandler forbidden() {
		return (request, response, ex) -> problem(response, 403, "Accesso negato",
				"Non hai i permessi per eseguire questa operazione.");
	}

	private static void problem(jakarta.servlet.http.HttpServletResponse response, int status, String title,
			String detail) throws java.io.IOException {
		response.setStatus(status);
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		response.getWriter()
			.write("{\"type\":\"about:blank\",\"title\":\"%s\",\"status\":%d,\"detail\":\"%s\"}".formatted(title,
					status, detail));
	}

}
