package it.limber.ordini.shared.outbox;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/** Il relay esiste solo con il polling; con CDC gli eventi li porta Debezium e l'applicazione non li tocca. */
class OutboxModeTest {

	@SuppressWarnings("unchecked")
	private ApplicationContextRunner runner() {
		return new ApplicationContextRunner().withUserConfiguration(OutboxRelay.class)
			.withBean(JdbcClient.class, () -> mock(JdbcClient.class))
			.withBean(KafkaTemplate.class, () -> mock(KafkaTemplate.class))
			.withBean(TransactionTemplate.class, () -> mock(TransactionTemplate.class))
			.withBean(SimpleMeterRegistry.class);
	}

	@Test
	void il_relay_c_e_con_il_polling() {
		runner().withPropertyValues("app.outbox.mode=polling").run(context -> assertThat(context).hasSingleBean(OutboxRelay.class));
	}

	@Test
	void il_relay_c_e_anche_se_la_modalita_non_e_indicata() {
		runner().run(context -> assertThat(context).hasSingleBean(OutboxRelay.class));
	}

	@Test
	void con_cdc_il_relay_non_esiste() {
		runner().withPropertyValues("app.outbox.mode=cdc").run(context -> assertThat(context).doesNotHaveBean(OutboxRelay.class));
	}

}
