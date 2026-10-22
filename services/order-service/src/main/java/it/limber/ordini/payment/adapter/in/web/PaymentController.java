package it.limber.ordini.payment.adapter.in.web;

import it.limber.ordini.payment.application.PaymentService;
import it.limber.ordini.payment.application.PaymentService.OrderPaymentsView;
import it.limber.ordini.payment.application.PaymentService.PaymentView;
import it.limber.ordini.payment.application.PaymentService.RegisterCommand;
import it.limber.ordini.payment.domain.PaymentMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
class PaymentController {

	record RegisterRequest(@NotNull PaymentMethod method,
			@NotNull @DecimalMin(value = "0.01", message = "L'importo deve essere almeno 0,01") @Digits(integer = 12, fraction = 2) BigDecimal amount,
			@Size(max = 100) String reference) {

		RegisterCommand toCommand() {
			return new RegisterCommand(method, amount, reference);
		}

	}

	private final PaymentService payments;

	PaymentController(PaymentService payments) {
		this.payments = payments;
	}

	@GetMapping("/orders/{orderId}/payments")
	OrderPaymentsView forOrder(@PathVariable UUID orderId) {
		return payments.forOrder(orderId);
	}

	@PostMapping("/orders/{orderId}/payments")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	ResponseEntity<PaymentView> register(@PathVariable UUID orderId, @Valid @RequestBody RegisterRequest request,
			Authentication authentication) {
		PaymentView created = payments.register(orderId, request.toCommand(), authentication.getName());
		URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
			.path("/api/v1/orders/{orderId}/payments")
			.buildAndExpand(orderId)
			.toUri();
		return ResponseEntity.created(location).body(created);
	}

	@PostMapping("/payments/{id}/pay")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	PaymentView pay(@PathVariable UUID id, Authentication authentication) {
		return payments.markPaid(id, authentication.getName());
	}

	@PostMapping("/payments/{id}/fail")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	PaymentView fail(@PathVariable UUID id, Authentication authentication) {
		return payments.markFailed(id, authentication.getName());
	}

	@PostMapping("/payments/{id}/refund")
	@PreAuthorize("hasAnyRole('ADMIN', 'OPERATOR')")
	PaymentView refund(@PathVariable UUID id, Authentication authentication) {
		return payments.refund(id, authentication.getName());
	}

}
