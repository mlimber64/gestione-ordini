package it.limber.ordini.shared.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class PartitaIvaValidator implements ConstraintValidator<PartitaIva, String> {

	@Override
	public boolean isValid(String value, ConstraintValidatorContext context) {
		return value == null || isValid(value);
	}

	/** Algoritmo di controllo: le cifre in posizione pari (da 1) si raddoppiano, sottraendo 9 se superano 9. */
	public static boolean isValid(String vat) {
		if (vat == null || vat.length() != 11) {
			return false;
		}
		int sum = 0;
		for (int i = 0; i < 11; i++) {
			char c = vat.charAt(i);
			if (c < '0' || c > '9') {
				return false;
			}
			int digit = c - '0';
			if (i < 10) {
				if (i % 2 == 1) {
					digit *= 2;
					if (digit > 9) {
						digit -= 9;
					}
				}
				sum += digit;
			}
			else {
				int check = (10 - sum % 10) % 10;
				return check == digit;
			}
		}
		return false;
	}

}
