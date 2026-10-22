package it.limber.ordini.config;

import it.limber.ordini.identity.application.UserService;
import it.limber.ordini.identity.application.UserService.CreateUserCommand;
import it.limber.ordini.identity.domain.Role;
import it.limber.ordini.shared.auth.LocalAuth;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Alla prima esecuzione crea l'amministratore iniziale, ma solo se è stata configurata una password. */
@Component
@LocalAuth
class AdminBootstrap implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

	private final UserService users;

	private final SecurityProperties properties;

	AdminBootstrap(UserService users, SecurityProperties properties) {
		this.users = users;
		this.properties = properties;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (users.count() > 0) {
			return;
		}
		SecurityProperties.BootstrapAdmin admin = properties.bootstrapAdmin();
		if (admin == null || admin.password() == null || admin.password().isBlank()) {
			log.warn("Nessun utente presente e ADMIN_PASSWORD non impostata: l'amministratore non è stato creato.");
			return;
		}
		users.create(new CreateUserCommand(admin.username(), admin.password(), Role.ADMIN));
		log.info("Creato l'amministratore iniziale '{}'.", admin.username());
	}

}
