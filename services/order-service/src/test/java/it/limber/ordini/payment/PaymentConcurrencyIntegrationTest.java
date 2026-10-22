package it.limber.ordini.payment;

import com.jayway.jsonpath.JsonPath;
import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.CommittedIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;

import static org.assertj.core.api.Assertions.assertThat;

/** Più registrazioni simultanee sullo stesso ordine: insieme non possono superarne il totale. */
@CommittedIntegrationTest
class PaymentConcurrencyIntegrationTest extends ApiTestSupport {

	@Autowired
	private JdbcClient jdbc;

	private final List<UUID> products = new ArrayList<>();

	private final List<UUID> customers = new ArrayList<>();

	@AfterEach
	void cleanUp() {
		if (customers.isEmpty() && products.isEmpty()) {
			return;
		}
		jdbc.sql("""
				DELETE FROM orders.payment WHERE order_id IN (SELECT id FROM orders.sales_order WHERE customer_id IN (:ids))""")
			.param("ids", customers)
			.update();
		jdbc.sql("DELETE FROM orders.sales_order WHERE customer_id IN (:ids)").param("ids", customers).update();
		jdbc.sql("DELETE FROM orders.stock_movement WHERE product_id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.inventory WHERE product_id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.product WHERE id IN (:ids)").param("ids", products).update();
		jdbc.sql("DELETE FROM orders.customer WHERE id IN (:ids)").param("ids", customers).update();
		products.clear();
		customers.clear();
	}

	@Test
	void dieci_pagamenti_simultanei_da_dieci_euro_su_un_ordine_da_61_ne_accettano_esattamente_sei() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		products.add(UUID.fromString(productId));
		receiveStock(token, productId, 10);
		String customerId = createCustomerWithAddress(token);
		customers.add(UUID.fromString(customerId));
		// 5 x 10,00 + IVA 22% = 61,00
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 5)));

		List<Callable<Integer>> actions = new ArrayList<>();
		for (int i = 0; i < 10; i++) {
			actions.add(() -> postJson("/api/v1/orders/" + orderId + "/payments", token,
					"{\"method\":\"BANK_TRANSFER\",\"amount\":10.00,\"reference\":null}")
				.andReturn()
				.getResponse()
				.getStatus());
		}
		List<Integer> statuses = runTogether(actions);

		assertThat(statuses.stream().filter(code -> code == 201).count()).isEqualTo(6);
		assertThat(statuses.stream().filter(code -> code == 422).count()).isEqualTo(4);
		String body = getJson("/api/v1/orders/" + orderId + "/payments", token).andReturn()
			.getResponse()
			.getContentAsString();
		assertThat(new BigDecimal(JsonPath.<Number>read(body, "$.pending").toString())).isEqualByComparingTo("60.00");
		assertThat(new BigDecimal(JsonPath.<Number>read(body, "$.registrable").toString())).isEqualByComparingTo("1.00");
		assertThat(JsonPath.<List<Object>>read(body, "$.payments")).hasSize(6);
	}

	@Test
	void un_doppio_clic_su_incassa_lo_registra_una_volta_sola() throws Exception {
		String token = adminToken();
		String productId = createProduct(token, "10.00", "22");
		products.add(UUID.fromString(productId));
		receiveStock(token, productId, 10);
		String customerId = createCustomerWithAddress(token);
		customers.add(UUID.fromString(customerId));
		String orderId = idOf(postJson("/api/v1/orders", token, orderJson(customerId, productId, 1)));
		String paymentId = idOf(postJson("/api/v1/orders/" + orderId + "/payments", token,
				"{\"method\":\"CARD\",\"amount\":12.20,\"reference\":null}"));

		List<Callable<Integer>> actions = new ArrayList<>();
		for (int i = 0; i < 6; i++) {
			actions.add(() -> postJson("/api/v1/payments/" + paymentId + "/pay", token, "").andReturn()
				.getResponse()
				.getStatus());
		}
		List<Integer> statuses = runTogether(actions);

		assertThat(statuses.stream().filter(code -> code == 200).count()).isEqualTo(1);
		assertThat(statuses).allMatch(code -> code == 200 || code == 409 || code == 422);
	}

}
