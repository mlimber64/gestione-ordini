package it.limber.ordini.order.application;

import it.limber.ordini.catalog.application.ProductService;
import it.limber.ordini.catalog.application.ProductService.ProductView;
import it.limber.ordini.customer.application.CustomerService;
import it.limber.ordini.customer.application.CustomerService.AddressView;
import it.limber.ordini.customer.application.CustomerService.CustomerView;
import it.limber.ordini.customer.domain.AddressType;
import it.limber.ordini.customer.domain.CustomerStatus;
import it.limber.ordini.inventory.application.InventoryService;
import it.limber.ordini.order.domain.Order;
import it.limber.ordini.order.domain.OrderFilter;
import it.limber.ordini.order.domain.OrderLine;
import it.limber.ordini.order.domain.OrderRepository;
import it.limber.ordini.order.domain.OrderStatus;
import it.limber.ordini.order.domain.OrderSummary;
import it.limber.ordini.order.domain.ShippingAddress;
import it.limber.ordini.order.domain.StatusChange;
import it.limber.ordini.shared.error.BusinessRuleException;
import it.limber.ordini.shared.error.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Casi d'uso degli ordini. Ogni operazione è una sola transazione: se una riga non trova giacenza sufficiente,
 * o un altro utente modifica lo stesso ordine, si annulla tutto compresa la riserva già fatta sulle altre righe.
 */
@Service
public class OrderService {

	public record ItemCommand(UUID productId, int quantity) {
	}

	public record PlaceOrderCommand(UUID customerId, UUID shippingAddressId, String notes, List<ItemCommand> items) {
	}

	public record LineView(UUID productId, String sku, String productName, int quantity, BigDecimal unitPrice,
			BigDecimal vatRate, BigDecimal lineNet, BigDecimal lineVat, BigDecimal lineGross) {

		static LineView of(OrderLine line) {
			return new LineView(line.productId(), line.sku(), line.productName(), line.quantity(), line.unitPrice(),
					line.vatRate(), line.net(), line.vat(), line.gross());
		}

	}

	public record AddressSnapshotView(String street, String city, String province, String postalCode,
			String country) {

		static AddressSnapshotView of(ShippingAddress address) {
			return new AddressSnapshotView(address.street(), address.city(), address.province(),
					address.postalCode(), address.country());
		}

	}

	public record StatusChangeView(OrderStatus from, OrderStatus to, String reason, String changedBy,
			Instant changedAt) {

		static StatusChangeView of(StatusChange change) {
			return new StatusChangeView(change.from(), change.to(), change.reason(), change.changedBy(),
					change.changedAt());
		}

	}

	public record OrderView(UUID id, String number, UUID customerId, String customerCode, String customerName,
			OrderStatus status, AddressSnapshotView shippingAddress, String notes, List<LineView> lines,
			BigDecimal totalNet, BigDecimal totalVat, BigDecimal totalGross, String createdBy, Instant createdAt,
			Instant updatedAt, List<StatusChangeView> history) {

		static OrderView of(Order order) {
			return new OrderView(order.id(), order.number(), order.customerId(), order.customerCode(),
					order.customerName(), order.status(), AddressSnapshotView.of(order.shippingAddress()),
					order.notes(), order.lines().stream().map(LineView::of).toList(), order.totalNet(),
					order.totalVat(), order.totalGross(), order.createdBy(), order.createdAt(), order.updatedAt(),
					order.history().stream().map(StatusChangeView::of).toList());
		}

	}

	private final OrderRepository orders;

	private final CustomerService customers;

	private final ProductService products;

	private final InventoryService inventory;

	public OrderService(OrderRepository orders, CustomerService customers, ProductService products,
			InventoryService inventory) {
		this.orders = orders;
		this.customers = customers;
		this.products = products;
		this.inventory = inventory;
	}

	@Transactional(readOnly = true)
	public Page<OrderSummary> search(OrderFilter filter, Pageable pageable) {
		return orders.search(filter, pageable);
	}

	@Transactional(readOnly = true)
	public OrderView get(UUID id) {
		return OrderView.of(find(id));
	}

