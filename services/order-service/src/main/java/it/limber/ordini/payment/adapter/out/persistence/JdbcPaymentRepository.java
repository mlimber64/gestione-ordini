package it.limber.ordini.payment.adapter.out.persistence;

import it.limber.ordini.payment.domain.Payment;
import it.limber.ordini.payment.domain.PaymentMethod;
import it.limber.ordini.payment.domain.PaymentRepository;
import it.limber.ordini.payment.domain.PaymentStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Pagamenti con SQL esplicito. L'aggiornamento è condizionato alla versione letta: niente modifiche «alla cieca». */
@Repository
class JdbcPaymentRepository implements PaymentRepository {

	private static final String SELECT = """
			SELECT id, order_id, method, status, amount, reference, created_by, created_at, updated_by, updated_at,
			       paid_at, version
			FROM orders.payment""";

	private final JdbcClient jdbc;

	JdbcPaymentRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	@Override
	public Optional<Payment> findById(UUID id) {
		return jdbc.sql(SELECT + " WHERE id = :id").param("id", id).query(JdbcPaymentRepository::map).optional();
	}

	@Override
	public List<Payment> findByOrder(UUID orderId) {
		return jdbc.sql(SELECT + " WHERE order_id = :order ORDER BY created_at, id")
			.param("order", orderId)
			.query(JdbcPaymentRepository::map)
			.list();
	}

	@Override
	public void insert(Payment payment) {
		jdbc.sql("""
				INSERT INTO orders.payment
				    (id, order_id, method, status, amount, reference, created_by, created_at, updated_by, updated_at, paid_at)
				VALUES (:id, :order, :method, :status, :amount, :reference, :createdBy, :createdAt, :updatedBy,
				        :updatedAt, :paidAt)""")
			.param("id", payment.id())
			.param("order", payment.orderId())
			.param("method", payment.method().name())
			.param("status", payment.status().name())
			.param("amount", payment.amount())
			.param("reference", payment.reference())
			.param("createdBy", payment.createdBy())
			.param("createdAt", timestamp(payment.createdAt()))
			.param("updatedBy", payment.updatedBy())
			.param("updatedAt", timestamp(payment.updatedAt()))
			.param("paidAt", timestamp(payment.paidAt()))
			.update();
	}

	@Override
	public void update(Payment payment) {
		int updated = jdbc.sql("""
				UPDATE orders.payment
				SET status = :status, updated_by = :updatedBy, updated_at = :updatedAt, paid_at = :paidAt,
				    version = version + 1
				WHERE id = :id AND version = :version""")
			.param("id", payment.id())
			.param("status", payment.status().name())
			.param("updatedBy", payment.updatedBy())
			.param("updatedAt", timestamp(payment.updatedAt()))
			.param("paidAt", timestamp(payment.paidAt()))
			.param("version", payment.version())
			.update();
		if (updated != 1) {
			throw new ObjectOptimisticLockingFailureException(Payment.class, payment.id());
		}
	}

	@Override
	public void lockOrder(UUID orderId) {
		// Lock consultivo legato alla transazione: si rilascia da solo al commit o al rollback
		jdbc.sql("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))").param("key", "payment:" + orderId).query().singleRow();
	}

	private static OffsetDateTime timestamp(Instant instant) {
		return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
	}

	private static Instant instant(ResultSet rs, String column) throws SQLException {
		OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
		return value == null ? null : value.toInstant();
	}

	private static Payment map(ResultSet rs, int row) throws SQLException {
		return Payment.restore(rs.getObject("id", UUID.class), rs.getObject("order_id", UUID.class),
				PaymentMethod.valueOf(rs.getString("method")), rs.getBigDecimal("amount"), rs.getString("reference"),
				PaymentStatus.valueOf(rs.getString("status")), rs.getString("created_by"), instant(rs, "created_at"),
				rs.getString("updated_by"), instant(rs, "updated_at"), instant(rs, "paid_at"), rs.getLong("version"));
	}

}
