package it.limber.ordini.identity.adapter.in.web;

import it.limber.ordini.identity.application.UserService;
import it.limber.ordini.identity.application.UserService.CreateUserCommand;
import it.limber.ordini.identity.application.UserService.UserView;
import it.limber.ordini.identity.domain.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize("hasRole('ADMIN')")
class UserController {

	record CreateUserRequest(
			@NotBlank @Size(min = 3, max = 50) @Pattern(regexp = "[A-Za-z0-9._-]+",
					message = "ammessi solo lettere, numeri, punto, trattino e underscore") String username,
			@NotBlank @Size(min = 10, max = 72, message = "la password deve avere tra 10 e 72 caratteri") String password,
			@NotNull Role role) {
	}

	private final UserService users;

	UserController(UserService users) {
		this.users = users;
	}

	@GetMapping
	List<UserView> list() {
		return users.list();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	UserView create(@Valid @RequestBody CreateUserRequest request) {
		return users.create(new CreateUserCommand(request.username(), request.password(), request.role()));
	}

}
