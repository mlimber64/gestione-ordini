package it.limber.notification;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@SpringBootTest
class NotificationServiceApplicationTests {

	@Test
	void contextLoads() {
		// Il test è l'avvio stesso: se il contesto o una migrazione Flyway non funzionano, fallisce prima di arrivare qui
	}

}
