package it.limber.ordini.order.adapter.in.web;

import it.limber.ordini.order.application.OrderService;
import it.limber.ordini.order.application.OrderService.ItemCommand;
import it.limber.ordini.order.application.OrderService.OrderView;
import it.limber.ordini.order.application.OrderService.PlaceOrderCommand;
import it.limber.ordini.order.domain.OrderFilter;
import it.limber.ordini.order.domain.OrderStatus;
import it.limber.ordini.order.domain.OrderSummary;
import it.limber.ordini.shared.web.PageResponse;
import it.limber.ordini.shared.web.PageableFactory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
class OrderController {

	private static final Set<String> SORTABLE = Set.of("number", "createdAt", "totalGross", "status");

	record ItemRequest(@NotNull UUID productId, @NotNull @Min(1) @Max(10_000) Integer quantity) {
	}

	record PlaceOrderRequest(@NotNull UUID customerId, UUID shippingAddressId, @Size(max = 500) String notes,
			@NotEmpty @Size(max = 100) List<@Valid @NotNull ItemRequest> items) {

		PlaceOrderCommand toCommand() {
			return new PlaceOrderCommand(customerId, shippingAddressId, notes,
					items.stream().map(item -> new ItemCommand(item.productId(), item.quantity())).toList());
		}

	}

	record CancelRequest(@NotBlank @Size(max = 300) String reason) {
	}

	private final OrderService orders;

	OrderController(OrderService orders) {
		this.orders = orders;
	}

	@GetMapping
	PageResponse<OrderSummary> search(@RequestParam(required = false) OrderStatus status,
			@RequestParam(required = false) UUID customerId, @RequestParam(required = false) String q,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
			@RequestParam(defaultValue = "0") @Min(0) int page,
			@RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
			@RequestParam(required = false) String sort) {
		var filter = new OrderFilter(status, customerId, q, from == null ? null : from.atStartOfDay(ZoneOffset.UTC).toInstant(),
				to == null ? null : to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant());
		var pageable = PageableFactory.of(page, size, sort, SORTABLE, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id")));
		return PageResponse.from(orders.search(filter, pageable), summary -> summary);
	}

	@GetMapping("/{id}")
	OrderView get(@PathVariable UUID id) {
		return orders.get(id);
	}

	@PostMapping
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	ResponseEntity<OrderView> place(@Valid @RequestBody PlaceOrderRequest request, Authentication authentication) {
		OrderView created = orders.place(request.toCommand(), authentication.getName());
		URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(created.id()).toUri();
		return ResponseEntity.created(location).body(created);
	}

	@PostMapping("/{id}/confirm")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	OrderView confirm(@PathVariable UUID id, Authentication authentication) {
		return orders.confirm(id, authentication.getName());
	}

	@PostMapping("/{id}/ship")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	OrderView ship(@PathVariable UUID id, Authentication authentication) {
		return orders.ship(id, authentication.getName());
	}

	@PostMapping("/{id}/deliver")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	OrderView deliver(@PathVariable UUID id, Authentication authentication) {
		return orders.deliver(id, authentication.getName());
	}

	@PostMapping("/{id}/cancel")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	OrderView cancel(@PathVariable UUID id, @Valid @RequestBody CancelRequest request,
			Authentication authentication) {
		return orders.cancel(id, request.reason(), authentication.getName());
	}

}
