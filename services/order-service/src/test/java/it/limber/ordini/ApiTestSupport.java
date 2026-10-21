package it.limber.ordini;

import com.jayway.jsonpath.JsonPath;
import it.limber.ordini.identity.application.UserService;
import it.limber.ordini.identity.application.UserService.CreateUserCommand;
import it.limber.ordini.identity.domain.Role;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Utilità comuni ai test di integrazione dell'API. */
public abstract class ApiTestSupport {

	protected static final String ADMIN_PASSWORD = "test-admin-1234";

	@Autowired
	protected MockMvc mvc;

	@Autowired
	private UserService users;

	protected String login(String username, String password) throws Exception {
		String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
			.content("{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password)))
			.andReturn()
			.getResponse()
			.getContentAsString();
		return JsonPath.read(body, "$.accessToken");
	}

	protected String adminToken() throws Exception {
		return login("admin", ADMIN_PASSWORD);
	}

	/** Crea un utente con il ruolo indicato e restituisce il suo token di accesso. */
	protected String tokenFor(Role role) throws Exception {
		String username = role.name().toLowerCase() + "-" + UUID.randomUUID().toString().substring(0, 8);
		users.create(new CreateUserCommand(username, "password-di-prova-1", role));
		return login(username, "password-di-prova-1");
	}

	protected ResultActions getJson(String url, String token) throws Exception {
		return mvc.perform(get(url).header("Authorization", "Bearer " + token));
	}

	protected ResultActions postJson(String url, String token, String json) throws Exception {
		return mvc.perform(post(url).header("Authorization", "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	protected ResultActions putJson(String url, String token, String json) throws Exception {
		return mvc.perform(put(url).header("Authorization", "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	protected ResultActions patchJson(String url, String token, String json) throws Exception {
		return mvc.perform(patch(url).header("Authorization", "Bearer " + token)
			.contentType(MediaType.APPLICATION_JSON)
			.content(json));
	}

	protected ResultActions deleteJson(String url, String token) throws Exception {
		return mvc.perform(delete(url).header("Authorization", "Bearer " + token));
	}

	protected static String idOf(ResultActions result) throws Exception {
		return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
	}

	protected static String unique(String prefix) {
		return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
	}

}
