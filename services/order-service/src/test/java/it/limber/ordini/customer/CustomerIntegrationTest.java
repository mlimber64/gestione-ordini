package it.limber.ordini.customer;

import com.jayway.jsonpath.JsonPath;
import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.IntegrationTest;
import it.limber.ordini.identity.domain.Role;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;

import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class CustomerIntegrationTest extends ApiTestSupport {

	private static final String VAT_1 = "12345678903";

	private static final String VAT_2 = "12345678911";

	private String customerJson(String name, String email, String vat) {
		String vatField = vat == null ? "null" : "\"" + vat + "\"";
		return """
				{"name":"%s","email":"%s","phone":"+39 089 123456","vatNumber":%s,"taxCode":null}"""
			.formatted(name, email, vatField);
	}

	private String addressJson(String type, String street, String postalCode, boolean isDefault) {
		return """
				{"type":"%s","street":"%s","city":"Salerno","province":"sa","postalCode":"%s","country":"IT","defaultAddress":%s}"""
			.formatted(type, street, postalCode, isDefault);
	}

	private String createCustomer(String token, String name, String email, String vat) throws Exception {
		return idOf(postJson("/api/v1/customers", token, customerJson(name, email, vat)).andExpect(status().isCreated()));
	}

	@Test
	void crea_un_cliente_con_codice_progressivo_e_location() throws Exception {
		String token = adminToken();
		postJson("/api/v1/customers", token, customerJson("Rossi Srl", unique("rossi") + "@example.it", VAT_1))
			.andExpect(status().isCreated())
			.andExpect(header().string("Location", startsWith("http://localhost/api/v1/customers/")))
			.andExpect(jsonPath("$.code").value(startsWith("CLI-")))
			.andExpect(jsonPath("$.status").value("ACTIVE"))
			.andExpect(jsonPath("$.vatNumber").value(VAT_1))
			.andExpect(jsonPath("$.addresses").isEmpty());
	}

	@Test
	void normalizza_l_email_in_minuscolo() throws Exception {
		String email = unique("MaiuSCola") + "@Example.IT";
		postJson("/api/v1/customers", adminToken(), customerJson("Verdi Spa", email, null))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.email").value(email.toLowerCase()));
	}

	@Test
	void rifiuta_una_partita_iva_con_cifra_di_controllo_errata() throws Exception {
		postJson("/api/v1/customers", adminToken(), customerJson("Bianchi", unique("b") + "@example.it", "12345678900"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors").value(hasKey("vatNumber")));
	}

	@Test
	void rifiuta_dati_obbligatori_mancanti_ed_email_non_valida() throws Exception {
		postJson("/api/v1/customers", adminToken(), "{\"name\":\"\",\"email\":\"non-una-email\"}")
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors").value(hasKey("name")))
			.andExpect(jsonPath("$.errors").value(hasKey("email")));
	}

	@Test
	void non_ammette_email_o_partita_iva_duplicate() throws Exception {
		String token = adminToken();
		String email = unique("dup") + "@example.it";
		createCustomer(token, "Primo", email, VAT_2);

		postJson("/api/v1/customers", token, customerJson("Secondo", email.toUpperCase(), null))
			.andExpect(status().isConflict());
		postJson("/api/v1/customers", token, customerJson("Terzo", unique("altro") + "@example.it", VAT_2))
			.andExpect(status().isConflict());
	}

	@Test
	void restituisce_404_per_un_cliente_inesistente() throws Exception {
		getJson("/api/v1/customers/" + java.util.UUID.randomUUID(), adminToken()).andExpect(status().isNotFound())
			.andExpect(jsonPath("$.status").value(404));
		getJson("/api/v1/customers/non-e-un-uuid", adminToken()).andExpect(status().isBadRequest());
	}

	@Test
	void aggiorna_i_dati_di_un_cliente() throws Exception {
		String token = adminToken();
		String id = createCustomer(token, "Vecchio Nome", unique("agg") + "@example.it", null);

		putJson("/api/v1/customers/" + id, token, customerJson("Nuovo Nome", unique("nuovo") + "@example.it", VAT_1))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Nuovo Nome"))
			.andExpect(jsonPath("$.vatNumber").value(VAT_1));
	}

	@Test
	void la_cancellazione_blocca_il_cliente_senza_eliminarlo() throws Exception {
		String token = adminToken();
		String id = createCustomer(token, "Da Bloccare", unique("blocco") + "@example.it", null);

		deleteJson("/api/v1/customers/" + id, token).andExpect(status().isNoContent());
		getJson("/api/v1/customers/" + id, token).andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("BLOCKED"));
	}

	@Test
	void il_ruolo_viewer_legge_ma_non_scrive() throws Exception {
		String viewer = tokenFor(Role.VIEWER);
		getJson("/api/v1/customers", viewer).andExpect(status().isOk());
		postJson("/api/v1/customers", viewer, customerJson("Vietato", unique("v") + "@example.it", null))
			.andExpect(status().isForbidden());
	}

	@Test
	void il_ruolo_operator_puo_creare_clienti() throws Exception {
		postJson("/api/v1/customers", tokenFor(Role.OPERATOR), customerJson("Operatore", unique("op") + "@example.it", null))
			.andExpect(status().isCreated());
	}

	@Test
	void aggiunge_un_indirizzo_e_normalizza_la_provincia() throws Exception {
		String token = adminToken();
		String id = createCustomer(token, "Con Indirizzo", unique("ind") + "@example.it", null);

		postJson("/api/v1/customers/" + id + "/addresses", token, addressJson("SHIPPING", "Via Roma 1", "84121", false))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.province").value("SA"))
			.andExpect(jsonPath("$.country").value("IT"));

		getJson("/api/v1/customers/" + id, token).andExpect(jsonPath("$.addresses.length()").value(1));
	}

	@Test
	void rifiuta_un_cap_non_valido() throws Exception {
		String token = adminToken();
		String id = createCustomer(token, "Cap Errato", unique("cap") + "@example.it", null);

		postJson("/api/v1/customers/" + id + "/addresses", token, addressJson("BILLING", "Via Roma 1", "8412", false))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors").value(hasKey("postalCode")));
	}

	@Test
	void un_solo_indirizzo_predefinito_per_tipo() throws Exception {
		String token = adminToken();
		String id = createCustomer(token, "Predefiniti", unique("pre") + "@example.it", null);

		postJson("/api/v1/customers/" + id + "/addresses", token, addressJson("SHIPPING", "Via Uno 1", "84121", true))
			.andExpect(status().isCreated());
		String secondId = idOf(postJson("/api/v1/customers/" + id + "/addresses", token,
				addressJson("SHIPPING", "Via Due 2", "84122", true)).andExpect(status().isCreated()));
		postJson("/api/v1/customers/" + id + "/addresses", token, addressJson("BILLING", "Via Tre 3", "84123", true))
			.andExpect(status().isCreated());

		String body = getJson("/api/v1/customers/" + id, token).andReturn().getResponse().getContentAsString();
		List<String> shippingDefaults = JsonPath.read(body,
				"$.addresses[?(@.type == 'SHIPPING' && @.defaultAddress == true)].id");
		List<String> billingDefaults = JsonPath.read(body,
				"$.addresses[?(@.type == 'BILLING' && @.defaultAddress == true)].id");
		org.assertj.core.api.Assertions.assertThat(shippingDefaults).containsExactly(secondId);
		org.assertj.core.api.Assertions.assertThat(billingDefaults).hasSize(1);
	}

	@Test
	void modifica_ed_elimina_un_indirizzo() throws Exception {
		String token = adminToken();
		String id = createCustomer(token, "Modifica Indirizzo", unique("mod") + "@example.it", null);
		String addressId = idOf(postJson("/api/v1/customers/" + id + "/addresses", token,
				addressJson("SHIPPING", "Via Vecchia 1", "84121", false)).andExpect(status().isCreated()));

		putJson("/api/v1/customers/" + id + "/addresses/" + addressId, token,
				addressJson("SHIPPING", "Via Nuova 9", "84125", true))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.street").value("Via Nuova 9"))
			.andExpect(jsonPath("$.defaultAddress").value(true));

		deleteJson("/api/v1/customers/" + id + "/addresses/" + addressId, token).andExpect(status().isNoContent());
		getJson("/api/v1/customers/" + id, token).andExpect(jsonPath("$.addresses").isEmpty());
		deleteJson("/api/v1/customers/" + id + "/addresses/" + addressId, token).andExpect(status().isNotFound());
	}

	@Test
	void cerca_per_testo_e_stato_con_paginazione() throws Exception {
		String token = adminToken();
		String marker = unique("zzmarker");
		for (int i = 1; i <= 3; i++) {
			createCustomer(token, marker + " Cliente " + i, unique("ric" + i) + "@example.it", null);
		}
		String blockedId = createCustomer(token, marker + " Bloccato", unique("blk") + "@example.it", null);
		deleteJson("/api/v1/customers/" + blockedId, token).andExpect(status().isNoContent());

		ResultActions all = getJson("/api/v1/customers?q=" + marker + "&size=2&sort=name,asc", token);
		all.andExpect(status().isOk())
			.andExpect(jsonPath("$.totalElements").value(4))
			.andExpect(jsonPath("$.totalPages").value(2))
			.andExpect(jsonPath("$.content.length()").value(2));

		getJson("/api/v1/customers?q=" + marker + "&status=BLOCKED", token).andExpect(jsonPath("$.totalElements").value(1));
		getJson("/api/v1/customers?q=" + marker + "&status=ACTIVE", token).andExpect(jsonPath("$.totalElements").value(3));
	}

	@Test
	void rifiuta_parametri_di_paginazione_e_ordinamento_non_validi() throws Exception {
		String token = adminToken();
		getJson("/api/v1/customers?size=1000", token).andExpect(status().isBadRequest());
		getJson("/api/v1/customers?page=-1", token).andExpect(status().isBadRequest());
		getJson("/api/v1/customers?sort=passwordHash", token).andExpect(status().isUnprocessableEntity());
	}

}
