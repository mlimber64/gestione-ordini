package it.limber.ordini.identity.adapter.in.web;

import it.limber.ordini.identity.application.AuthService;
import it.limber.ordini.identity.application.TokenPair;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

	record LoginRequest(@NotBlank String username, @NotBlank String password) {
	}

	record RefreshRequest(@NotBlank String refreshToken) {
	}

	private final AuthService auth;

	AuthController(AuthService auth) {
		this.auth = auth;
	}

	@PostMapping("/login")
	TokenPair login(@Valid @RequestBody LoginRequest request) {
		return auth.login(request.username(), request.password());
	}

	@PostMapping("/refresh")
	TokenPair refresh(@Valid @RequestBody RefreshRequest request) {
		return auth.refresh(request.refreshToken());
	}

}
