package it.limber.ordini.payment.domain;

import it.limber.ordini.shared.error.BusinessRuleException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Regole di business del pagamento: nessun database, nessun Spring. */
class PaymentTest {

	private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");

	private static Payment payment(String amount) {
		return Payment.register(UUID.randomUUID(), UUID.randomUUID(), PaymentMethod.BANK_TRANSFER,
				new BigDecimal(amount), "CRO 123", "mario", NOW);
	}

	@Test
	void un_pagamento_nuovo_e_in_attesa_e_senza_data_di_incasso() {
		Payment payment = payment("25.50");

		assertThat(payment.status()).isEqualTo(PaymentStatus.PENDING);
		assertThat(payment.amount()).isEqualByComparingTo("25.50");
		assertThat(payment.paidAt()).isNull();
		assertThat(payment.createdBy()).isEqualTo("mario");
		assertThat(payment.reference()).isEqualTo("CRO 123");
	}

	@Test
	void l_importo_si_normalizza_a_due_decimali() {
		assertThat(payment("10").amount().scale()).isEqualTo(2);
		assertThat(payment("10.000").amount()).isEqualTo(new BigDecimal("10.00"));
	}

	@Test
	void il_riferimento_vuoto_diventa_assente_e_quello_normale_si_ripulisce() {
		Payment blank = Payment.register(UUID.randomUUID(), UUID.randomUUID(), PaymentMethod.CARD, BigDecimal.TEN,
				"   ", "mario", NOW);
		Payment padded = Payment.register(UUID.randomUUID(), UUID.randomUUID(), PaymentMethod.CARD, BigDecimal.TEN,
				"  TRX-9  ", "mario", NOW);

		assertThat(blank.reference()).isNull();
		assertThat(padded.reference()).isEqualTo("TRX-9");
	}

	@Test
	void rifiuta_importi_non_validi_metodo_mancante_e_riferimento_troppo_lungo() {
		UUID order = UUID.randomUUID();

		assertThatThrownBy(() -> Payment.register(UUID.randomUUID(), order, PaymentMethod.CARD, BigDecimal.ZERO, null,
				"mario", NOW)).isInstanceOf(BusinessRuleException.class).hasMessageContaining("maggiore di zero");
		assertThatThrownBy(() -> Payment.register(UUID.randomUUID(), order, PaymentMethod.CARD, new BigDecimal("-5"),
				null, "mario", NOW)).isInstanceOf(BusinessRuleException.class);
		assertThatThrownBy(() -> Payment.register(UUID.randomUUID(), order, PaymentMethod.CARD, null, null, "mario",
				NOW)).isInstanceOf(BusinessRuleException.class);
		assertThatThrownBy(() -> Payment.register(UUID.randomUUID(), order, PaymentMethod.CARD,
				new BigDecimal("1.234"), null, "mario", NOW)).isInstanceOf(BusinessRuleException.class)
			.hasMessageContaining("due decimali");
		assertThatThrownBy(() -> Payment.register(UUID.randomUUID(), order, null, BigDecimal.TEN, null, "mario", NOW))
			.isInstanceOf(BusinessRuleException.class)
			.hasMessageContaining("metodo");
		assertThatThrownBy(() -> Payment.register(UUID.randomUUID(), order, PaymentMethod.CARD, BigDecimal.TEN,
				"x".repeat(101), "mario", NOW)).isInstanceOf(BusinessRuleException.class);
	}

	@Test
	void l_incasso_registra_data_e_autore() {
		Payment payment = payment("10.00");

		payment.markPaid("anna", NOW.plusSeconds(60));

		assertThat(payment.status()).isEqualTo(PaymentStatus.PAID);
		assertThat(payment.paidAt()).isEqualTo(NOW.plusSeconds(60));
		assertThat(payment.updatedBy()).isEqualTo("anna");
		assertThat(payment.createdBy()).isEqualTo("mario");
	}

	@Test
	void un_pagamento_in_attesa_puo_fallire_e_poi_e_finale() {
		Payment payment = payment("10.00");

		payment.markFailed("anna", NOW.plusSeconds(60));

		assertThat(payment.status()).isEqualTo(PaymentStatus.FAILED);
		assertThat(payment.paidAt()).isNull();
		assertThatThrownBy(() -> payment.markPaid("anna", NOW)).isInstanceOf(BusinessRuleException.class);
		assertThatThrownBy(() -> payment.refund("anna", NOW)).isInstanceOf(BusinessRuleException.class);
	}

	@Test
	void si_rimborsa_solo_cio_che_era_stato_incassato() {
		Payment pending = payment("10.00");
		assertThatThrownBy(() -> pending.refund("anna", NOW)).isInstanceOf(BusinessRuleException.class)
			.hasMessageContaining("PENDING");

		Payment paid = payment("10.00");
		paid.markPaid("anna", NOW);
		paid.refund("anna", NOW.plusSeconds(1));

		assertThat(paid.status()).isEqualTo(PaymentStatus.REFUNDED);
		assertThat(paid.paidAt()).isEqualTo(NOW);
		assertThatThrownBy(() -> paid.markPaid("anna", NOW)).isInstanceOf(BusinessRuleException.class);
		assertThatThrownBy(() -> paid.markFailed("anna", NOW)).isInstanceOf(BusinessRuleException.class);
	}

	@Test
	void solo_in_attesa_e_incassati_occupano_l_importo_dell_ordine() {
		assertThat(PaymentStatus.PENDING.countsTowardsOrder()).isTrue();
		assertThat(PaymentStatus.PAID.countsTowardsOrder()).isTrue();
		assertThat(PaymentStatus.FAILED.countsTowardsOrder()).isFalse();
		assertThat(PaymentStatus.REFUNDED.countsTowardsOrder()).isFalse();
	}

}
