package it.limber.ordini.shared.web;

import it.limber.ordini.shared.error.BusinessRuleException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/** Costruisce un {@link Pageable} accettando solo campi di ordinamento esplicitamente consentiti. */
public final class PageableFactory {

	private PageableFactory() {
	}

	/**
	 * @param sort espressione nel formato {@code campo} o {@code campo,asc|desc}; può essere nulla
	 */
	public static Pageable of(int page, int size, String sort, Set<String> allowedFields, Sort defaultSort) {
		if (sort == null || sort.isBlank()) {
			return PageRequest.of(page, size, defaultSort);
		}
		String[] parts = sort.split(",");
		String field = parts[0].trim();
		if (!allowedFields.contains(field)) {
			throw new BusinessRuleException("Campo di ordinamento non consentito: " + field + ". Valori ammessi: "
					+ String.join(", ", allowedFields.stream().sorted().toList()));
		}
		Sort.Direction direction = Sort.Direction.ASC;
		if (parts.length > 1) {
			direction = Sort.Direction.fromOptionalString(parts[1].trim())
				.orElseThrow(() -> new BusinessRuleException("Direzione di ordinamento non valida: " + parts[1]));
		}
		return PageRequest.of(page, size, Sort.by(direction, field).and(Sort.by("id")));
	}

}
