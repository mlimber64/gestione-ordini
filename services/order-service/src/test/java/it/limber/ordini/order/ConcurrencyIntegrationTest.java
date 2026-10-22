package it.limber.ordini.order;

import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.CommittedIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * La prova che conta: più richieste simultanee sulle stesse scorte. Qui i dati sono confermati davvero nel
 * database (niente transazione di test) e vengono ripuliti alla fine.
 */
@CommittedIntegrationTest
class ConcurrencyIntegrationTest extends ApiTestSupport {

	@Autowired
	private JdbcClient jdbc;

	private final List<UUID> products = new ArrayList<>();

	private final List<UUID> customers = new ArrayList<>();

	@AfterEach
	void cleanUp() {
		if (customers.isEmpty() && products.isEmpty()) {
			return;
		}
		jdbc.sql("DELETE FROM orders.sales_order WHERE customer_id IN (:ids)").param("ids", customers).update();
		jdbc.sql("DELETE FROM orders.stock_movement WHERE product_id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.inventory WHERE product_id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.product WHERE id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.customer WHERE id IN (:ids)").param("ids", customers).update();
		products.clear();
		customers.clear();
	}

	private String product(String token, int stock) throws Exception {
		String id = createProduct(token, "10.00", "22");
		products.add(UUID.fromString(id));
		receiveStock(token, id, stock);
		return id;
	}

	private String customer(String token) throws Exception {
		String id = createCustomerWithAddress(token);
		customers.add(UUID.fromString(id));
		return id;
	}

	private int stockValue(String token, String productId, String field) throws Exception {
		String body = getJson("/api/v1/inventory/" + productId, token).andReturn().getResponse().getContentAsString();
		return com.jayway.jsonpath.JsonPath.read(body, "$." + field);
	}

	@Test
	void venti_richieste_per_cinque_pezzi_ne_vendono_esattamente_cinque() throws Exception {
		String token = adminToken();
		String productId = product(token, 5);
		String customerId = customer(token);

		List<Callable<Integer>> actions = new ArrayList<>();
		for (int i = 0; i < 20; i++) {
			actions.add(() -> postJson("/api/v1/orders", token, orderJson(customerId, productId, 1)).andReturn()
				.getResponse()
				.getStatus());
		}
		List<Integer> statuses = runTogether(actions);

		assertThat(statuses.stream().filter(code -> code == 201).count()).isEqualTo(5);
		assertThat(statuses.stream().filter(code -> code == 409).count()).isEqualTo(15);
		assertThat(stockValue(token, productId, "onHand")).isEqualTo(5);
		assertThat(stockValue(token, productId, "reserved")).isEqualTo(5);
		assertThat(stockValue(token, productId, "available")).isZero();
	}

	@Test
	void con_giacenza_insufficiente_su_una_riga_non_resta_nessuna_riserva() throws Exception {
		String token = adminToken();
		String first = product(token, 0);
		String second = product(token, 0);
		// Le righe si riservano in ordine di id: la scorta scarsa va al prodotto riservato per secondo,
		// così la prima riga riesce davvero e la sua riserva deve poi essere annullata.
		String abundant = UUID.fromString(first).compareTo(UUID.fromString(second)) < 0 ? first : second;
		String scarce = abundant.equals(first) ? second : first;
		receiveStock(token, abundant, 10);
		receiveStock(token, scarce, 1);
		String customerId = customer(token);

		postJson("/api/v1/orders", token, """
				{"customerId":"%s","items":[{"productId":"%s","quantity":4},{"productId":"%s","quantity":2}]}"""
			.formatted(customerId, abundant, scarce)).andExpect(status().isConflict())
			.andExpect(jsonPath("$.detail").value(containsString("Giacenza insufficiente")));

		assertThat(stockValue(token, abundant, "reserved")).isZero();
		assertThat(stockValue(token, scarce, "reserved")).isZero();
		getJson("/api/v1/orders?customerId=" + customerId, token).andExpect(jsonPath("$.totalElements").value(0));
	}

	@Test
	void ordini_con_gli_stessi_prodotti_in_ordine_inverso_non_si_bloccano_a_vicenda() throws Exception {
		String token = adminToken();
		String a = product(token, 100);
		String b = product(token, 100);
		String customerId = customer(token);
		String ab = """
				{"customerId":"%s","items":[{"productId":"%s","quantity":1},{"productId":"%s","quantity":1}]}"""
			.formatted(customerId, a, b);
		String ba = """
				{"customerId":"%s","items":[{"productId":"%s","quantity":1},{"productId":"%s","quantity":1}]}"""
			.formatted(customerId, b, a);

		List<Callable<Integer>> actions = new ArrayList<>();
		for (int i = 0; i < 10; i++) {
			String body = i % 2 == 0 ? ab : ba;
			actions.add(() -> postJson("/api/v1/orders", token, body).andReturn().getResponse().getStatus());
		}

		assertThat(runTogether(actions)).containsOnly(201);
		assertThat(stockValue(token, a, "reserved")).isEqualTo(10);
		assertThat(stockValue(token, b, "reserved")).isEqualTo(10);
	}

	@Test
	void un_doppio_clic_su_annulla_libera_la_merce_una_volta_sola() throws Exception {
		String token = adminToken();
		String productId = product(token, 10);
		String customerId = customer(token);
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 4)));

		List<Callable<Integer>> actions = new ArrayList<>();
		for (int i = 0; i < 6; i++) {
			actions.add(() -> postJson("/api/v1/orders/" + orderId + "/cancel", token, "{\"reason\":\"doppio clic\"}")
				.andReturn()
				.getResponse()
				.getStatus());
		}
		List<Integer> statuses = runTogether(actions);

		assertThat(statuses.stream().filter(code -> code == 200).count()).isEqualTo(1);
		assertThat(statuses).allMatch(code -> code == 200 || code == 409 || code == 422);
		assertThat(stockValue(token, productId, "reserved")).isZero();
		assertThat(stockValue(token, productId, "onHand")).isEqualTo(10);
	}

}
