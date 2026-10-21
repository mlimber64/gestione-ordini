package it.limber.ordini.order.domain;

import it.limber.ordini.shared.error.BusinessRuleException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

/** Riga d'ordine con codice, nome e prezzo copiati dal listino al momento dell'acquisto. */
public record OrderLine(UUID productId, String sku, String productName, int quantity, BigDecimal unitPrice,
		BigDecimal vatRate) {

	private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

	public OrderLine {
		if (quantity < 1) {
			throw new BusinessRuleException("La quantità di %s deve essere almeno 1".formatted(sku));
		}
	}

	/** Imponibile della riga. */
	public BigDecimal net() {
		return unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
	}

	public BigDecimal vat() {
		return net().multiply(vatRate).divide(HUNDRED, 2, RoundingMode.HALF_UP);
	}

	public BigDecimal gross() {
		return net().add(vat());
	}

}
