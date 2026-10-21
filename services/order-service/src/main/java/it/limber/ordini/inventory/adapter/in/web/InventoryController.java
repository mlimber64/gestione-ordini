package it.limber.ordini.inventory.adapter.in.web;

import it.limber.ordini.inventory.application.InventoryService;
import it.limber.ordini.inventory.application.InventoryService.MovementView;
import it.limber.ordini.inventory.application.InventoryService.StockView;
import it.limber.ordini.shared.web.PageResponse;
import it.limber.ordini.shared.web.PageableFactory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory")
class InventoryController {

	private static final Set<String> SORTABLE = Set.of("sku", "name", "onHand", "available");

	record ReceiptRequest(@NotNull @Min(1) @Max(1_000_000) Integer quantity, @Size(max = 300) String note) {
	}

	record AdjustmentRequest(@NotNull @Min(-1_000_000) @Max(1_000_000) Integer delta,
			@NotBlank @Size(max = 300) String note) {
	}

	record ReorderLevelRequest(@NotNull @Min(0) @Max(1_000_000) Integer reorderLevel) {
	}

	private final InventoryService inventory;

	InventoryController(InventoryService inventory) {
		this.inventory = inventory;
	}

	@GetMapping
	PageResponse<StockView> list(@RequestParam(required = false) String q,
			@RequestParam(defaultValue = "false") boolean lowStock, @RequestParam(defaultValue = "0") @Min(0) int page,
			@RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
			@RequestParam(required = false) String sort) {
		var pageable = PageableFactory.of(page, size, sort, SORTABLE, Sort.by("sku"));
		return PageResponse.from(inventory.list(q, lowStock, pageable), view -> view);
	}

	@GetMapping("/{productId}")
	StockView get(@PathVariable UUID productId) {
		return inventory.get(productId);
	}

	@GetMapping("/{productId}/movements")
	PageResponse<MovementView> movements(@PathVariable UUID productId,
			@RequestParam(defaultValue = "0") @Min(0) int page,
			@RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
		return PageResponse.from(inventory.movements(productId, PageRequest.of(page, size)), view -> view);
	}

	@PostMapping("/{productId}/receipts")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	StockView receive(@PathVariable UUID productId, @Valid @RequestBody ReceiptRequest request,
			Authentication authentication) {
		return inventory.receive(productId, request.quantity(), request.note(), authentication.getName());
	}

	@PostMapping("/{productId}/adjustments")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	StockView adjust(@PathVariable UUID productId, @Valid @RequestBody AdjustmentRequest request,
			Authentication authentication) {
		return inventory.adjust(productId, request.delta(), request.note(), authentication.getName());
	}

	@PatchMapping("/{productId}/reorder-level")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	StockView setReorderLevel(@PathVariable UUID productId, @Valid @RequestBody ReorderLevelRequest request) {
		return inventory.setReorderLevel(productId, request.reorderLevel());
	}

}
