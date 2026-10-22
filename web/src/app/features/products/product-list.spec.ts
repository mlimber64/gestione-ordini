import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Page, Product } from '../../core/models';
import { fakeJwt } from '../../core/testing';
import { ConfirmService } from '../../shared/confirm';
import { ProductList } from './product-list';

const product: Product = {
  id: 'p-1',
  sku: 'PEN-01',
  name: 'Penna',
  description: null,
  categoryId: 'c-1',
  categoryName: 'Cancelleria',
  unitPrice: 2,
  vatRate: 22,
  active: true,
};

const page = (rows: Product[]): Page<Product> => ({ content: rows, page: 0, size: 20, totalElements: rows.length, totalPages: 1 });

describe('ProductList · attivare e disattivare', () => {
  let http: HttpTestingController;
  const ask = vi.fn();
  let component: { toggle(p: Product, active: boolean, control?: { checked: boolean }): void };

  beforeEach(() => {
    ask.mockReset();
    TestBed.configureTestingModule({
      imports: [ProductList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { ask } }],
    });
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: ['ADMIN'] }));
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProductList);
    fixture.detectChanges();
    http.expectOne('/api/v1/categories').flush([]);
    http.expectOne((r) => r.url === '/api/v1/products').flush(page([product]));
    component = fixture.componentInstance as unknown as typeof component;
  });

  it('attivare un prodotto è immediato, senza conferma', () => {
    component.toggle(product, true);

    expect(ask).not.toHaveBeenCalled();
    expect(http.expectOne('/api/v1/products/p-1/active').request.body).toEqual({ active: true });
  });

  it('disattivarlo chiede conferma e, se si conferma, lo disattiva', () => {
    ask.mockReturnValue(of(true));
    component.toggle(product, false);

    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Disattivare il prodotto?', confirmLabel: 'Disattiva' }));
    expect(http.expectOne('/api/v1/products/p-1/active').request.body).toEqual({ active: false });
  });

  it("se si rinuncia non cambia niente e l'interruttore torna acceso", () => {
    ask.mockReturnValue(of(false));
    const control = { checked: false };
    component.toggle(product, false, control);

    http.expectNone('/api/v1/products/p-1/active');
    expect(control.checked).toBe(true);
  });
});
