package it.limber.ordini.inventory.adapter.out.persistence;

import it.limber.ordini.inventory.domain.MovementType;
import it.limber.ordini.inventory.domain.StockLevel;
import it.limber.ordini.inventory.domain.StockMovement;
import it.limber.ordini.inventory.domain.StockRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Giacenze con SQL esplicito: ogni variazione è un unico {@code UPDATE} condizionale, così la verifica
 * ("c'è abbastanza disponibile?") e la modifica avvengono nello stesso istante, protette dal lock di riga.
 */
@Repository
class JdbcStockRepository implements StockRepository {

	private static final String STOCK_SELECT = """
			SELECT p.id AS product_id, p.sku, p.name,
			       COALESCE(i.on_hand, 0) AS on_hand,
			       COALESCE(i.reserved, 0) AS reserved,
			       COALESCE(i.reorder_level, 0) AS reorder_level
			FROM orders.product p
			LEFT JOIN orders.inventory i ON i.product_id = p.id
			""";

	private static final String LOW_STOCK = """
			COALESCE(i.reorder_level, 0) > 0
			AND COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0) <= COALESCE(i.reorder_level, 0)""";

	/** Campi di ordinamento consentiti e la loro espressione SQL: niente testo dell'utente nella query. */
	private static final Map<String, String> STOCK_SORT = Map.of("sku", "p.sku", "name", "p.name", "onHand",
			"COALESCE(i.on_hand, 0)", "available", "COALESCE(i.on_hand, 0) - COALESCE(i.reserved, 0)");

	private final JdbcClient jdbc;

	JdbcStockRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	@Override
	public Optional<StockLevel> find(UUID productId) {
		return jdbc.sql(STOCK_SELECT + " WHERE p.id = :id")
			.param("id", productId)
			.query(JdbcStockRepository::mapLevel)
			.optional();
	}

	@Override
	public Page<StockLevel> list(String query, boolean lowStockOnly, Pageable pageable) {
		List<String> conditions = new ArrayList<>();
		Map<String, Object> params = new LinkedHashMap<>();
		if (query != null && !query.isBlank()) {
			conditions.add("(lower(p.name) LIKE :q OR lower(p.sku) LIKE :q)");
			params.put("q", "%" + query.trim().toLowerCase(Locale.ROOT) + "%");
		}
		if (lowStockOnly) {
			conditions.add("(" + LOW_STOCK + ")");
		}
		String where = conditions.isEmpty() ? "" : " WHERE " + String.join(" AND ", conditions);

		long total = jdbc.sql("SELECT count(*) FROM orders.product p LEFT JOIN orders.inventory i ON i.product_id = p.id"
				+ where)
			.params(params)
			.query(Long.class)
			.single();

		List<StockLevel> content = jdbc
			.sql(STOCK_SELECT + where + orderBy(pageable.getSort()) + " LIMIT :limit OFFSET :offset")
			.params(params)
			.param("limit", pageable.getPageSize())
			.param("offset", pageable.getOffset())
			.query(JdbcStockRepository::mapLevel)
			.list();
		return new PageImpl<>(content, pageable, total);
	}

	@Override
	public void receive(UUID productId, int quantity) {
		jdbc.sql("""
				INSERT INTO orders.inventory (product_id, on_hand) VALUES (:p, :q)
				ON CONFLICT (product_id) DO UPDATE
				SET on_hand = orders.inventory.on_hand + :q, updated_at = now()""")
			.param("p", productId)
			.param("q", quantity)
			.update();
	}

	@Override
	public boolean adjust(UUID productId, int delta) {
		return jdbc.sql("""
				UPDATE orders.inventory SET on_hand = on_hand + :d, updated_at = now()
				WHERE product_id = :p AND on_hand + :d >= reserved""")
			.param("p", productId)
			.param("d", delta)
			.update() == 1;
	}

