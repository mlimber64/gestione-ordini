package it.limber.notification.notification;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Distribuisce le nuove notifiche a tutti i client SSE collegati in quel momento. Chi non è collegato non perde
 * nulla: al ritorno riprende dal database con {@code Last-Event-ID}.
 */
@Component
public class NotificationBroadcaster {

	private final Sinks.Many<Notification> sink = Sinks.many().multicast().directBestEffort();

	private final AtomicInteger subscribers = new AtomicInteger();

	NotificationBroadcaster(MeterRegistry metrics) {
		Gauge.builder("notifications.sse.subscribers", subscribers, AtomicInteger::get)
			.description("Client SSE collegati")
			.register(metrics);
	}

	/** Chiamato dai thread dei consumer Kafka: l'emissione deve essere serializzata. */
	public synchronized void publish(Notification notification) {
		sink.tryEmitNext(notification);
	}

	/** Flusso live con un buffer limitato per client: un client lento perde il più vecchio, non blocca gli altri. */
	public Flux<Notification> live() {
		return sink.asFlux()
			.onBackpressureBuffer(1000, dropped -> {
			}, reactor.core.publisher.BufferOverflowStrategy.DROP_OLDEST)
			.doOnSubscribe(s -> subscribers.incrementAndGet())
			.doFinally(signal -> subscribers.decrementAndGet());
	}

}
