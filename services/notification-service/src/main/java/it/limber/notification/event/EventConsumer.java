package it.limber.notification.event;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import it.limber.notification.notification.NotificationBroadcaster;
import it.limber.notification.notification.NotificationStore;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Riceve gli eventi di order-service. Kafka consegna "almeno una volta", quindi lo stesso evento può arrivare due
 * volte: il database scarta il duplicato e solo le notifiche nuove vengono inoltrate ai client.
 *
 * <p>Il thread del listener resta bloccato finché la pipeline reattiva non ha finito. È voluto: Kafka registra
 * l'offset solo dopo che la notifica è salvata, e un database lento rallenta il consumo invece di accumulare messaggi
 * in memoria.
 */
@Component
class EventConsumer {

	private static final Logger log = LoggerFactory.getLogger(EventConsumer.class);

	private static final Duration TIMEOUT = Duration.ofSeconds(10);

	private final NotificationFactory factory;

	private final NotificationStore store;

	private final NotificationBroadcaster broadcaster;

	private final Counter received;

	private final Counter duplicates;

	EventConsumer(NotificationFactory factory, NotificationStore store, NotificationBroadcaster broadcaster,
			MeterRegistry metrics) {
		this.factory = factory;
		this.store = store;
		this.broadcaster = broadcaster;
		this.received = Counter.builder("notifications.received").description("Notifiche nuove salvate").register(metrics);
		this.duplicates = Counter.builder("notifications.duplicates")
			.description("Eventi già ricevuti e scartati")
			.register(metrics);
	}

	@KafkaListener(topics = { "orders.order-created.v1", "orders.order-status-changed.v1", "inventory.stock-low.v1" })
	void on(ConsumerRecord<String, String> record) {
		try {
			factory.create(record.topic(), record.value()).ifPresent(notification -> {
				var saved = store.insertIfAbsent(notification).block(TIMEOUT);
				if (saved == null) {
					duplicates.increment();
					log.debug("Evento {} già ricevuto, scartato", notification.eventId());
					return;
				}
				received.increment();
				broadcaster.publish(saved);
			});
		}
		catch (RuntimeException ex) {
			log.warn("Elaborazione fallita per {}-{}@{}: {}", record.topic(), record.partition(), record.offset(),
					ex.toString(), ex);
			throw ex;
		}
	}

}
