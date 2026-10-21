package it.limber.ordini.config;

import it.limber.ordini.shared.outbox.Topics;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Topic su cui order-service pubblica. Se esistono già, Kafka li lascia come sono. */
@Configuration(proxyBeanMethods = false)
@EnableScheduling
class MessagingConfig {

	private static final int PARTITIONS = 3;

	@Bean
	NewTopic orderCreatedTopic() {
		return TopicBuilder.name(Topics.ORDER_CREATED).partitions(PARTITIONS).build();
	}

	@Bean
	NewTopic orderStatusChangedTopic() {
		return TopicBuilder.name(Topics.ORDER_STATUS_CHANGED).partitions(PARTITIONS).build();
	}

	@Bean
	NewTopic stockLowTopic() {
		return TopicBuilder.name(Topics.STOCK_LOW).partitions(PARTITIONS).build();
	}

}
