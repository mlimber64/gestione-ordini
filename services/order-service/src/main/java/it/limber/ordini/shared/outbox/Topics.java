package it.limber.ordini.shared.outbox;

/** Nomi dei topic: {@code dominio.evento.versione}. La versione cambia solo per modifiche incompatibili. */
public final class Topics {

	public static final String ORDER_CREATED = "orders.order-created.v1";

	public static final String ORDER_STATUS_CHANGED = "orders.order-status-changed.v1";

	public static final String STOCK_LOW = "inventory.stock-low.v1";

	private Topics() {
	}

}
