package it.limber.ordini.identity.application;

import it.limber.ordini.identity.domain.AppUser;
import it.limber.ordini.identity.domain.UserRepository;
import it.limber.ordini.shared.auth.LocalAuth;
import it.limber.ordini.shared.error.AuthenticationFailedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@LocalAuth
public class AuthService {

	private static final String INVALID_CREDENTIALS = "Credenziali non valide";

	private final UserRepository users;

	private final PasswordEncoder passwordEncoder;

	private final TokenIssuer tokens;

	public AuthService(UserRepository users, PasswordEncoder passwordEncoder, TokenIssuer tokens) {
		this.users = users;
		this.passwordEncoder = passwordEncoder;
		this.tokens = tokens;
	}

	@Transactional(readOnly = true)
	public TokenPair login(String username, String password) {
		AppUser user = users.findByUsername(username)
			.filter(AppUser::isEnabled)
			.filter(candidate -> passwordEncoder.matches(password, candidate.getPasswordHash()))
			.orElseThrow(() -> new AuthenticationFailedException(INVALID_CREDENTIALS));
		return tokens.issue(user);
	}

	@Transactional(readOnly = true)
	public TokenPair refresh(String refreshToken) {
		String username = tokens.usernameFromRefreshToken(refreshToken)
			.orElseThrow(() -> new AuthenticationFailedException("Token di refresh non valido o scaduto"));
		AppUser user = users.findByUsername(username)
			.filter(AppUser::isEnabled)
			.orElseThrow(() -> new AuthenticationFailedException("Token di refresh non valido o scaduto"));
		return tokens.issue(user);
	}

}
