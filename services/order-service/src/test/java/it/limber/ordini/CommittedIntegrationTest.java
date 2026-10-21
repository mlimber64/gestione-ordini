package it.limber.ordini;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Come {@link IntegrationTest}, ma senza transazione di test: i dati vengono davvero confermati nel database.
 * Serve ai test di concorrenza, dove più thread devono vedere le scritture degli altri. Chi la usa deve
 * ripulire i dati che crea.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
public @interface CommittedIntegrationTest {

}
