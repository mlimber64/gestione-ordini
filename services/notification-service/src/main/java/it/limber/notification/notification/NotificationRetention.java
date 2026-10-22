package it.limber.notification.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;

/**
 * Politica di conservazione: ogni notte elimina le notifiche ricevute da più di {@code app.notifications.retention}
 * (30 giorni se non configurato), così la tabella non cresce all'infinito.
 * <p>
 * Il periodo deve restare più lungo di quello che Kafka conserva i messaggi (7 giorni di base): l'idempotenza del
 * consumer si regge sul vincolo UNIQUE su {@code event_id}, quindi una notifica cancellata mentre il suo evento può
 * ancora essere riletto (nuovo gruppo di consumer, azzeramento degli offset) verrebbe ricreata come duplicato.
 */
@Component
public class NotificationRetention {

	private static final Logger log = LoggerFactory.getLogger(NotificationRetention.class);

	private final NotificationStore store;

	private final Duration retention;

	NotificationRetention(NotificationStore store, @Value("${app.notifications.retention:30d}") Duration retention) {
		if (retention.isZero() || retention.isNegative()) {
			throw new IllegalArgumentException("app.notifications.retention deve essere positivo: " + retention);
		}
		this.store = store;
		this.retention = retention;
	}

	/** Elimina le notifiche più vecchie del periodo di conservazione e restituisce quante ne ha tolte. */
	@Scheduled(cron = "${app.notifications.cleanup-cron:0 45 3 * * *}")
	public Mono<Long> cleanUp() {
		return store.deleteReceivedBefore(Instant.now().minus(retention))
			.doOnNext(deleted -> {
				if (deleted > 0) {
					log.info("Eliminate {} notifiche ricevute più di {} giorni fa", deleted, retention.toDays());
				}
			})
			.onErrorResume(error -> {
				log.warn("Pulizia delle notifiche non riuscita: {}", error.toString());
				return Mono.just(0L);
			});
	}

}
