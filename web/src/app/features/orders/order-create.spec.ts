import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Product } from '../../core/models';
import { OrderCreate } from './order-create';

const product = (price: number, vat: number): Product => ({
  id: 'p-1',
  sku: 'PEN-01',
  name: 'Penna',
  description: null,
  categoryId: 'c-1',
  categoryName: 'Cancelleria',
  unitPrice: price,
  vatRate: vat,
  active: true,
});

describe('OrderCreate', () => {
  let component: {
    productLabel(value: Product | string | null): string;
    lineGross(line: { product: Product; quantity: number }): number;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrderCreate],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    component = TestBed.createComponent(OrderCreate).componentInstance as unknown as typeof component;
  });

  it('l\'etichetta del prodotto mostra SKU e nome, e rispetta il testo digitato', () => {
    expect(component.productLabel(product(10, 22))).toBe('PEN-01 · Penna');
    expect(component.productLabel('pen')).toBe('pen');
    expect(component.productLabel(null)).toBe('');
  });

  it('il totale di riga stimato arrotonda come il server: imponibile e IVA al centesimo', () => {
    // 3 x 9,99 = 29,97 + IVA 22% (6,5934 → 6,59) = 36,56
    expect(component.lineGross({ product: product(9.99, 22), quantity: 3 })).toBeCloseTo(36.56, 2);
    expect(component.lineGross({ product: product(10, 4), quantity: 2 })).toBeCloseTo(20.8, 2);
  });
});
