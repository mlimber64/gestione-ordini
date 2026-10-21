package it.limber.ordini.catalog;

import it.limber.ordini.ApiTestSupport;
import it.limber.ordini.IntegrationTest;
import it.limber.ordini.identity.domain.Role;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.hasKey;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class CatalogIntegrationTest extends ApiTestSupport {

	private String categoryJson(String name, String parentId) {
		String parent = parentId == null ? "null" : "\"" + parentId + "\"";
		return "{\"name\":\"%s\",\"parentId\":%s}".formatted(name, parent);
	}

	private String productJson(String sku, String name, String categoryId, String price, String vat) {
		return """
				{"sku":"%s","name":"%s","description":"Descrizione","categoryId":"%s","unitPrice":%s,"vatRate":%s}"""
			.formatted(sku, name, categoryId, price, vat);
	}

	private String createCategory(String token, String name, String parentId) throws Exception {
		return idOf(postJson("/api/v1/categories", token, categoryJson(name, parentId)).andExpect(status().isCreated()));
	}

	private String createProduct(String token, String sku, String name, String categoryId, String price)
			throws Exception {
		return idOf(postJson("/api/v1/products", token, productJson(sku, name, categoryId, price, "22"))
			.andExpect(status().isCreated()));
	}

	@Test
	void l_amministratore_crea_categorie_gerarchiche() throws Exception {
		String token = adminToken();
		String parent = createCategory(token, unique("Alimentari"), null);

		postJson("/api/v1/categories", token, categoryJson(unique("Pasta"), parent)).andExpect(status().isCreated())
			.andExpect(jsonPath("$.parentId").value(parent));
	}

	@Test
	void non_ammette_categorie_con_lo_stesso_nome() throws Exception {
		String token = adminToken();
		String name = unique("Bevande");
		createCategory(token, name, null);

		postJson("/api/v1/categories", token, categoryJson(name.toUpperCase(), null)).andExpect(status().isConflict());
	}

	@Test
	void rifiuta_i_cicli_nella_gerarchia() throws Exception {
		String token = adminToken();
		String root = createCategory(token, unique("Radice"), null);
		String child = createCategory(token, unique("Figlia"), root);

		putJson("/api/v1/categories/" + root, token, categoryJson(unique("Radice"), child))
			.andExpect(status().isUnprocessableEntity());
		putJson("/api/v1/categories/" + root, token, categoryJson(unique("Radice"), root))
			.andExpect(status().isUnprocessableEntity());
	}

	@Test
	void tutti_leggono_le_categorie_ma_solo_l_amministratore_le_modifica() throws Exception {
		getJson("/api/v1/categories", tokenFor(Role.VIEWER)).andExpect(status().isOk());
		postJson("/api/v1/categories", tokenFor(Role.OPERATOR), categoryJson(unique("Vietata"), null))
			.andExpect(status().isForbidden());
	}

	@Test
	void crea_un_prodotto_normalizzando_lo_sku_e_i_decimali() throws Exception {
		String token = adminToken();
		String category = createCategory(token, unique("Categoria"), null);
		String sku = unique("pasta");

		postJson("/api/v1/products", token, productJson(sku, "Spaghetti 500g", category, "1.5", "4"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.sku").value(sku.toUpperCase()))
			.andExpect(jsonPath("$.unitPrice").value(1.5))
			.andExpect(jsonPath("$.vatRate").value(4.0))
			.andExpect(jsonPath("$.active").value(true))
			.andExpect(jsonPath("$.categoryId").value(category));
	}

	@Test
	void non_ammette_sku_duplicati_ne_senza_distinzione_tra_maiuscole() throws Exception {
		String token = adminToken();
		String category = createCategory(token, unique("Categoria"), null);
		String sku = unique("dup");
		createProduct(token, sku, "Primo", category, "2.00");

		postJson("/api/v1/products", token, productJson(sku.toLowerCase(), "Secondo", category, "3.00", "22"))
			.andExpect(status().isConflict());
	}

	@Test
	void rifiuta_prezzo_negativo_e_campi_mancanti() throws Exception {
		String token = adminToken();
		String category = createCategory(token, unique("Categoria"), null);

		postJson("/api/v1/products", token, productJson(unique("neg"), "Negativo", category, "-1", "22"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors").value(hasKey("unitPrice")));
		postJson("/api/v1/products", token, "{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors").value(hasKey("sku")))
			.andExpect(jsonPath("$.errors").value(hasKey("categoryId")));
	}

	@Test
	void rifiuta_un_aliquota_iva_non_italiana() throws Exception {
		String token = adminToken();
		String category = createCategory(token, unique("Categoria"), null);

		postJson("/api/v1/products", token, productJson(unique("iva"), "Iva errata", category, "10.00", "30"))
			.andExpect(status().isUnprocessableEntity());
	}

	@Test
	void rifiuta_una_categoria_inesistente() throws Exception {
		postJson("/api/v1/products", adminToken(),
				productJson(unique("nocat"), "Senza categoria", java.util.UUID.randomUUID().toString(), "1.00", "22"))
			.andExpect(status().isUnprocessableEntity());
	}

	@Test
	void solo_l_amministratore_scrive_il_catalogo() throws Exception {
		String category = createCategory(adminToken(), unique("Categoria"), null);
		String body = productJson(unique("perm"), "Permessi", category, "1.00", "22");

		postJson("/api/v1/products", tokenFor(Role.OPERATOR), body).andExpect(status().isForbidden());
		postJson("/api/v1/products", tokenFor(Role.VIEWER), body).andExpect(status().isForbidden());
		getJson("/api/v1/products", tokenFor(Role.VIEWER)).andExpect(status().isOk());
	}

	@Test
	void lo_sku_non_si_puo_modificare_ma_gli_altri_campi_si() throws Exception {
		String token = adminToken();
		String category = createCategory(token, unique("Categoria"), null);
		String sku = unique("mod");
		String id = createProduct(token, sku, "Nome vecchio", category, "5.00");

		putJson("/api/v1/products/" + id, token, productJson(sku, "Nome nuovo", category, "6.50", "10"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.name").value("Nome nuovo"))
			.andExpect(jsonPath("$.unitPrice").value(6.5))
			.andExpect(jsonPath("$.vatRate").value(10.0));
		putJson("/api/v1/products/" + id, token, productJson(unique("altro"), "Nome nuovo", category, "6.50", "10"))
			.andExpect(status().isUnprocessableEntity());
	}

	@Test
	void attiva_e_disattiva_un_prodotto() throws Exception {
		String token = adminToken();
		String category = createCategory(token, unique("Categoria"), null);
		String id = createProduct(token, unique("act"), "Attivabile", category, "1.00");

		patchJson("/api/v1/products/" + id + "/active", token, "{\"active\":false}").andExpect(status().isOk())
			.andExpect(jsonPath("$.active").value(false));
		patchJson("/api/v1/products/" + id + "/active", token, "{}").andExpect(status().isBadRequest());
	}

	@Test
	void filtra_cerca_ordina_e_pagina_i_prodotti() throws Exception {
		String token = adminToken();
		String category = createCategory(token, unique("Filtro"), null);
		String otherCategory = createCategory(token, unique("Altra"), null);
		String marker = unique("zzprod");
		createProduct(token, marker + "-A", marker + " Alfa", category, "3.00");
		createProduct(token, marker + "-B", marker + " Beta", category, "1.00");
		String gammaId = createProduct(token, marker + "-C", marker + " Gamma", category, "2.00");
		createProduct(token, marker + "-D", "Altro " + marker, otherCategory, "9.00");
		patchJson("/api/v1/products/" + gammaId + "/active", token, "{\"active\":false}").andExpect(status().isOk());

		getJson("/api/v1/products?q=" + marker, token).andExpect(jsonPath("$.totalElements").value(4));
		getJson("/api/v1/products?q=" + marker + "&categoryId=" + category, token)
			.andExpect(jsonPath("$.totalElements").value(3));
		getJson("/api/v1/products?q=" + marker + "&active=false", token).andExpect(jsonPath("$.totalElements").value(1));
		getJson("/api/v1/products?q=" + marker.toUpperCase() + "-b", token).andExpect(jsonPath("$.totalElements").value(1));

		getJson("/api/v1/products?q=" + marker + "&categoryId=" + category + "&sort=unitPrice,desc", token)
			.andExpect(jsonPath("$.content[0].sku").value((marker + "-A").toUpperCase()))
			.andExpect(jsonPath("$.content[2].sku").value((marker + "-B").toUpperCase()));
		getJson("/api/v1/products?q=" + marker + "&size=3&page=1", token)
			.andExpect(jsonPath("$.content.length()").value(1))
			.andExpect(jsonPath("$.totalPages").value(2))
			.andExpect(jsonPath("$.page").value(1));
	}

	@Test
	void non_ammette_un_campo_di_ordinamento_sconosciuto() throws Exception {
		getJson("/api/v1/products?sort=descrizione", adminToken()).andExpect(status().isUnprocessableEntity());
	}

}