	@Override
	public boolean reserve(UUID productId, int quantity) {
		return jdbc.sql("""
				UPDATE orders.inventory SET reserved = reserved + :q, updated_at = now()
				WHERE product_id = :p AND on_hand - reserved >= :q""")
			.param("p", productId)
			.param("q", quantity)
			.update() == 1;
	}

	@Override
	public boolean release(UUID productId, int quantity) {
		return jdbc.sql("""
				UPDATE orders.inventory SET reserved = reserved - :q, updated_at = now()
				WHERE product_id = :p AND reserved >= :q""")
			.param("p", productId)
			.param("q", quantity)
			.update() == 1;
	}

	@Override
	public boolean ship(UUID productId, int quantity) {
		return jdbc.sql("""
				UPDATE orders.inventory
				SET on_hand = on_hand - :q, reserved = reserved - :q, updated_at = now()
				WHERE product_id = :p AND reserved >= :q""")
			.param("p", productId)
			.param("q", quantity)
			.update() == 1;
	}

	@Override
	public void setReorderLevel(UUID productId, int reorderLevel) {
		jdbc.sql("""
				INSERT INTO orders.inventory (product_id, reorder_level) VALUES (:p, :l)
				ON CONFLICT (product_id) DO UPDATE SET reorder_level = :l, updated_at = now()""")
			.param("p", productId)
			.param("l", reorderLevel)
			.update();
	}

	@Override
	public void record(StockMovement movement) {
		jdbc.sql("""
				INSERT INTO orders.stock_movement
				    (product_id, type, quantity, reference_type, reference_id, note, created_by)
				VALUES (:p, :type, :q, :refType, CAST(:refId AS uuid), :note, :by)""")
			.param("p", movement.productId())
			.param("type", movement.type().name())
			.param("q", movement.quantity())
			.param("refType", movement.referenceType())
			.param("refId", movement.referenceId() == null ? null : movement.referenceId().toString())
			.param("note", movement.note())
			.param("by", movement.createdBy())
			.update();
	}

	@Override
	public Page<StockMovement> movements(UUID productId, Pageable pageable) {
		long total = jdbc.sql("SELECT count(*) FROM orders.stock_movement WHERE product_id = :p")
			.param("p", productId)
			.query(Long.class)
			.single();
		List<StockMovement> content = jdbc.sql("""
				SELECT id, product_id, type, quantity, reference_type, reference_id, note, created_by, created_at
				FROM orders.stock_movement WHERE product_id = :p
				ORDER BY created_at DESC, id
				LIMIT :limit OFFSET :offset""")
			.param("p", productId)
			.param("limit", pageable.getPageSize())
			.param("offset", pageable.getOffset())
			.query(JdbcStockRepository::mapMovement)
			.list();
		return new PageImpl<>(content, pageable, total);
	}

	private static String orderBy(Sort sort) {
		List<String> terms = new ArrayList<>();
		for (Sort.Order order : sort) {
			String column = STOCK_SORT.get(order.getProperty());
			if (column != null) {
				terms.add(column + (order.isDescending() ? " DESC" : " ASC"));
			}
		}
		terms.add("p.id");
		return " ORDER BY " + String.join(", ", terms);
	}

	private static StockLevel mapLevel(ResultSet rs, int row) throws SQLException {
		return new StockLevel(rs.getObject("product_id", UUID.class), rs.getString("sku"), rs.getString("name"),
				rs.getInt("on_hand"), rs.getInt("reserved"), rs.getInt("reorder_level"));
	}

	private static StockMovement mapMovement(ResultSet rs, int row) throws SQLException {
		return new StockMovement(rs.getObject("id", UUID.class), rs.getObject("product_id", UUID.class),
				MovementType.valueOf(rs.getString("type")), rs.getInt("quantity"), rs.getString("reference_type"),
				rs.getObject("reference_id", UUID.class), rs.getString("note"), rs.getString("created_by"),
				rs.getObject("created_at", OffsetDateTime.class).toInstant());
	}

}
