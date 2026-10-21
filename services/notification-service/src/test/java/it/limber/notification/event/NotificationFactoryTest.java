package it.limber.notification.event;

import it.limber.notification.notification.NewNotification;
import it.limber.notification.notification.Severity;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationFactoryTest {

	private final NotificationFactory factory = new NotificationFactory(JsonMapper.builder().build());

	private static String envelope(String type, String data) {
		return """
				{"eventId":"%s","eventType":"%s","occurredAt":"2026-10-21T10:00:00Z","data":%s}"""
			.formatted(UUID.randomUUID(), type, data);
	}

	@Test
	void ordine_creato_diventa_una_notifica_informativa_con_importo_in_euro() {
		String data = """
				{"orderId":"o-1","number":"ORD-2026-000007","customerName":"Rossi Srl","totalGross":1234.50,"lineCount":3}""";

		NewNotification n = factory.create("orders.order-created.v1", envelope("OrderCreated", data)).orElseThrow();

		assertThat(n.severity()).isEqualTo(Severity.INFO);
		assertThat(n.title()).isEqualTo("Nuovo ordine ORD-2026-000007");
		assertThat(n.message()).contains("Rossi Srl").contains("1.234,50").contains("3 righe");
		assertThat(n.aggregateId()).isEqualTo("o-1");
		assertThat(n.eventType()).isEqualTo("OrderCreated");
	}

	@Test
	void una_riga_sola_si_scrive_al_singolare() {
		String data = """
				{"orderId":"o-1","number":"N","customerName":"C","totalGross":5,"lineCount":1}""";

		assertThat(factory.create("t", envelope("OrderCreated", data)).orElseThrow().message()).contains("1 riga)");
	}

	@Test
	void il_cambio_di_stato_usa_le_etichette_italiane() {
		String data = """
				{"orderId":"o-1","number":"ORD-1","customerName":"Rossi Srl","fromStatus":"PENDING","toStatus":"CONFIRMED","reason":null}""";

		NewNotification n = factory.create("t", envelope("OrderStatusChanged", data)).orElseThrow();

		assertThat(n.severity()).isEqualTo(Severity.INFO);
		assertThat(n.title()).isEqualTo("Ordine ORD-1: confermato");
		assertThat(n.message()).isEqualTo("L'ordine ORD-1 di Rossi Srl è passato da In attesa a confermato");
	}

	@Test
	void l_annullamento_e_un_avviso_e_riporta_il_motivo() {
		String data = """
				{"orderId":"o-1","number":"ORD-1","customerName":"Rossi Srl","fromStatus":"CONFIRMED","toStatus":"CANCELLED","reason":"Il cliente ha rinunciato"}""";

		NewNotification n = factory.create("t", envelope("OrderStatusChanged", data)).orElseThrow();

		assertThat(n.severity()).isEqualTo(Severity.WARNING);
		assertThat(n.message()).endsWith("Motivo: Il cliente ha rinunciato");
	}

	@Test
	void la_scorta_bassa_e_un_avviso_con_disponibile_e_soglia() {
		String data = """
				{"productId":"p-1","sku":"PEN-01","productName":"Penna blu","available":4,"reorderLevel":5}""";

		NewNotification n = factory.create("t", envelope("StockLow", data)).orElseThrow();

		assertThat(n.severity()).isEqualTo(Severity.WARNING);
		assertThat(n.title()).isEqualTo("Scorta bassa: PEN-01");
		assertThat(n.message()).isEqualTo("Penna blu: disponibili 4, soglia di riordino 5");
	}

	@Test
	void un_tipo_sconosciuto_si_ignora_senza_errore() {
		assertThat(factory.create("t", envelope("Qualcosa", "{}"))).isEmpty();
	}

	@Test
	void i_messaggi_malformati_sono_invalidi() {
		assertThatThrownBy(() -> factory.create("t", "non è json")).isInstanceOf(InvalidEventException.class);
		assertThatThrownBy(() -> factory.create("t", "{\"eventType\":\"StockLow\"}"))
			.isInstanceOf(InvalidEventException.class);
		assertThatThrownBy(() -> factory.create("t", envelope("StockLow", "{\"sku\":\"X\"}")))
			.isInstanceOf(InvalidEventException.class)
			.hasMessageContaining("productName");
		assertThatThrownBy(() -> factory.create("t", null)).isInstanceOf(InvalidEventException.class);
	}

}