	@Transactional
	public OrderView place(PlaceOrderCommand command, String actor) {
		CustomerView customer = customers.get(command.customerId());
		if (customer.status() != CustomerStatus.ACTIVE) {
			throw new BusinessRuleException("Il cliente %s è bloccato: non si possono creare ordini".formatted(customer.code()));
		}
		ShippingAddress address = shippingAddress(customer, command.shippingAddressId());
		List<OrderLine> lines = lines(command.items());

		Order order = Order.place(UUID.randomUUID(), orders.nextNumber(), customer.id(), customer.code(),
				customer.name(), address, command.notes(), lines, actor, Instant.now());
		Order saved = orders.save(order);
		for (OrderLine line : sortedForLocking(saved)) {
			inventory.reserve(line.productId(), line.quantity(), saved.id(), actor);
		}
		return OrderView.of(saved);
	}

	@Transactional
	public OrderView confirm(UUID id, String actor) {
		Order order = find(id);
		order.confirm(actor, Instant.now());
		return OrderView.of(orders.save(order));
	}

	/** La spedizione scarica dal magazzino la merce che era solo riservata. */
	@Transactional
	public OrderView ship(UUID id, String actor) {
		Order order = find(id);
		order.ship(actor, Instant.now());
		Order saved = orders.save(order);
		for (OrderLine line : sortedForLocking(saved)) {
			inventory.ship(line.productId(), line.quantity(), saved.id(), actor);
		}
		return OrderView.of(saved);
	}

	@Transactional
	public OrderView deliver(UUID id, String actor) {
		Order order = find(id);
		order.deliver(actor, Instant.now());
		return OrderView.of(orders.save(order));
	}

	/** L'annullamento libera le quantità riservate, così tornano disponibili agli altri ordini. */
	@Transactional
	public OrderView cancel(UUID id, String reason, String actor) {
		Order order = find(id);
		order.cancel(reason, actor, Instant.now());
		Order saved = orders.save(order);
		for (OrderLine line : sortedForLocking(saved)) {
			inventory.release(line.productId(), line.quantity(), saved.id(), actor);
		}
		return OrderView.of(saved);
	}

	private Order find(UUID id) {
		return orders.findById(id).orElseThrow(() -> new NotFoundException("Ordine non trovato: " + id));
	}

	/**
	 * Tocca sempre i prodotti nello stesso ordine: due ordini concorrenti con gli stessi prodotti non possono così
	 * attendersi a vicenda (deadlock).
	 */
	private static List<OrderLine> sortedForLocking(Order order) {
		return order.lines().stream().sorted(Comparator.comparing(OrderLine::productId)).toList();
	}

	/** Unisce le righe dello stesso prodotto e copia dal listino codice, nome, prezzo e IVA. */
	private List<OrderLine> lines(List<ItemCommand> items) {
		Map<UUID, Integer> quantities = new LinkedHashMap<>();
		for (ItemCommand item : items) {
			quantities.merge(item.productId(), item.quantity(), Integer::sum);
		}
		return quantities.entrySet().stream().map(entry -> {
			ProductView product = products.get(entry.getKey());
			if (!product.active()) {
				throw new BusinessRuleException("Il prodotto %s non è attivo".formatted(product.sku()));
			}
			return new OrderLine(product.id(), product.sku(), product.name(), entry.getValue(), product.unitPrice(),
					product.vatRate());
		}).toList();
	}

	private static ShippingAddress shippingAddress(CustomerView customer, UUID requestedId) {
		AddressView chosen;
		if (requestedId != null) {
			chosen = customer.addresses()
				.stream()
				.filter(address -> address.id().equals(requestedId))
				.findFirst()
				.orElseThrow(() -> new BusinessRuleException("L'indirizzo indicato non appartiene al cliente"));
		}
		else {
			List<AddressView> shipping = customer.addresses()
				.stream()
				.filter(address -> address.type() == AddressType.SHIPPING)
				.toList();
			chosen = shipping.stream()
				.filter(AddressView::defaultAddress)
				.findFirst()
				.or(() -> shipping.stream().findFirst())
				.orElseThrow(() -> new BusinessRuleException(
						"Il cliente %s non ha un indirizzo di spedizione".formatted(customer.code())));
		}
		return new ShippingAddress(chosen.street(), chosen.city(), chosen.province(), chosen.postalCode(),
				chosen.country());
	}

}
