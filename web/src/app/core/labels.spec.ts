import { HttpErrorResponse } from '@angular/common/http';
import { validVatNumber } from '../features/customers/customer-form';
import { errorMessage } from './errors';
import { NEXT_STEPS, ORDER_STATUS_LABEL } from './labels';
import { OrderStatus } from './models';

describe('NEXT_STEPS', () => {
  it('ha un elenco di passi per ogni stato e gli stati finali non ne hanno', () => {
    const statuses = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];
    expect(Object.keys(NEXT_STEPS).sort()).toEqual([...statuses].sort());
    expect(NEXT_STEPS.DELIVERED).toEqual([]);
    expect(NEXT_STEPS.CANCELLED).toEqual([]);
  });

  it("si può annullare solo prima della spedizione", () => {
    expect(NEXT_STEPS.PENDING).toContain('cancel');
    expect(NEXT_STEPS.CONFIRMED).toContain('cancel');
    expect(NEXT_STEPS.SHIPPED).not.toContain('cancel');
  });
});

describe('validVatNumber', () => {
  it('accetta partite IVA con la cifra di controllo corretta', () => {
    for (const vat of ['12345678903', '12345678911', '12345678929']) expect(validVatNumber(vat)).toBe(true);
  });

  it('rifiuta cifra di controllo errata, lunghezza sbagliata e caratteri non numerici', () => {
    expect(validVatNumber('12345678900')).toBe(false);
    expect(validVatNumber('1234567890')).toBe(false);
    expect(validVatNumber('1234567890a')).toBe(false);
  });
});

describe('errorMessage', () => {
  it('usa il dettaglio del problem+json', () => {
    const error = new HttpErrorResponse({ status: 409, error: { detail: 'Giacenza insufficiente per PEN-01' } });
    expect(errorMessage(error)).toBe('Giacenza insufficiente per PEN-01');
  });

  it('elenca i campi non validi', () => {
    const error = new HttpErrorResponse({ status: 400, error: { errors: { email: 'non valida', name: 'obbligatorio' } } });
    expect(errorMessage(error)).toBe('email: non valida · name: obbligatorio');
  });

  it('distingue server irraggiungibile, permessi e errori sconosciuti', () => {
    expect(errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('non raggiungibile');
    expect(errorMessage(new HttpErrorResponse({ status: 403 }))).toContain('permessi');
    expect(errorMessage(new Error('boom'))).toContain('imprevisto');
  });
});
