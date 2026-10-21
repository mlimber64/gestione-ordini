package it.limber.ordini.order;

import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.IntegrationTest;
import it.limber.ordini.identity.domain.Role;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class OrderIntegrationTest extends ApiTestSupport {

	private void assertStock(String token, String productId, int onHand, int reserved) throws Exception {
		getJson("/api/v1/inventory/" + productId, token).andExpect(jsonPath("$.onHand").value(onHand))
			.andExpect(jsonPath("$.reserved").value(reserved))
			.andExpect(jsonPath("$.available").value(onHand - reserved));
	}

	@Test
	void crea_un_ordine_con_totali_copia_dei_prezzi_e_riserva_la_merce() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);

		postJson("/api/v1/orders", token, orderJson(customerId, productId, 3)).andExpect(status().isCreated())
			.andExpect(header().string("Location", startsWith("http://localhost/api/v1/orders/")))
			.andExpect(jsonPath("$.number").value(startsWith("ORD-")))
			.andExpect(jsonPath("$.status").value("PENDING"))
			.andExpect(jsonPath("$.customerCode").value(startsWith("CLI-")))
			.andExpect(jsonPath("$.shippingAddress.city").value("Salerno"))
			.andExpect(jsonPath("$.lines[0].quantity").value(3))
			.andExpect(jsonPath("$.lines[0].lineNet").value(30.00))
			.andExpect(jsonPath("$.totalNet").value(30.00))
			.andExpect(jsonPath("$.totalVat").value(6.60))
			.andExpect(jsonPath("$.totalGross").value(36.60))
			.andExpect(jsonPath("$.history[0].to").value("PENDING"));

		assertStock(token, productId, 10, 3);
	}

	@Test
	void il_prezzo_dell_ordine_non_cambia_se_cambia_il_listino() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 2)));

		String body = getJson("/api/v1/products/" + productId, token).andReturn().getResponse().getContentAsString();
		String categoryId = com.jayway.jsonpath.JsonPath.read(body, "$.categoryId");
		putJson("/api/v1/products/" + productId, token, """
				{"sku":"%s","name":"Rinominato","description":null,"categoryId":"%s","unitPrice":99.00,"vatRate":22}"""
			.formatted(com.jayway.jsonpath.JsonPath.read(body, "$.sku"), categoryId)).andExpect(status().isOk());

		getJson("/api/v1/orders/" + orderId, token).andExpect(jsonPath("$.lines[0].unitPrice").value(10.00))
			.andExpect(jsonPath("$.lines[0].productName").value("Prodotto di prova"))
			.andExpect(jsonPath("$.totalNet").value(20.00));
	}

	@Test
	void unisce_le_righe_dello_stesso_prodotto() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);

		postJson("/api/v1/orders", token, """
				{"customerId":"%s","items":[{"productId":"%s","quantity":2},{"productId":"%s","quantity":3}]}"""
			.formatted(customerId, productId, productId)).andExpect(status().isCreated())
			.andExpect(jsonPath("$.lines.length()").value(1))
			.andExpect(jsonPath("$.lines[0].quantity").value(5));
		assertStock(token, productId, 10, 5);
	}

	@Test
	void cicla_dall_attesa_alla_consegna_e_scarica_il_magazzino_alla_spedizione() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 4)));

		postJson("/api/v1/orders/" + orderId + "/confirm", token, "").andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CONFIRMED"));
		assertStock(token, productId, 10, 4);

		postJson("/api/v1/orders/" + orderId + "/ship", token, "").andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("SHIPPED"));
		assertStock(token, productId, 6, 0);

		postJson("/api/v1/orders/" + orderId + "/deliver", token, "").andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("DELIVERED"))
			.andExpect(jsonPath("$.history.length()").value(4))
			.andExpect(jsonPath("$.history[3].to").value("DELIVERED"));
	}

	@Test
	void annullando_libera_la_riserva() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 7)));
		assertStock(token, productId, 10, 7);

		postJson("/api/v1/orders/" + orderId + "/cancel", token, "{\"reason\":\"Il cliente ha rinunciato\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("CANCELLED"))
			.andExpect(jsonPath("$.history[1].reason").value("Il cliente ha rinunciato"));

		assertStock(token, productId, 10, 0);
		// Una seconda cancellazione non deve rilasciare altra merce
		postJson("/api/v1/orders/" + orderId + "/cancel", token, "{\"reason\":\"ancora\"}")
			.andExpect(status().isUnprocessableEntity());
		assertStock(token, productId, 10, 0);
	}

	@Test
	void le_transizioni_non_valide_danno_422() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 1)));

		postJson("/api/v1/orders/" + orderId + "/ship", token, "").andExpect(status().isUnprocessableEntity());
		postJson("/api/v1/orders/" + orderId + "/deliver", token, "").andExpect(status().isUnprocessableEntity());
		postJson("/api/v1/orders/" + orderId + "/cancel", token, "{\"reason\":\"\"}").andExpect(status().isBadRequest());
	}

	@Test
	void un_ordine_spedito_non_si_annulla() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 2)));
		postJson("/api/v1/orders/" + orderId + "/confirm", token, "");
		postJson("/api/v1/orders/" + orderId + "/ship", token, "");

		postJson("/api/v1/orders/" + orderId + "/cancel", token, "{\"reason\":\"troppo tardi\"}")
			.andExpect(status().isUnprocessableEntity());
		assertStock(token, productId, 8, 0);
	}

	@Test
	void rifiuta_clienti_bloccati_prodotti_inattivi_e_clienti_senza_indirizzo() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		receiveStock(token, productId, 10);

		String blocked = createCustomerWithAddress(token);
		deleteJson("/api/v1/customers/" + blocked, token).andExpect(status().isNoContent());
		postJson("/api/v1/orders", token, orderJson(blocked, productId, 1)).andExpect(status().isUnprocessableEntity());

		String noAddress = idOf(postJson("/api/v1/customers", token, """
				{"name":"Senza indirizzo","email":"%s@example.it","phone":null,"vatNumber":null,"taxCode":null}"""
			.formatted(unique("noaddr"))));
		postJson("/api/v1/orders", token, orderJson(noAddress, productId, 1)).andExpect(status().isUnprocessableEntity());

		String customerId = createCustomerWithAddress(token);
		patchJson("/api/v1/products/" + productId + "/active", token, "{\"active\":false}").andExpect(status().isOk());
		postJson("/api/v1/orders", token, orderJson(customerId, productId, 1)).andExpect(status().isUnprocessableEntity());
	}

	@Test
	void valida_la_richiesta() throws Exception {
		String token = adminToken();
		String customerId = createCustomerWithAddress(token);

		postJson("/api/v1/orders", token, "{\"customerId\":\"%s\",\"items\":[]}".formatted(customerId))
			.andExpect(status().isBadRequest());
		postJson("/api/v1/orders", token, orderJson(customerId, java.util.UUID.randomUUID().toString(), 0))
			.andExpect(status().isBadRequest());
		postJson("/api/v1/orders", token, orderJson(customerId, java.util.UUID.randomUUID().toString(), 1))
			.andExpect(status().isNotFound());
	}

	@Test
	void cerca_per_stato_e_cliente_con_paginazione() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 20);
		String first = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 1)));
		postJson("/api/v1/orders", token, orderJson(customerId, productId, 1));
		postJson("/api/v1/orders/" + first + "/confirm", token, "");

		getJson("/api/v1/orders?customerId=" + customerId, token).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(2));
		getJson("/api/v1/orders?customerId=" + customerId + "&status=CONFIRMED", token)
			.andExpect(jsonPath("$.totalElements").value(1))
			.andExpect(jsonPath("$.content[0].id").value(first));
		getJson("/api/v1/orders?customerId=" + customerId + "&size=1&sort=number,asc", token)
			.andExpect(jsonPath("$.content.length()").value(1))
			.andExpect(jsonPath("$.totalPages").value(2));
		getJson("/api/v1/orders?customerId=" + customerId + "&sort=password", token)
			.andExpect(status().isUnprocessableEntity());
	}

	@Test
	void i_permessi_dipendono_dal_ruolo() throws Exception {
		String admin = adminToken();
		String productId = createProduct(admin, "10.00", "22");
		String customerId = createCustomerWithAddress(admin);
		receiveStock(admin, productId, 10);
		String orderId = idOf(postJson("/api/v1/orders", admin, orderJson(customerId, productId, 1)));

		String viewer = tokenFor(Role.VIEWER);
		getJson("/api/v1/orders/" + orderId, viewer).andExpect(status().isOk());
		getJson("/api/v1/orders", viewer).andExpect(status().isOk());
		postJson("/api/v1/orders", viewer, orderJson(customerId, productId, 1)).andExpect(status().isForbidden());
		postJson("/api/v1/orders/" + orderId + "/confirm", viewer, "").andExpect(status().isForbidden());

		String operator = tokenFor(Role.OPERATOR);
		postJson("/api/v1/orders/" + orderId + "/confirm", operator, "").andExpect(status().isOk())
			.andExpect(jsonPath("$.history[*].changedBy").value(hasItem(org.hamcrest.Matchers.startsWith("operator-"))));

		getJson("/api/v1/orders", "").andExpect(status().isUnauthorized());
	}

	@Test
	void un_ordine_inesistente_da_404() throws Exception {
		getJson("/api/v1/orders/" + java.util.UUID.randomUUID(), adminToken()).andExpect(status().isNotFound());
	}

}
