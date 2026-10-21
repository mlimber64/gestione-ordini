package it.limber.notification.config;

import it.limber.notification.event.InvalidEventException;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.TopicPartition;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/**
 * Gestione degli errori del consumer: un messaggio che fallisce si ritenta tre volte; se continua a fallire (o non
 * potrà mai riuscire, come un JSON illeggibile) finisce nel topic {@code <topic>.DLT} e il consumo prosegue.
 * Un messaggio avvelenato non blocca mai quelli che lo seguono.
 */
@Configuration(proxyBeanMethods = false)
class KafkaConfig {

	private static final int PARTITIONS = 3;

	@Bean
	DefaultErrorHandler kafkaErrorHandler(KafkaOperations<String, String> operations) {
		// Spring Kafka 4 userebbe il suffisso "-dlt": si resta su ".DLT", il nome documentato nel progetto.
		// Partizione -1: la sceglie il producer, così il topic dead-letter può avere meno partizioni dell'originale.
		DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(operations,
				(record, ex) -> new TopicPartition(record.topic() + ".DLT", -1));
		DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 3));
		handler.addNotRetryableExceptions(InvalidEventException.class);
		return handler;
	}

	/**
	 * Anche il consumer dichiara i topic da cui legge: se parte prima di order-service, i topic esistono comunque e
	 * non deve aspettare minuti che Kafka li scopra. Creare un topic già esistente non ha effetto.
	 */
	@Bean
	NewTopic orderCreatedTopic() {
		return TopicBuilder.name("orders.order-created.v1").partitions(PARTITIONS).build();
	}

	@Bean
	NewTopic orderStatusChangedTopic() {
		return TopicBuilder.name("orders.order-status-changed.v1").partitions(PARTITIONS).build();
	}

	@Bean
	NewTopic stockLowTopic() {
		return TopicBuilder.name("inventory.stock-low.v1").partitions(PARTITIONS).build();
	}

	@Bean
	NewTopic orderCreatedDeadLetterTopic() {
		return TopicBuilder.name("orders.order-created.v1.DLT").partitions(PARTITIONS).build();
	}

	@Bean
	NewTopic orderStatusChangedDeadLetterTopic() {
		return TopicBuilder.name("orders.order-status-changed.v1.DLT").partitions(PARTITIONS).build();
	}

	@Bean
	NewTopic stockLowDeadLetterTopic() {
		return TopicBuilder.name("inventory.stock-low.v1.DLT").partitions(PARTITIONS).build();
	}

}
