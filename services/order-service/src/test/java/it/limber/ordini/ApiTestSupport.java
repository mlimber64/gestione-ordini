package it.limber.ordini;

import com.jayway.jsonpath.JsonPath;
import it.limber.ordini.identity.application.UserService;
import it.limber.ordini.identity.application.UserService.CreateUserCommand;
import it.limber.ordini.identity.domain.Role;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

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

	/** Crea una categoria e un prodotto attivo con il prezzo e l'IVA indicati; restituisce l'id del prodotto. */
	protected String createProduct(String token, String price, String vatRate) throws Exception {
		String categoryId = idOf(postJson("/api/v1/categories", token,
				"{\"name\":\"%s\",\"parentId\":null}".formatted(unique("Cat"))));
		return idOf(postJson("/api/v1/products", token, """
				{"sku":"%s","name":"Prodotto di prova","description":null,"categoryId":"%s","unitPrice":%s,"vatRate":%s}"""
			.formatted(unique("SKU"), categoryId, price, vatRate)));
	}

	/** Crea un cliente attivo con un indirizzo di spedizione predefinito; restituisce l'id del cliente. */
	protected String createCustomerWithAddress(String token) throws Exception {
		String customerId = idOf(postJson("/api/v1/customers", token, """
				{"name":"Cliente di prova","email":"%s@example.it","phone":null,"vatNumber":null,"taxCode":null}"""
			.formatted(unique("cliente"))));
		postJson("/api/v1/customers/" + customerId + "/addresses", token, """
				{"type":"SHIPPING","street":"Via Roma 1","city":"Salerno","province":"SA","postalCode":"84121","country":"IT","defaultAddress":true}""");
		return customerId;
	}

	protected void receiveStock(String token, String productId, int quantity) throws Exception {
		postJson("/api/v1/inventory/" + productId + "/receipts", token,
				"{\"quantity\":%d,\"note\":\"carico di prova\"}".formatted(quantity));
	}

	protected static String orderJson(String customerId, String productId, int quantity) {
		return """
				{"customerId":"%s","items":[{"productId":"%s","quantity":%d}]}""".formatted(customerId, productId, quantity);
	}

	/** Lancia tutte le azioni nello stesso istante e restituisce i codici HTTP ottenuti, nello stesso ordine. */
	protected static List<Integer> runTogether(List<Callable<Integer>> actions) throws Exception {
		CountDownLatch start = new CountDownLatch(1);
		try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
			List<Future<Integer>> futures = actions.stream().map(action -> executor.submit(() -> {
				start.await();
				return action.call();
			})).toList();
			start.countDown();
			List<Integer> statuses = new ArrayList<>();
			for (Future<Integer> future : futures) {
				statuses.add(future.get());
			}
			return statuses;
		}
	}

	protected static String idOf(ResultActions result) throws Exception {
		return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
	}

	protected static String unique(String prefix) {
		return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
	}

}
