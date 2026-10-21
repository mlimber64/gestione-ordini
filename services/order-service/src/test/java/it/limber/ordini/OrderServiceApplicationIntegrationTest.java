package it.limber.ordini;

import org.junit.jupiter.api.Test;

@IntegrationTest
class OrderServiceApplicationIntegrationTest {

	@Test
	void il_contesto_si_avvia_con_postgresql_e_migrazioni() {
		// Il test è l'avvio stesso: se il contesto o una migrazione Flyway non funzionano, fallisce prima di arrivare qui
	}

}
