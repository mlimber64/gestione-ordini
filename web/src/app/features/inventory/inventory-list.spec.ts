import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Page, Stock } from '../../core/models';
import { fakeJwt } from '../../core/testing';
import { InventoryList } from './inventory-list';
import { StockAction } from './stock-dialog';

const stock: Stock = {
  productId: 'p-1',
  sku: 'PEN-01',
  productName: 'Penna',
  onHand: 10,
  reserved: 2,
  available: 8,
  reorderLevel: 5,
  lowStock: false,
};

const page = (rows: Stock[]): Page<Stock> => ({ content: rows, page: 0, size: 20, totalElements: rows.length, totalPages: 1 });

describe('InventoryList', () => {
  let http: HttpTestingController;
  let open: ReturnType<typeof vi.fn>;
  let component: { act(action: StockAction, stock: Stock): void };

  beforeEach(() => {
    sessionStorage.clear();
    open = vi.fn();
    TestBed.configureTestingModule({
      imports: [InventoryList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: MatDialog, useValue: { open } }],
    });
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: ['OPERATOR'] }));
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(InventoryList);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/inventory').flush(page([stock]));
    fixture.detectChanges();
    component = fixture.componentInstance as unknown as typeof component;
  });

  const choose = (result: { value: number; note: string }) => open.mockReturnValue({ afterClosed: () => of(result) });

  it('il carico chiama l\'API dei carichi con la nota', () => {
    choose({ value: 5, note: 'bolla 7' });
    component.act('receive', stock);

    const request = http.expectOne('/api/v1/inventory/p-1/receipts');
    expect(request.request.body).toEqual({ quantity: 5, note: 'bolla 7' });
    request.flush(stock);
    http.expectOne((r) => r.url === '/api/v1/inventory').flush(page([stock]));
  });

  it('un carico senza nota invia null', () => {
    choose({ value: 5, note: '' });
    component.act('receive', stock);

    expect(http.expectOne('/api/v1/inventory/p-1/receipts').request.body).toEqual({ quantity: 5, note: null });
  });

  it('la rettifica chiama l\'API delle rettifiche con il motivo', () => {
    choose({ value: -2, note: 'rottura' });
    component.act('adjust', stock);

    expect(http.expectOne('/api/v1/inventory/p-1/adjustments').request.body).toEqual({ delta: -2, note: 'rottura' });
  });

  it('la soglia chiama l\'API della soglia di riordino', () => {
    choose({ value: 7, note: '' });
    component.act('reorder', stock);

    const request = http.expectOne('/api/v1/inventory/p-1/reorder-level');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ reorderLevel: 7 });
  });

  it('se la finestra si chiude senza conferma non succede nulla', () => {
    open.mockReturnValue({ afterClosed: () => of(undefined) });
    component.act('receive', stock);

    expect(open).toHaveBeenCalledTimes(1);
    http.expectNone('/api/v1/inventory/p-1/receipts');
  });
});
