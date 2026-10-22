package it.limber.ordini.payment.application;

import it.limber.ordini.order.application.OrderService;
import it.limber.ordini.order.application.OrderService.OrderView;
import it.limber.ordini.order.domain.OrderStatus;
import it.limber.ordini.payment.domain.Payment;
import it.limber.ordini.payment.domain.PaymentMethod;
import it.limber.ordini.payment.domain.PaymentRepository;
import it.limber.ordini.payment.domain.PaymentStatus;
import it.limber.ordini.shared.error.BusinessRuleException;
import it.limber.ordini.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Casi d'uso dei pagamenti. Il pagamento non cambia lo stato dell'ordine: è un dato a parte che dice quanto è stato
 * incassato. La somma di pagamenti in attesa e incassati non può mai superare il totale dell'ordine.
 */
@Service
public class PaymentService {

	/** Quanto dell'ordine è stato incassato. */
	public enum Settlement {

		UNPAID, PARTIAL, PAID

	}

	public record RegisterCommand(PaymentMethod method, BigDecimal amount, String reference) {
	}

	public record PaymentView(UUID id, UUID orderId, PaymentMethod method, PaymentStatus status, BigDecimal amount,
			String reference, String createdBy, Instant createdAt, String updatedBy, Instant updatedAt,
			Instant paidAt) {

		static PaymentView of(Payment payment) {
			return new PaymentView(payment.id(), payment.orderId(), payment.method(), payment.status(),
					payment.amount(), payment.reference(), payment.createdBy(), payment.createdAt(),
					payment.updatedBy(), payment.updatedAt(), payment.paidAt());
		}

	}

	/**
	 * Riepilogo dei pagamenti di un ordine. {@code balance} è ciò che manca da incassare, {@code registrable} ciò
	 * che si può ancora registrare (esclude anche i pagamenti in attesa).
	 */
	public record OrderPaymentsView(UUID orderId, BigDecimal total, BigDecimal paid, BigDecimal pending,
			BigDecimal balance, BigDecimal registrable, Settlement settlement, List<PaymentView> payments) {
	}

	private final PaymentRepository payments;

	private final OrderService orders;

	public PaymentService(PaymentRepository payments, OrderService orders) {
		this.payments = payments;
		this.orders = orders;
	}

	@Transactional(readOnly = true)
	public OrderPaymentsView forOrder(UUID orderId) {
		OrderView order = orders.get(orderId);
		return summary(order.id(), order.totalGross(), payments.findByOrder(orderId));
	}

	@Transactional
	public PaymentView register(UUID orderId, RegisterCommand command, String actor) {
		OrderView order = orders.get(orderId);
		if (order.status() == OrderStatus.CANCELLED) {
			throw new BusinessRuleException("L'ordine %s è annullato: non si possono registrare pagamenti"
				.formatted(order.number()));
		}
		payments.lockOrder(orderId);
		OrderPaymentsView current = summary(orderId, order.totalGross(), payments.findByOrder(orderId));
		Payment payment = Payment.register(UUID.randomUUID(), orderId, command.method(), command.amount(),
				command.reference(), actor, Instant.now());
		if (payment.amount().compareTo(current.registrable()) > 0) {
			throw new BusinessRuleException("L'importo supera quello ancora da pagare (%s)"
				.formatted(NumberFormat.getCurrencyInstance(Locale.ITALY).format(current.registrable())));
		}
		payments.insert(payment);
		return PaymentView.of(payment);
	}

	@Transactional
	public PaymentView markPaid(UUID id, String actor) {
		Payment payment = find(id);
		payment.markPaid(actor, Instant.now());
		payments.update(payment);
		return PaymentView.of(payment);
	}

	@Transactional
	public PaymentView markFailed(UUID id, String actor) {
		Payment payment = find(id);
		payment.markFailed(actor, Instant.now());
		payments.update(payment);
		return PaymentView.of(payment);
	}

	@Transactional
	public PaymentView refund(UUID id, String actor) {
		Payment payment = find(id);
		payment.refund(actor, Instant.now());
		payments.update(payment);
		return PaymentView.of(payment);
	}

	private Payment find(UUID id) {
		return payments.findById(id).orElseThrow(() -> new NotFoundException("Pagamento non trovato: " + id));
	}

	private static OrderPaymentsView summary(UUID orderId, BigDecimal total, List<Payment> all) {
		BigDecimal paid = sum(all, PaymentStatus.PAID);
		BigDecimal pending = sum(all, PaymentStatus.PENDING);
		BigDecimal balance = total.subtract(paid);
		BigDecimal registrable = balance.subtract(pending).max(BigDecimal.ZERO);
		Settlement settlement;
		if (balance.signum() <= 0) {
			settlement = Settlement.PAID;
		}
		else if (paid.signum() == 0) {
			settlement = Settlement.UNPAID;
		}
		else {
			settlement = Settlement.PARTIAL;
		}
		return new OrderPaymentsView(orderId, total, paid, pending, balance.max(BigDecimal.ZERO), registrable,
				settlement, all.stream().map(PaymentView::of).toList());
	}

	private static BigDecimal sum(List<Payment> all, PaymentStatus status) {
		return all.stream()
			.filter(payment -> payment.status() == status)
			.map(Payment::amount)
			.reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add);
	}

}
