import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Product } from '../../core/models';
import { OrderCreate } from './order-create';

const product = (id: string, price: number): Product => ({
  id,
  sku: `SKU-${id}`,
  name: `Prodotto ${id}`,
  description: null,
  categoryId: 'c-1',
  categoryName: 'Cancelleria',
  unitPrice: price,
  vatRate: 22,
  active: true,
});

interface Internals {
  lines: { set(lines: { product: Product; quantity: number }[]): void };
  pieces(): number;
  total(): number;
}

describe('OrderCreate · riepilogo', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<OrderCreate>>;
  let internals: Internals;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrderCreate],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(OrderCreate);
    internals = fixture.componentInstance as unknown as Internals;
    fixture.detectChanges();
  });

  it('all\'inizio nessun requisito è soddisfatto e non si può creare l\'ordine', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.checks li.ok').length).toBe(0);
    expect(element.querySelector<HTMLButtonElement>('.cta')?.disabled).toBe(true);
    expect(internals.pieces()).toBe(0);
  });

  it('con delle righe il riepilogo somma i pezzi e il totale stimato, e spunta «Almeno un prodotto»', () => {
    internals.lines.set([
      { product: product('1', 10), quantity: 3 },
      { product: product('2', 5), quantity: 2 },
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(internals.pieces()).toBe(5);
    expect(internals.total()).toBeCloseTo(48.8, 2);
    expect(element.querySelector('.checks li.ok')?.textContent).toContain('Almeno un prodotto');
    expect(element.querySelector('.grand')?.textContent).toMatch(/48[.,]80/);
    // Senza cliente e indirizzo non si può ancora creare
    expect(element.querySelector<HTMLButtonElement>('.cta')?.disabled).toBe(true);
  });
});
