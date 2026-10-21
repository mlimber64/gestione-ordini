package it.limber.ordini.shared.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Partita IVA italiana: 11 cifre con cifra di controllo valida. Un valore nullo è considerato valido. */
@Documented
@Constraint(validatedBy = PartitaIvaValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT })
@Retention(RetentionPolicy.RUNTIME)
public @interface PartitaIva {

	String message() default "partita IVA non valida";

	Class<?>[] groups() default {};

	Class<? extends Payload>[] payload() default {};

}
