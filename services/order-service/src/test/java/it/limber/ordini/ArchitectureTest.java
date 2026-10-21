package it.limber.ordini;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

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

	@ArchTest
	static final ArchRule le_funzionalita_non_dipendono_dagli_adapter_delle_altre = noClasses().that()
		.resideInAPackage("..customer..")
		.should()
		.dependOnClassesThat()
		.resideInAnyPackage("..catalog.adapter..", "..identity.adapter..");

}
