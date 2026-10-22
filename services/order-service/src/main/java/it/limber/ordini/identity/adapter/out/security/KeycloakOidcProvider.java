package it.limber.ordini.identity.adapter.out.security;

import it.limber.ordini.config.AuthProperties;
import it.limber.ordini.identity.application.OidcProvider;
import it.limber.ordini.shared.auth.OidcAuth;
import it.limber.ordini.shared.error.AuthenticationFailedException;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

/**
 * Parla con Keycloak (o con qualunque provider OpenID Connect con gli stessi endpoint). Il browser va all'indirizzo
 * pubblico del realm; le chiamate tra servizi usano quello interno.
 */
@Component
@OidcAuth
class KeycloakOidcProvider implements OidcProvider {

	private static final String OIDC = "/protocol/openid-connect";

	private final AuthProperties.Oidc config;

	private final RestClient http;

	KeycloakOidcProvider(AuthProperties properties) {
		this.config = properties.oidc();
		JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(
				HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
		factory.setReadTimeout(Duration.ofSeconds(5));
		this.http = RestClient.builder().requestFactory(factory).build();
	}

	@Override
	public String authorizationUrl(String redirectUri, String state, String codeChallenge) {
		return UriComponentsBuilder.fromUriString(config.issuer() + OIDC + "/auth")
			.queryParam("client_id", config.clientId())
			.queryParam("response_type", "code")
			.queryParam("scope", "openid")
			.queryParam("redirect_uri", redirectUri)
			.queryParam("state", state)
			.queryParam("code_challenge", codeChallenge)
			.queryParam("code_challenge_method", "S256")
			.encode()
			.build()
			.toUriString();
	}

	@Override
	public OidcTokens exchangeCode(String code, String redirectUri, String codeVerifier) {
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("grant_type", "authorization_code");
		form.add("code", code);
		form.add("redirect_uri", redirectUri);
		form.add("code_verifier", codeVerifier);
		return tokens(form);
	}

	@Override
	public OidcTokens refresh(String refreshToken) {
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("grant_type", "refresh_token");
		form.add("refresh_token", refreshToken);
		return tokens(form);
	}

	@Override
	public void logout(String refreshToken) {
		MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
		form.add("refresh_token", refreshToken);
		try {
			post("/logout", form, Void.class);
		}
		catch (AuthenticationFailedException ex) {
			// La sessione era già chiusa o scaduta presso il provider: l'obiettivo è raggiunto
		}
	}

	private OidcTokens tokens(MultiValueMap<String, String> form) {
		@SuppressWarnings("unchecked")
		Map<String, Object> body = post("/token", form, Map.class);
		if (body == null || !(body.get("access_token") instanceof String access)
				|| !(body.get("refresh_token") instanceof String refresh)) {
			throw new AuthenticationFailedException("Risposta del provider di identità non valida");
		}
		long expiresIn = body.get("expires_in") instanceof Number n ? n.longValue() : 0;
		return new OidcTokens(access, refresh, expiresIn);
	}

	private <T> T post(String endpoint, MultiValueMap<String, String> form, Class<T> type) {
		form.add("client_id", config.clientId());
		form.add("client_secret", config.clientSecret());
		try {
			return http.post()
				.uri(config.backchannel() + OIDC + endpoint)
				.contentType(MediaType.APPLICATION_FORM_URLENCODED)
				.body(form)
				.retrieve()
				.body(type);
		}
		catch (HttpClientErrorException ex) {
			// invalid_grant: codice o token di refresh scaduti, già usati o revocati
			throw new AuthenticationFailedException("Sessione non valida o scaduta");
		}
	}

}
