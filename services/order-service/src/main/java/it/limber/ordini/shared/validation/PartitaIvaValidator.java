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
		if (vat == null || vat.length() != 11 || !vat.chars().allMatch(c -> c >= '0' && c <= '9')) {
			return false;
		}
		return checkDigit(vat) == vat.charAt(10) - '0';
	}

	/** Cifra di controllo calcolata sulle prime dieci cifre. */
	private static int checkDigit(String vat) {
		int sum = 0;
		for (int i = 0; i < 10; i++) {
			int digit = vat.charAt(i) - '0';
			if (i % 2 == 1) {
				digit *= 2;
				if (digit > 9) {
					digit -= 9;
				}
			}
			sum += digit;
		}
		return (10 - sum % 10) % 10;
	}
}
