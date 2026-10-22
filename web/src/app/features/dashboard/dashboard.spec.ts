import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { OrderStatus, Page } from '../../core/models';
import { fakeJwt } from '../../core/testing';
import { Dashboard } from './dashboard';

const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const page = <T>(content: T[], totalElements = content.length): Page<T> => ({
  content,
  page: 0,
  size: 6,
  totalElements,
  totalPages: 1,
});

describe('Dashboard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: ['OPERATOR'] }));
    http = TestBed.inject(HttpTestingController);
  });

  /** Risponde alle chiamate del cruscotto: i totali per stato, gli ultimi ordini e le scorte basse. */
  function load(counts: number[], lowTotal: number) {
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const orders = http.match((r) => r.url === '/api/v1/orders');
    STATUSES.forEach((status, index) => {
      const request = orders.find((r) => r.request.params.get('status') === status)!;
      request.flush(page([], counts[index]));
    });
    orders.find((r) => r.request.params.get('status') === null)!.flush(
      page([
        { id: 'o-1', number: 'ORD-1', customerName: 'Rossi Srl', status: 'PENDING', totalGross: 12.2, createdAt: '2026-10-22T10:00:00Z' },
      ]),
    );
    http.expectOne((r) => r.url === '/api/v1/inventory').flush(
      page(
        Array.from({ length: Math.min(lowTotal, 6) }, (_, i) => ({
          productId: `p-${i}`,
          sku: `SKU-${i}`,
          productName: 'Prodotto',
          onHand: 3,
          reserved: 0,
          available: 2,
          reorderLevel: 4,
          lowStock: true,
        })),
        lowTotal,
      ),
    );
    fixture.detectChanges();
    return { fixture, element };
  }

  it('mostra il totale per stato e la quota di ciascuno sul totale', () => {
    const { element } = load([51, 55, 1, 2, 1], 0);

    const values = Array.from(element.querySelectorAll('.kpi-value')).map((e) => e.textContent?.trim());
    expect(values).toEqual(['51', '55', '1', '2', '1']);
    const shares = Array.from(element.querySelectorAll('.kpi-share small')).map((e) => e.textContent?.trim());
    expect(shares).toEqual(['46%', '50%', '1%', '2%', '1%']);
    expect(element.querySelector('.ring-total')?.textContent).toBe('110');
  });

  it('segnala da subito ciò che richiede attenzione, con il totale vero delle scorte basse', () => {
    const { element } = load([4, 0, 0, 0, 0], 9);

    const alerts = Array.from(element.querySelectorAll('.alert')).map((e) => e.textContent);
    expect(alerts[0]).toContain('Da confermare: 4');
    // Si mostrano al massimo 6 righe, ma il numero è il totale
    expect(alerts[1]).toContain('Sotto scorta: 9');
    expect(element.querySelectorAll('.stock').length).toBe(6);
  });

  it('senza nulla da gestire non mostra la fascia di attenzione', () => {
    const { element } = load([0, 5, 0, 0, 0], 0);

    expect(element.querySelector('.attention')).toBeNull();
    expect(element.textContent).toContain('Tutte le scorte sono sopra soglia');
  });

  it('con zero ordini l\'anello è vuoto e le quote sono zero, senza dividere per zero', () => {
    const { element } = load([0, 0, 0, 0, 0], 0);

    expect(element.querySelectorAll('.ring .seg').length).toBe(0);
    expect(Array.from(element.querySelectorAll('.kpi-share small')).every((e) => e.textContent?.trim() === '0%')).toBe(true);
  });

  it('il pulsante per un nuovo ordine compare solo a chi può scrivere', () => {
    const { element } = load([0, 0, 0, 0, 0], 0);
    expect(element.textContent).toContain('Nuovo ordine');

    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'luca', roles: ['VIEWER'] }));
    const viewer = TestBed.createComponent(Dashboard);
    viewer.detectChanges();
    expect((viewer.nativeElement as HTMLElement).textContent).not.toContain('Nuovo ordine');
  });
});
