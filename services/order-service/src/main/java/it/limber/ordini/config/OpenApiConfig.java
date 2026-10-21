package it.limber.ordini.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class OpenApiConfig {

	private static final String BEARER = "bearer";

	@Bean
	OpenAPI openApi() {
		return new OpenAPI()
			.info(new Info().title("Gestione Ordini - order-service")
				.version("v1")
				.description("API REST per utenti, clienti, catalogo, magazzino e ordini."))
			.components(new Components().addSecuritySchemes(BEARER,
					new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme(BEARER).bearerFormat("JWT")))
			.addSecurityItem(new SecurityRequirement().addList(BEARER));
	}

}
