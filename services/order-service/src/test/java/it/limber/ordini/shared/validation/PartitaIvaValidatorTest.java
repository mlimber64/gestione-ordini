package it.limber.ordini.shared.validation;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class PartitaIvaValidatorTest {

	@ParameterizedTest
	@ValueSource(strings = { "12345678903", "12345678911", "12345678929" })
	void accetta_partite_iva_con_cifra_di_controllo_corretta(String vat) {
		assertThat(PartitaIvaValidator.isValid(vat)).isTrue();
	}

	@ParameterizedTest
	@ValueSource(strings = { "12345678900", "12345678904", "1234567890", "123456789033", "1234567890A", "abcdefghijk", "" })
	void rifiuta_partite_iva_errate(String vat) {
		assertThat(PartitaIvaValidator.isValid(vat)).isFalse();
	}

	@Test
	void il_valore_nullo_e_valido_perche_il_campo_e_facoltativo() {
		assertThat(new PartitaIvaValidator().isValid(null, null)).isTrue();
	}

}
