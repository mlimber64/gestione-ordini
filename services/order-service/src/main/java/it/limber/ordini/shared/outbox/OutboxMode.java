package it.limber.ordini.shared.outbox;

/**
 * Chi porta gli eventi dalla tabella {@code outbox_event} a Kafka ({@code app.outbox.mode}).
 *
 * <ul>
 * <li>{@link #POLLING}: l'applicazione stessa, con un relay che interroga la tabella (comportamento di base).</li>
 * <li>{@link #CDC}: Debezium, che legge il log di PostgreSQL. L'applicazione si limita a scrivere l'evento nella
 * transazione e non tocca più la tabella, quindi non ha un relay e non segna gli eventi come pubblicati.</li>
 * </ul>
 */
public enum OutboxMode {

	POLLING, CDC

}
