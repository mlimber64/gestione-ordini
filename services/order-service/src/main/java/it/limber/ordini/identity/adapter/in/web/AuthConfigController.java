package it.limber.ordini.identity.adapter.in.web;

import it.limber.ordini.config.AuthProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Dice all'interfaccia come autenticare l'utente: con il modulo dell'applicazione ({@code local}) o con Keycloak ({@code oidc}). */
@RestController
@RequestMapping("/api/v1/auth/config")
class AuthConfigController {

	record AuthConfig(String mode) {
	}

	private final AuthProperties properties;

	AuthConfigController(AuthProperties properties) {
		this.properties = properties;
	}

	@GetMapping
	AuthConfig config() {
		return new AuthConfig(properties.mode());
	}

}
