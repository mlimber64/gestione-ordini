package it.limber.ordini;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import java.util.List;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/** Fa rispettare la regola dell'architettura esagonale: le dipendenze vanno sempre verso il dominio. */
@AnalyzeClasses(packages = "it.limber.ordini", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

	@ArchTest
	static final ArchRule il_dominio_non_dipende_da_application_e_adapter = noClasses().that()
		.resideInAPackage("..domain..")
		.should()
		.dependOnClassesThat()
		.resideInAnyPackage("..application..", "..adapter..");

	@ArchTest
	static final ArchRule il_dominio_non_dipende_dal_web = noClasses().that()
		.resideInAPackage("..domain..")
		.should()
		.dependOnClassesThat()
		.resideInAnyPackage("org.springframework.web..", "jakarta.servlet..");

	@ArchTest
	static final ArchRule application_non_dipende_dagli_adapter = noClasses().that()
		.resideInAPackage("..application..")
		.should()
		.dependOnClassesThat()
		.resideInAPackage("..adapter..");

	@ArchTest
	static final ArchRule gli_adapter_in_ingresso_non_dipendono_da_quelli_in_uscita = noClasses().that()
		.resideInAPackage("..adapter.in..")
		.should()
		.dependOnClassesThat()
		.resideInAPackage("..adapter.out..");

	/** Una funzionalità può usare l'application di un'altra, mai i suoi adapter. */
	@ArchTest
	static void le_funzionalita_non_dipendono_dagli_adapter_delle_altre(JavaClasses classes) {
		List<String> features = List.of("identity", "customer", "catalog", "inventory", "order");
		for (String feature : features) {
			String[] otherAdapters = features.stream()
				.filter(other -> !other.equals(feature))
				.map(other -> "..ordini." + other + ".adapter..")
				.toArray(String[]::new);
			noClasses().that()
				.resideInAPackage("..ordini." + feature + "..")
				.should()
				.dependOnClassesThat()
				.resideInAnyPackage(otherAdapters)
				.check(classes);
		}
	}

	/** Dove il dominio è ricco (magazzino, ordini) non conosce né JPA né JDBC: si testa senza database. */
	@ArchTest
	static final ArchRule il_dominio_ricco_non_conosce_la_persistenza = noClasses().that()
		.resideInAnyPackage("..inventory.domain..", "..order.domain..")
		.should()
		.dependOnClassesThat()
		.resideInAnyPackage("jakarta.persistence..", "org.springframework.jdbc..", "org.springframework.data.jpa..",
				"org.hibernate..");

}
