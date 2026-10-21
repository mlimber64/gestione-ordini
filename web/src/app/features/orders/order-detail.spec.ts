import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { fakeJwt } from '../../core/testing';
import { Order, OrderStatus } from '../../core/models';
import { OrderDetail } from './order-detail';

const order = (status: OrderStatus): Order => ({
  id: 'o-1',
  number: 'ORD-2026-000001',
  customerId: 'c-1',
  customerCode: 'CLI-000001',
  customerName: 'Rossi Srl',
  status,
  shippingAddress: { street: 'Via Roma 1', city: 'Salerno', province: 'SA', postalCode: '84121', country: 'IT' },
  notes: null,
  lines: [
    { productId: 'p-1', sku: 'PEN-01', productName: 'Penna', quantity: 2, unitPrice: 10, vatRate: 22, lineNet: 20, lineVat: 4.4, lineGross: 24.4 },
  ],
  totalNet: 20,
  totalVat: 4.4,
  totalGross: 24.4,
  createdBy: 'admin',
  createdAt: '2026-10-21T10:00:00Z',
  updatedAt: '2026-10-21T10:00:00Z',
  history: [{ from: null, to: 'PENDING', reason: null, changedBy: 'admin', changedAt: '2026-10-21T10:00:00Z' }],
});

describe('OrderDetail', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [OrderDetail],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function show(role: string, status: OrderStatus) {
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: [role] }));
    const fixture = TestBed.createComponent(OrderDetail);
    fixture.componentRef.setInput('id', 'o-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/orders/o-1').flush(order(status));
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const buttons = [...element.querySelectorAll('button')].map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
    return { fixture, element, buttons };
  }

  it("mostra i dati dell'ordine in italiano", () => {
    const { element } = show('ADMIN', 'PENDING');
    const text = element.textContent!;

    expect(text).toContain('ORD-2026-000001');
    expect(text).toContain('Rossi Srl');
    expect(text).toContain('In attesa');
    expect(text).toContain('Via Roma 1');
    expect(text).toContain('PEN-01');
  });

  it("un ordine in attesa si può confermare o annullare, non spedire", () => {
    const { buttons } = show('OPERATOR', 'PENDING');

    expect(buttons.some((b) => b.includes('Conferma'))).toBe(true);
    expect(buttons.some((b) => b.includes('Annulla ordine'))).toBe(true);
    expect(buttons.some((b) => b.includes('Spedisci'))).toBe(false);
  });

  it('un ordine confermato si può spedire', () => {
    const { buttons } = show('ADMIN', 'CONFIRMED');
    expect(buttons.some((b) => b.includes('Spedisci'))).toBe(true);
  });

  it('un ordine spedito si può solo consegnare', () => {
    const { buttons } = show('ADMIN', 'SHIPPED');
    const actions = buttons.filter((b) => /Conferma|Spedisci|Annulla|consegnato/.test(b));
    expect(actions).toHaveLength(1);
    expect(actions[0]).toContain('Segna come consegnato');
  });

  it('gli stati finali non hanno azioni', () => {
    for (const status of ['DELIVERED', 'CANCELLED'] as const) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [OrderDetail],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      });
      http = TestBed.inject(HttpTestingController);
      expect(show('ADMIN', status).buttons.filter((b) => /Conferma|Spedisci|Annulla|consegnato/.test(b))).toEqual([]);
    }
  });

  it("chi può solo consultare non vede nessuna azione", () => {
    const { buttons } = show('VIEWER', 'PENDING');
    expect(buttons.filter((b) => /Conferma|Spedisci|Annulla|consegnato/.test(b))).toEqual([]);
  });
});
