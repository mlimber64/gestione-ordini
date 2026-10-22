package it.limber.ordini.shared.outbox;

import it.limber.ordini.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La pulizia dell'outbox nei due modi. Gira dentro la transazione di test (annullata alla fine): le righe finte
 * non restano nel database.
 */
@IntegrationTest
class OutboxCleanupIntegrationTest {

	@Autowired
	private JdbcClient jdbc;

	private UUID insert(String createdAgo, String publishedAgo) {
		UUID id = UUID.randomUUID();
		jdbc.sql("""
				INSERT INTO orders.outbox_event (id, aggregate_type, aggregate_id, event_type, topic, payload, created_at, published_at)
				VALUES (:id, 'Order', CAST(:id AS text), 'OrderCreated', 'orders.order-created.v1', '{}'::jsonb,
				        now() - CAST(:created AS interval),
				        CASE WHEN CAST(:published AS text) IS NULL THEN NULL ELSE now() - CAST(:published AS interval) END)""")
			.param("id", id)
			.param("created", createdAgo)
			.param("published", publishedAgo)
			.update();
		return id;
	}

	private List<UUID> remaining(UUID... ids) {
		return jdbc.sql("SELECT id FROM orders.outbox_event WHERE id IN (:ids)")
			.param("ids", List.of(ids))
			.query(UUID.class)
			.list();
	}

	@Test
	void con_il_polling_toglie_solo_gli_eventi_pubblicati_da_piu_di_una_settimana() {
		UUID oldPublished = insert("10 days", "10 days");
		UUID recentPublished = insert("10 days", "2 days");
		UUID oldPending = insert("10 days", null);

		new OutboxCleanup(jdbc, OutboxMode.POLLING).cleanUp();

		// Quello non ancora pubblicato resta anche se è vecchio: il relay deve ancora mandarlo
		assertThat(remaining(oldPublished, recentPublished, oldPending)).containsExactlyInAnyOrder(recentPublished,
				oldPending);
	}

	@Test
	void con_cdc_toglie_gli_eventi_in_base_all_eta_perche_nessuno_li_segna_come_pubblicati() {
		UUID old = insert("10 days", null);
		UUID recent = insert("2 days", null);

		new OutboxCleanup(jdbc, OutboxMode.CDC).cleanUp();

		assertThat(remaining(old, recent)).containsExactly(recent);
	}

}
