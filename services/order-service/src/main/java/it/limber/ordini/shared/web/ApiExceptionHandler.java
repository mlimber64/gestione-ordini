package it.limber.ordini.shared.web;

import it.limber.ordini.shared.error.AuthenticationFailedException;
import it.limber.ordini.shared.error.BusinessRuleException;
import it.limber.ordini.shared.error.ConflictException;
import it.limber.ordini.shared.error.NotFoundException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Traduce le eccezioni in risposte {@code application/problem+json} (RFC 9457). Ha la precedenza massima perché
 * Spring Boot registra un proprio handler con priorità 0, che altrimenti risponderebbe senza l'elenco degli errori.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
class ApiExceptionHandler {

	@ExceptionHandler(NotFoundException.class)
	ProblemDetail notFound(NotFoundException ex) {
		return problem(HttpStatus.NOT_FOUND, "Risorsa non trovata", ex.getMessage());
	}

	@ExceptionHandler(ConflictException.class)
	ProblemDetail conflict(ConflictException ex) {
		return problem(HttpStatus.CONFLICT, "Conflitto", ex.getMessage());
	}

	@ExceptionHandler(BusinessRuleException.class)
	ProblemDetail businessRule(BusinessRuleException ex) {
		return problem(HttpStatus.UNPROCESSABLE_ENTITY, "Regola di business violata", ex.getMessage());
	}

	@ExceptionHandler(AuthenticationFailedException.class)
	ProblemDetail authenticationFailed(AuthenticationFailedException ex) {
		return problem(HttpStatus.UNAUTHORIZED, "Autenticazione non riuscita", ex.getMessage());
	}

	@ExceptionHandler(ObjectOptimisticLockingFailureException.class)
	ProblemDetail optimisticLock() {
		return problem(HttpStatus.CONFLICT, "Modifica concorrente",
				"La risorsa è stata modificata da un altro utente. Ricarica i dati e riprova.");
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	ProblemDetail dataIntegrity() {
		return problem(HttpStatus.CONFLICT, "Conflitto",
				"L'operazione è in conflitto con i dati esistenti (valore duplicato o riferimento ancora in uso).");
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ProblemDetail invalidBody(MethodArgumentNotValidException ex) {
		Map<String, String> errors = new LinkedHashMap<>();
		for (FieldError error : ex.getBindingResult().getFieldErrors()) {
			errors.putIfAbsent(error.getField(), error.getDefaultMessage());
		}
		ProblemDetail problem = problem(HttpStatus.BAD_REQUEST, "Dati non validi",
				"Uno o più campi non sono validi.");
		problem.setProperty("errors", errors);
		return problem;
	}

	@ExceptionHandler(HandlerMethodValidationException.class)
	ProblemDetail invalidParameters(HandlerMethodValidationException ex) {
		return problem(HttpStatus.BAD_REQUEST, "Parametri non validi", "Uno o più parametri non sono validi.");
	}

	@ExceptionHandler({ HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class })
	ProblemDetail unreadable() {
		return problem(HttpStatus.BAD_REQUEST, "Richiesta non valida", "Il corpo o i parametri della richiesta non sono leggibili.");
	}

	private static ProblemDetail problem(HttpStatus status, String title, String detail) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setTitle(title);
		return problem;
	}

}
