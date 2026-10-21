package it.limber.ordini.identity.application;

import it.limber.ordini.identity.domain.AppUser;
import it.limber.ordini.identity.domain.Role;
import it.limber.ordini.identity.domain.UserRepository;
import it.limber.ordini.shared.error.ConflictException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class UserService {

	public record CreateUserCommand(String username, String password, Role role) {
	}

	public record UserView(UUID id, String username, Role role, boolean enabled) {

		static UserView of(AppUser user) {
			return new UserView(user.getId(), user.getUsername(), user.getRole(), user.isEnabled());
		}

	}

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	public UserService(UserRepository users, PasswordEncoder passwordEncoder) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
	}

	@Transactional
	public UserView create(CreateUserCommand command) {
		String username = command.username().trim();
		if (users.existsByUsername(username)) {
			throw new ConflictException("Esiste già un utente con username " + username);
		}
		AppUser user = new AppUser(username, passwordEncoder.encode(command.password()), command.role());
		return UserView.of(users.save(user));
	}

	@Transactional(readOnly = true)
	public List<UserView> list() {
		return users.findAll().stream().map(UserView::of).toList();
	}

	@Transactional(readOnly = true)
	public long count() {
		return users.count();
	}

}
