package it.limber.ordini.payment;

import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.IntegrationTest;
import it.limber.ordini.identity.domain.Role;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class PaymentIntegrationTest extends ApiTestSupport {

	/** Ordine di 3 pezzi a 10,00 con IVA 22%: totale 36,60. */
	private String order(String token) throws Exception {
		String productId = createProduct(token, "10.00", "22");
		String customerId = createCustomerWithAddress(token);
		receiveStock(token, productId, 10);
		return idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 3)));
	}

	private static String payment(String method, String amount) {
		return "{\"method\":\"%s\",\"amount\":%s,\"reference\":\"CRO-1\"}".formatted(method, amount);
	}

	@Test
	void un_ordine_senza_pagamenti_risulta_da_incassare_per_intero() throws Exception {
		String token = adminToken();
		String orderId = order(token);

		getJson("/api/v1/orders/" + orderId + "/payments", token).andExpect(status().isOk())
			.andExpect(jsonPath("$.total").value(36.60))
			.andExpect(jsonPath("$.paid").value(0))
			.andExpect(jsonPath("$.pending").value(0))
			.andExpect(jsonPath("$.balance").value(36.60))
			.andExpect(jsonPath("$.registrable").value(36.60))
			.andExpect(jsonPath("$.settlement").value("UNPAID"))
			.andExpect(jsonPath("$.payments.length()").value(0));
	}

	@Test
	void registra_un_pagamento_in_attesa_e_poi_lo_incassa() throws Exception {
		String token = adminToken();
		String orderId = order(token);

		String paymentId = idOf(postJson("/api/v1/orders/" + orderId + "/payments", token,
				payment("BANK_TRANSFER", "36.60")).andExpect(status().isCreated())
			.andExpect(jsonPath("$.status").value("PENDING"))
			.andExpect(jsonPath("$.method").value("BANK_TRANSFER"))
			.andExpect(jsonPath("$.amount").value(36.60))
			.andExpect(jsonPath("$.reference").value("CRO-1"))
			.andExpect(jsonPath("$.paidAt").doesNotExist()));
		getJson("/api/v1/orders/" + orderId + "/payments", token).andExpect(jsonPath("$.pending").value(36.60))
			.andExpect(jsonPath("$.registrable").value(0))
			.andExpect(jsonPath("$.settlement").value("UNPAID"));

		postJson("/api/v1/payments/" + paymentId + "/pay", token, "").andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("PAID"))
			.andExpect(jsonPath("$.paidAt").exists());

		getJson("/api/v1/orders/" + orderId + "/payments", token).andExpect(jsonPath("$.paid").value(36.60))
			.andExpect(jsonPath("$.pending").value(0))
			.andExpect(jsonPath("$.balance").value(0))
			.andExpect(jsonPath("$.settlement").value("PAID"));
	}

	@Test
	void il_pagamento_non_cambia_lo_stato_dell_ordine() throws Exception {
		String token = adminToken();
		String orderId = order(token);
		String paymentId = idOf(postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "36.60")));
		postJson("/api/v1/payments/" + paymentId + "/pay", token, "").andExpect(status().isOk());

		getJson("/api/v1/orders/" + orderId, token).andExpect(jsonPath("$.status").value("PENDING"));
	}

	@Test
	void con_piu_acconti_l_ordine_e_parzialmente_pagato_finche_non_si_salda() throws Exception {
		String token = adminToken();
		String orderId = order(token);
		String first = idOf(postJson("/api/v1/orders/" + orderId + "/payments", token, payment("BANK_TRANSFER", "10.00")));
		postJson("/api/v1/payments/" + first + "/pay", token, "").andExpect(status().isOk());

		getJson("/api/v1/orders/" + orderId + "/payments", token).andExpect(jsonPath("$.settlement").value("PARTIAL"))
			.andExpect(jsonPath("$.paid").value(10.00))
			.andExpect(jsonPath("$.balance").value(26.60))
			.andExpect(jsonPath("$.registrable").value(26.60));

		String second = idOf(postJson("/api/v1/orders/" + orderId + "/payments", token,
				payment("CASH_ON_DELIVERY", "26.60")));
		postJson("/api/v1/payments/" + second + "/pay", token, "").andExpect(status().isOk());

		getJson("/api/v1/orders/" + orderId + "/payments", token).andExpect(jsonPath("$.settlement").value("PAID"))
			.andExpect(jsonPath("$.payments.length()").value(2))
			.andExpect(jsonPath("$.payments[0].method").value("BANK_TRANSFER"))
			.andExpect(jsonPath("$.payments[1].method").value("CASH_ON_DELIVERY"));
	}

	@Test
	void non_si_puo_superare_l_importo_dell_ordine_contando_anche_i_pagamenti_in_attesa() throws Exception {
		String token = adminToken();
		String orderId = order(token);
		postJson("/api/v1/orders/" + orderId + "/payments", token, payment("BANK_TRANSFER", "30.00"))
			.andExpect(status().isCreated());

		postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "6.61"))
			.andExpect(status().isUnprocessableEntity())
			.andExpect(jsonPath("$.detail").value(containsString("supera")));
		postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "6.60")).andExpect(status().isCreated());
	}

	@Test
	void un_pagamento_fallito_libera_l_importo_che_occupava() throws Exception {
		String token = adminToken();
		String orderId = order(token);
		String paymentId = idOf(postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "36.60")));
		postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "1.00"))
			.andExpect(status().isUnprocessableEntity());

		postJson("/api/v1/payments/" + paymentId + "/fail", token, "").andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("FAILED"));

		getJson("/api/v1/orders/" + orderId + "/payments", token).andExpect(jsonPath("$.registrable").value(36.60))
			.andExpect(jsonPath("$.settlement").value("UNPAID"));
		postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "36.60")).andExpect(status().isCreated());
	}

	@Test
	void il_rimborso_restituisce_l_importo_da_incassare() throws Exception {
		String token = adminToken();
		String orderId = order(token);
		String paymentId = idOf(postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "36.60")));
		postJson("/api/v1/payments/" + paymentId + "/pay", token, "").andExpect(status().isOk());

		postJson("/api/v1/payments/" + paymentId + "/refund", token, "").andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("REFUNDED"))
			.andExpect(jsonPath("$.paidAt").exists());

		getJson("/api/v1/orders/" + orderId + "/payments", token).andExpect(jsonPath("$.paid").value(0))
			.andExpect(jsonPath("$.balance").value(36.60))
			.andExpect(jsonPath("$.settlement").value("UNPAID"));
	}

	@Test
	void le_transizioni_non_consentite_si_rifiutano() throws Exception {
		String token = adminToken();
		String orderId = order(token);
		String paymentId = idOf(postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "10.00")));

		postJson("/api/v1/payments/" + paymentId + "/refund", token, "").andExpect(status().isUnprocessableEntity());
		postJson("/api/v1/payments/" + paymentId + "/pay", token, "").andExpect(status().isOk());
		postJson("/api/v1/payments/" + paymentId + "/pay", token, "").andExpect(status().isUnprocessableEntity());
		postJson("/api/v1/payments/" + paymentId + "/fail", token, "").andExpect(status().isUnprocessableEntity());
	}

	@Test
	void per_un_ordine_annullato_non_si_registrano_pagamenti() throws Exception {
		String token = adminToken();
		String orderId = order(token);
		postJson("/api/v1/orders/" + orderId + "/cancel", token, "{\"reason\":\"prova\"}").andExpect(status().isOk());

		postJson("/api/v1/orders/" + orderId + "/payments", token, payment("CARD", "10.00"))
			.andExpect(status().isUnprocessableEntity())
			.andExpect(jsonPath("$.detail").value(containsString("annullato")));
		// La lettura resta possibile: serve a vedere cosa era stato pagato prima dell'annullamento
		getJson("/api/v1/orders/" + orderId + "/payments", token).andExpect(status().isOk());
	}

	@Test
	void controlla_i_dati_in_ingresso() throws Exception {
		String token = adminToken();
		String orderId = order(token);
		String url = "/api/v1/orders/" + orderId + "/payments";

		postJson(url, token, payment("CARD", "0")).andExpect(status().isBadRequest());
		postJson(url, token, payment("CARD", "-3")).andExpect(status().isBadRequest());
		postJson(url, token, payment("CARD", "1.234")).andExpect(status().isBadRequest());
		postJson(url, token, "{\"amount\":10.00}").andExpect(status().isBadRequest());
		postJson(url, token, payment("ASSEGNO", "10.00")).andExpect(status().isBadRequest());
		postJson(url, token, "{\"method\":\"CARD\",\"amount\":10.00,\"reference\":\"%s\"}".formatted("x".repeat(101)))
			.andExpect(status().isBadRequest());
	}

	@Test
	void ordine_e_pagamento_inesistenti_danno_404() throws Exception {
		String token = adminToken();

		getJson("/api/v1/orders/" + UUID.randomUUID() + "/payments", token).andExpect(status().isNotFound());
		postJson("/api/v1/orders/" + UUID.randomUUID() + "/payments", token, payment("CARD", "10.00"))
			.andExpect(status().isNotFound());
		postJson("/api/v1/payments/" + UUID.randomUUID() + "/pay", token, "").andExpect(status().isNotFound());
	}

	@Test
	void chi_ha_il_ruolo_di_sola_lettura_vede_i_pagamenti_ma_non_li_modifica() throws Exception {
		String admin = adminToken();
		String orderId = order(admin);
		String paymentId = idOf(postJson("/api/v1/orders/" + orderId + "/payments", admin, payment("CARD", "10.00")));
		String viewer = tokenFor(Role.VIEWER);

		getJson("/api/v1/orders/" + orderId + "/payments", viewer).andExpect(status().isOk())
			.andExpect(jsonPath("$.payments.length()").value(1));
		postJson("/api/v1/orders/" + orderId + "/payments", viewer, payment("CARD", "5.00")).andExpect(status().isForbidden());
		postJson("/api/v1/payments/" + paymentId + "/pay", viewer, "").andExpect(status().isForbidden());
		postJson("/api/v1/payments/" + paymentId + "/fail", viewer, "").andExpect(status().isForbidden());
		postJson("/api/v1/payments/" + paymentId + "/refund", viewer, "").andExpect(status().isForbidden());
	}

	@Test
	void un_operatore_puo_registrare_e_incassare() throws Exception {
		String admin = adminToken();
		String orderId = order(admin);
		String operator = tokenFor(Role.OPERATOR);

		String paymentId = idOf(postJson("/api/v1/orders/" + orderId + "/payments", operator, payment("CARD", "10.00"))
			.andExpect(status().isCreated()));
		postJson("/api/v1/payments/" + paymentId + "/pay", operator, "").andExpect(status().isOk())
			.andExpect(jsonPath("$.updatedBy").value(org.hamcrest.Matchers.startsWith("operator-")));
	}

	@Test
	void senza_token_non_si_entra() throws Exception {
		mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
			.get("/api/v1/orders/" + UUID.randomUUID() + "/payments")).andExpect(status().isUnauthorized());
	}

}
