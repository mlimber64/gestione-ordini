import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { OrderPayments, Payment, PaymentInput } from '../../core/models';
import { fakeJwt } from '../../core/testing';
import { OrderPaymentsPanel } from './order-payments';

const payment = (overrides: Partial<Payment>): Payment => ({
  id: 'p-1',
  orderId: 'o-1',
  method: 'BANK_TRANSFER',
  status: 'PENDING',
  amount: 10,
  reference: 'CRO 123',
  createdBy: 'anna',
  createdAt: '2026-10-22T10:00:00Z',
  updatedBy: 'anna',
  updatedAt: '2026-10-22T10:00:00Z',
  paidAt: null,
  ...overrides,
});

const summary = (overrides: Partial<OrderPayments>): OrderPayments => ({
  orderId: 'o-1',
  total: 36.6,
  paid: 0,
  pending: 0,
  balance: 36.6,
  registrable: 36.6,
  settlement: 'UNPAID',
  payments: [],
  ...overrides,
});

describe('OrderPaymentsPanel', () => {
  let http: HttpTestingController;
  const open = vi.fn();

  beforeEach(() => {
    open.mockReset();
    TestBed.configureTestingModule({
      imports: [OrderPaymentsPanel],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: MatDialog, useValue: { open } }],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function show(role: string, data: OrderPayments, cancelled = false) {
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: [role] }));
    const fixture = TestBed.createComponent(OrderPaymentsPanel);
    fixture.componentRef.setInput('orderId', 'o-1');
    fixture.componentRef.setInput('cancelled', cancelled);
    fixture.detectChanges();
    http.expectOne('/api/v1/orders/o-1/payments').flush(data);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = () => [...element.querySelectorAll('button')].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
    const click = (label: string) =>
      [...element.querySelectorAll('button')].find((b) => b.textContent!.includes(label))!.click();
    return { fixture, element, buttons, click };
  }

  it('senza pagamenti mostra il totale da incassare e lo stato «Da pagare»', () => {
    const { element } = show('ADMIN', summary({}));
    const text = element.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('Da pagare');
    expect(text).toContain('Totale ordine');
    expect(text).toContain('Nessun pagamento registrato');
    expect(text).toMatch(/36[.,]60/);
  });

  it('elenca i pagamenti con metodo, riferimento e stato in italiano', () => {
    const { element } = show(
      'ADMIN',
      summary({
        paid: 10,
        balance: 26.6,
        registrable: 26.6,
        settlement: 'PARTIAL',
        payments: [payment({ status: 'PAID', paidAt: '2026-10-22T11:00:00Z' }), payment({ id: 'p-2', method: 'CASH_ON_DELIVERY', reference: null })],
      }),
    );
    const text = element.textContent!.replace(/\s+/g, ' ');

    expect(text).toContain('Pagato in parte');
    expect(text).toContain('Bonifico');
    expect(text).toContain('CRO 123');
    expect(text).toContain('Incassato');
    expect(text).toContain('Contrassegno');
    expect(text).toContain('In attesa');
  });

  it('chi può scrivere registra un pagamento e la sezione si ricarica', () => {
    const input: PaymentInput = { method: 'CARD', amount: 20, reference: null };
    open.mockReturnValue({ afterClosed: () => of(input) });
    const { fixture, click } = show('OPERATOR', summary({}));

    click('Registra pagamento');

    expect(open).toHaveBeenCalledWith(expect.anything(), { data: { registrable: 36.6 } });
    const request = http.expectOne({ method: 'POST', url: '/api/v1/orders/o-1/payments' });
    expect(request.request.body).toEqual(input);
    request.flush(payment({ method: 'CARD', amount: 20 }));
    http.expectOne({ method: 'GET', url: '/api/v1/orders/o-1/payments' }).flush(summary({ pending: 20, registrable: 16.6 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nessun pagamento registrato');
  });

  it('se chiudi la finestra senza registrare non parte nessuna richiesta', () => {
    open.mockReturnValue({ afterClosed: () => of(undefined) });
    const { click } = show('ADMIN', summary({}));

    click('Registra pagamento');

    http.expectNone({ method: 'POST', url: '/api/v1/orders/o-1/payments' });
  });

  it('un pagamento in attesa si può incassare e la sezione si ricarica', () => {
    const { buttons, click } = show('ADMIN', summary({ pending: 10, registrable: 26.6, payments: [payment({})] }));

    expect(buttons()).toEqual(expect.arrayContaining(['Incassa', 'Non riuscito']));
    expect(buttons()).not.toContain('Rimborsa');

    click('Incassa');
    http.expectOne({ method: 'POST', url: '/api/v1/payments/p-1/pay' }).flush(payment({ status: 'PAID' }));
    http.expectOne({ method: 'GET', url: '/api/v1/orders/o-1/payments' }).flush(summary({ paid: 10 }));
  });

  it('un pagamento in attesa si può segnare come non riuscito', () => {
    const { click } = show('ADMIN', summary({ pending: 10, registrable: 26.6, payments: [payment({})] }));

    click('Non riuscito');

    http.expectOne({ method: 'POST', url: '/api/v1/payments/p-1/fail' }).flush(payment({ status: 'FAILED' }));
    http.expectOne({ method: 'GET', url: '/api/v1/orders/o-1/payments' }).flush(summary({}));
  });

  it('un pagamento incassato si può solo rimborsare', () => {
    const { buttons, click } = show(
      'ADMIN',
      summary({ paid: 10, balance: 26.6, payments: [payment({ status: 'PAID', paidAt: '2026-10-22T11:00:00Z' })] }),
    );

    expect(buttons()).toContain('Rimborsa');
    expect(buttons()).not.toContain('Incassa');

    click('Rimborsa');
    http.expectOne({ method: 'POST', url: '/api/v1/payments/p-1/refund' }).flush(payment({ status: 'REFUNDED' }));
  });

  it('chi può solo consultare non vede nessuna azione', () => {
    const { buttons } = show('VIEWER', summary({ pending: 10, payments: [payment({})] }));

    expect(buttons().filter((b) => /Registra|Incassa|Non riuscito|Rimborsa/.test(b))).toEqual([]);
  });

  it('per un ordine annullato i pagamenti si vedono ma non se ne registrano di nuovi', () => {
    const { element, buttons } = show('ADMIN', summary({ payments: [payment({})] }), true);

    expect(element.textContent).toContain('CRO 123');
    expect(buttons()).not.toContain('Registra pagamento');
  });

  it('quando l’ordine è già pagato per intero non si può registrare altro', () => {
    const { buttons } = show('ADMIN', summary({ paid: 36.6, balance: 0, registrable: 0, settlement: 'PAID' }));

    expect(buttons()).not.toContain('Registra pagamento');
  });

  it('un errore del server compare come avviso e sblocca i pulsanti', () => {
    const { fixture, click } = show('ADMIN', summary({ pending: 10, payments: [payment({})] }));

    click('Incassa');
    http.expectOne({ method: 'POST', url: '/api/v1/payments/p-1/pay' }).flush(
      { detail: 'Transizione non consentita' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    const pay = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) => b.textContent!.includes('Incassa'))!;
    expect(pay.disabled).toBe(false);
  });
});
