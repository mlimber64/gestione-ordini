package it.limber.ordini.order.domain;

import it.limber.ordini.shared.error.BusinessRuleException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Regole di business dell'ordine: nessun database, nessun Spring. */
class OrderTest {

	private static final Instant NOW = Instant.parse("2026-10-21T10:00:00Z");

	private static final ShippingAddress ADDRESS = new ShippingAddress("Via Roma 1", "Salerno", "SA", "84121", "IT");

	private static OrderLine line(String sku, int quantity, String price, String vat) {
		return new OrderLine(UUID.randomUUID(), sku, "Prodotto " + sku, quantity, new BigDecimal(price),
				new BigDecimal(vat));
	}

	private static Order order(OrderLine... lines) {
		return Order.place(UUID.randomUUID(), "ORD-2026-000001", UUID.randomUUID(), "CLI-000001", "Rossi Srl",
				ADDRESS, null, List.of(lines), "mario", NOW);
	}

	@Test
	void calcola_imponibile_iva_e_totale_riga_per_riga() {
		// 3 x 10,00 al 22% = 30,00 + 6,60; 2 x 9,99 al 10% = 19,98 + 2,00 (arrotondato)
		Order order = order(line("A", 3, "10.00", "22.00"), line("B", 2, "9.99", "10.00"));

		assertThat(order.totalNet()).isEqualByComparingTo("49.98");
		assertThat(order.totalVat()).isEqualByComparingTo("8.60");
		assertThat(order.totalGross()).isEqualByComparingTo("58.58");
	}

	@Test
	void un_ordine_nuovo_e_in_attesa_e_registra_la_creazione_nello_storico() {
		Order order = order(line("A", 1, "5.00", "22.00"));

		assertThat(order.status()).isEqualTo(OrderStatus.PENDING);
		assertThat(order.pendingChanges()).singleElement().satisfies(change -> {
			assertThat(change.from()).isNull();
			assertThat(change.to()).isEqualTo(OrderStatus.PENDING);
			assertThat(change.changedBy()).isEqualTo("mario");
		});
	}

	@Test
	void percorre_il_ciclo_completo_fino_alla_consegna() {
		Order order = order(line("A", 1, "5.00", "22.00"));

		order.confirm("anna", NOW.plusSeconds(60));
		order.ship("anna", NOW.plusSeconds(120));
		order.deliver("luca", NOW.plusSeconds(180));

		assertThat(order.status()).isEqualTo(OrderStatus.DELIVERED);
		assertThat(order.updatedAt()).isEqualTo(NOW.plusSeconds(180));
		assertThat(order.pendingChanges()).extracting(StatusChange::to)
			.containsExactly(OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED);
	}

	@Test
	void non_si_puo_spedire_un_ordine_non_confermato() {
		Order order = order(line("A", 1, "5.00", "22.00"));

		assertThatThrownBy(() -> order.ship("anna", NOW)).isInstanceOf(BusinessRuleException.class)
			.hasMessageContaining("PENDING")
			.hasMessageContaining("SHIPPED");
		assertThat(order.status()).isEqualTo(OrderStatus.PENDING);
	}

	@Test
	void si_annulla_solo_prima_della_spedizione_e_con_un_motivo() {
		Order pending = order(line("A", 1, "5.00", "22.00"));
		assertThatThrownBy(() -> pending.cancel("  ", "anna", NOW)).isInstanceOf(BusinessRuleException.class);

		pending.cancel("Il cliente ha cambiato idea", "anna", NOW);
		assertThat(pending.status()).isEqualTo(OrderStatus.CANCELLED);

		Order shipped = order(line("A", 1, "5.00", "22.00"));
		shipped.confirm("anna", NOW);
		shipped.ship("anna", NOW);
		assertThatThrownBy(() -> shipped.cancel("troppo tardi", "anna", NOW)).isInstanceOf(BusinessRuleException.class);
	}

	@Test
	void gli_stati_finali_non_hanno_uscite() {
		for (OrderStatus target : OrderStatus.values()) {
			assertThat(OrderStatus.DELIVERED.canTransitionTo(target)).isFalse();
			assertThat(OrderStatus.CANCELLED.canTransitionTo(target)).isFalse();
		}
	}

	@Test
	void la_riserva_di_magazzino_dura_fino_alla_spedizione() {
		assertThat(OrderStatus.PENDING.holdsReservation()).isTrue();
		assertThat(OrderStatus.CONFIRMED.holdsReservation()).isTrue();
		assertThat(OrderStatus.SHIPPED.holdsReservation()).isFalse();
		assertThat(OrderStatus.CANCELLED.holdsReservation()).isFalse();
	}

	@Test
	void rifiuta_ordini_senza_righe_o_con_prodotti_ripetuti() {
		assertThatThrownBy(() -> order()).isInstanceOf(BusinessRuleException.class);

		OrderLine line = line("A", 1, "5.00", "22.00");
		assertThatThrownBy(() -> order(line, line)).isInstanceOf(BusinessRuleException.class)
			.hasMessageContaining("più di una volta");
	}

	@Test
	void rifiuta_quantita_non_positive() {
		assertThatThrownBy(() -> line("A", 0, "5.00", "22.00")).isInstanceOf(BusinessRuleException.class);
	}

}
