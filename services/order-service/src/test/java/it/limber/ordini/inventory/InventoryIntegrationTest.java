package it.limber.ordini.inventory;

import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.IntegrationTest;
import it.limber.ordini.identity.domain.Role;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class InventoryIntegrationTest extends ApiTestSupport {

	@Test
	void un_prodotto_senza_movimenti_ha_giacenza_zero() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");

		getJson("/api/v1/inventory/" + productId, token).andExpect(status().isOk())
			.andExpect(jsonPath("$.onHand").value(0))
			.andExpect(jsonPath("$.reserved").value(0))
			.andExpect(jsonPath("$.available").value(0));
	}

	@Test
	void il_carico_aumenta_la_giacenza_e_lascia_un_movimento() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");

		postJson("/api/v1/inventory/" + productId + "/receipts", token, "{\"quantity\":25,\"note\":\"bolla 123\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.onHand").value(25))
			.andExpect(jsonPath("$.available").value(25));
		postJson("/api/v1/inventory/" + productId + "/receipts", token, "{\"quantity\":5}")
			.andExpect(jsonPath("$.onHand").value(30));

		getJson("/api/v1/inventory/" + productId + "/movements", token).andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(2))
			.andExpect(jsonPath("$.content[*].type").value(hasItem("RECEIPT")))
			.andExpect(jsonPath("$.content[*].note").value(hasItem("bolla 123")));
	}

	@Test
	void rifiuta_un_carico_non_positivo() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");

		postJson("/api/v1/inventory/" + productId + "/receipts", token, "{\"quantity\":0}")
			.andExpect(status().isBadRequest());
	}

	@Test
	void la_rettifica_negativa_non_puo_scendere_sotto_il_riservato() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);
		postJson("/api/v1/orders", token, orderJson(customerId, productId, 6)).andExpect(status().isCreated());

		// 10 in magazzino, 6 riservati: si possono togliere al massimo 4
		postJson("/api/v1/inventory/" + productId + "/adjustments", token, "{\"delta\":-5,\"note\":\"conteggio\"}")
			.andExpect(status().isUnprocessableEntity());
		postJson("/api/v1/inventory/" + productId + "/adjustments", token, "{\"delta\":-4,\"note\":\"rottura\"}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.onHand").value(6))
			.andExpect(jsonPath("$.available").value(0));
	}

	@Test
	void la_rettifica_richiede_un_motivo_e_non_puo_essere_zero() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");

		postJson("/api/v1/inventory/" + productId + "/adjustments", token, "{\"delta\":3}")
			.andExpect(status().isBadRequest());
		postJson("/api/v1/inventory/" + productId + "/adjustments", token, "{\"delta\":0,\"note\":\"niente\"}")
			.andExpect(status().isUnprocessableEntity());
	}

	@Test
	void la_soglia_di_riordino_segnala_la_scorta_bassa() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		receiveStock(token, productId, 8);

		patchJson("/api/v1/inventory/" + productId + "/reorder-level", token, "{\"reorderLevel\":10}")
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.lowStock").value(true));
		getJson("/api/v1/inventory?lowStock=true&size=100", token).andExpect(status().isOk())
			.andExpect(jsonPath("$.content[*].productId").value(hasItem(productId)));

		receiveStock(token, productId, 5);
		getJson("/api/v1/inventory/" + productId, token).andExpect(jsonPath("$.lowStock").value(false));
	}

	@Test
	void il_viewer_legge_ma_non_modifica() throws Exception {
		String admin = adminToken();
		String productId = createProduct(admin, "10.00", "22");
		String viewer = tokenFor(Role.VIEWER);

		getJson("/api/v1/inventory/" + productId, viewer).andExpect(status().isOk());
		postJson("/api/v1/inventory/" + productId + "/receipts", viewer, "{\"quantity\":1}")
			.andExpect(status().isForbidden());
	}

	@Test
	void un_prodotto_inesistente_da_404() throws Exception {
		getJson("/api/v1/inventory/" + java.util.UUID.randomUUID(), adminToken()).andExpect(status().isNotFound());
	}

}
