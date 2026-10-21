package it.limber.notification.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/notifications")
class NotificationController {

	private static final int MAX_LIMIT = 200;

	private final NotificationStore store;

	private final NotificationBroadcaster broadcaster;

	private final Duration heartbeat;

	private final int replayLimit;

	NotificationController(NotificationStore store, NotificationBroadcaster broadcaster,
			@Value("${app.notifications.heartbeat:25s}") Duration heartbeat,
			@Value("${app.notifications.replay-limit:500}") int replayLimit) {
		this.store = store;
		this.broadcaster = broadcaster;
		this.heartbeat = heartbeat;
		this.replayLimit = replayLimit;
	}

	/** Cronologia: le più recenti per prime. Per le pagine successive passare l'id dell'ultima ricevuta in {@code beforeId}. */
	@GetMapping
	Mono<List<Notification>> recent(@RequestParam(defaultValue = "50") int limit,
			@RequestParam(required = false) Long beforeId) {
		return store.findRecent(Math.max(1, Math.min(limit, MAX_LIMIT)), beforeId).collectList();
	}

	/**
	 * Stream SSE delle nuove notifiche. Se il client si ricollega con l'intestazione {@code Last-Event-ID}, prima
	 * riceve quelle perse nel frattempo e poi continua in diretta, senza buchi né doppioni. Ogni {@code heartbeat}
	 * parte un commento vuoto per tenere viva la connessione attraverso proxy e bilanciatori.
	 */
	@GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
	Flux<ServerSentEvent<Notification>> stream(
			@RequestHeader(name = "Last-Event-ID", required = false) Long lastEventId) {
		Flux<Notification> notifications = Flux.defer(() -> {
			if (lastEventId == null) {
				return broadcaster.live();
			}
			Set<Long> replayedIds = ConcurrentHashMap.newKeySet();
			Flux<Notification> replay = store.findAfter(lastEventId, replayLimit).doOnNext(n -> replayedIds.add(n.id()));
			// mergeSequential si abbona subito anche al flusso live e lo trattiene finché il recupero non è finito
			return Flux.mergeSequential(replay, broadcaster.live().filter(n -> !replayedIds.contains(n.id())));
		});
		Flux<ServerSentEvent<Notification>> events = notifications.map(n -> ServerSentEvent.<Notification>builder()
			.id(String.valueOf(n.id()))
			.event(n.eventType())
			.data(n)
			.build());
		Flux<ServerSentEvent<Notification>> pings = Flux.interval(heartbeat)
			.map(tick -> ServerSentEvent.<Notification>builder().comment("ping").build());
		return Flux.merge(events, pings);
	}

}
