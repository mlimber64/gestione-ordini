package it.limber.ordini.shared.outbox;

/**
 * Porta per annunciare un fatto di business ad altri servizi. L'evento viene salvato nella transazione corrente:
 * se la transazione si annulla, l'evento non esiste. La pubblicazione su Kafka avviene dopo, a cura del relay.
 */
public interface OutboxPublisher {

	/**
	 * @param topic         topic Kafka di destinazione
	 * @param aggregateType tipo dell'entità che ha generato l'evento, per esempio {@code Order}
	 * @param aggregateId   identificativo dell'entità: diventa la chiave Kafka, quindi gli eventi della stessa
	 *                      entità restano in ordine
	 * @param eventType     nome dell'evento, per esempio {@code OrderCreated}
	 * @param data          contenuto dell'evento, serializzato in JSON
	 */
	void publish(String topic, String aggregateType, String aggregateId, String eventType, Object data);

}
