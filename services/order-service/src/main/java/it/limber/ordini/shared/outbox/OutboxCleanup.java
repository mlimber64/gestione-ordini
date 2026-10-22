package it.limber.ordini.shared.outbox;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Elimina gli eventi vecchi di più di una settimana, così la tabella non cresce all'infinito.
 * <p>
 * Con il polling si tolgono gli eventi già pubblicati ({@code published_at}). Con CDC l'applicazione non segna
 * nulla come pubblicato: ci pensa Debezium, che ha già letto la riga appena è stata scritta, e si toglie in base
 * all'età. Le {@code DELETE} generano a loro volta eventi nel log, ma Debezium li ignora.
 */
@Component
class OutboxCleanup {

	private static final Logger log = LoggerFactory.getLogger(OutboxCleanup.class);

	private static final String DELETE_PUBLISHED = "DELETE FROM orders.outbox_event WHERE published_at < now() - interval '7 days'";

	private static final String DELETE_BY_AGE = "DELETE FROM orders.outbox_event WHERE created_at < now() - interval '7 days'";

	private final JdbcClient jdbc;

	private final OutboxMode mode;

	OutboxCleanup(JdbcClient jdbc, @Value("${app.outbox.mode:polling}") OutboxMode mode) {
		this.jdbc = jdbc;
		this.mode = mode;
	}

	@Scheduled(cron = "${app.outbox.cleanup-cron:0 30 3 * * *}")
	void cleanUp() {
		int deleted = jdbc.sql(mode == OutboxMode.CDC ? DELETE_BY_AGE : DELETE_PUBLISHED).update();
		if (deleted > 0) {
			log.info("Eliminati {} eventi outbox vecchi di più di sette giorni", deleted);
		}
	}

}
