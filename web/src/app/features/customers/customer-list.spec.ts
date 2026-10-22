import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CustomerSummary, Page } from '../../core/models';
import { fakeJwt } from '../../core/testing';
import { CustomerDialogResult } from './customer-dialog';
import { CustomerList } from './customer-list';

const customer = (name: string): CustomerSummary => ({
  id: name,
  code: 'CLI-1',
  name,
  email: 'info@example.test',
  vatNumber: null,
  status: 'ACTIVE',
});

const page = (rows: CustomerSummary[]): Page<CustomerSummary> => ({
  content: rows,
  page: 0,
  size: 20,
  totalElements: rows.length,
  totalPages: 1,
});

describe('CustomerList', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CustomerList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: ['VIEWER'] }));
    http = TestBed.inject(HttpTestingController);
  });

  function open() {
    const fixture = TestBed.createComponent(CustomerList);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('mentre carica mostra righe segnaposto e non il messaggio di elenco vuoto', () => {
    const { element } = open();

    expect(element.querySelector('app-table-skeleton')).not.toBeNull();
    expect(element.querySelector('app-empty-state')).toBeNull();
    http.expectOne((r) => r.url === '/api/v1/customers').flush(page([]));
  });

  it('senza risultati mostra lo stato vuoto con il suggerimento', () => {
    const { fixture, element } = open();
    http.expectOne((r) => r.url === '/api/v1/customers').flush(page([]));
    fixture.detectChanges();

    expect(element.querySelector('app-table-skeleton')).toBeNull();
    expect(element.querySelector('app-empty-state')?.textContent).toContain('Nessun cliente trovato');
    expect(element.querySelector('.page-sub')?.textContent).toContain('0 clienti in totale');
  });

  it('le iniziali dell\'avatar sono quelle delle prime due parole', () => {
    const { fixture, element } = open();
    http.expectOne((r) => r.url === '/api/v1/customers').flush(page([customer('E2E Cliente MVK2'), customer('Capaccio')]));
    fixture.detectChanges();

    const avatars = Array.from(element.querySelectorAll('.avatar-sm')).map((e) => e.textContent?.trim());
    expect(avatars).toEqual(['EC', 'C']);
  });
});

describe('CustomerList · nuovo cliente', () => {
  let http: HttpTestingController;
  const open = vi.fn();
  let component: { create(): void };
  let navigate: ReturnType<typeof vi.spyOn>;

  const result = (withAddress: boolean): CustomerDialogResult => ({
    customer: { name: 'Rossi Srl', email: 'info@rossi.example', phone: null, vatNumber: null, taxCode: null },
    address: withAddress
      ? { type: 'SHIPPING', street: 'Via Roma 1', city: 'Salerno', province: 'SA', postalCode: '84121', country: 'IT', defaultAddress: true }
      : null,
  });

  beforeEach(() => {
    open.mockReset();
    TestBed.configureTestingModule({
      imports: [CustomerList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: MatDialog, useValue: { open } }],
    });
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: ['OPERATOR'] }));
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(CustomerList);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/customers').flush(page([]));
    component = fixture.componentInstance as unknown as typeof component;
  });

  it('se si chiude la finestra senza registrare non succede niente', () => {
    open.mockReturnValue({ afterClosed: () => of(undefined) });
    component.create();

    http.expectNone('/api/v1/customers');
    expect(navigate).not.toHaveBeenCalled();
  });

  it("registra il cliente e, se c'è, il suo indirizzo, poi apre la scheda", () => {
    open.mockReturnValue({ afterClosed: () => of(result(true)) });
    component.create();

    http.expectOne({ method: 'POST', url: '/api/v1/customers' }).flush({ ...customer('Rossi Srl'), id: 'c-9' });
    const address = http.expectOne({ method: 'POST', url: '/api/v1/customers/c-9/addresses' });
    expect(address.request.body).toMatchObject({ type: 'SHIPPING', defaultAddress: true });
    address.flush({});
    expect(navigate).toHaveBeenCalledWith(['/clienti', 'c-9']);
  });

  it("senza indirizzo registra solo il cliente e apre la scheda", () => {
    open.mockReturnValue({ afterClosed: () => of(result(false)) });
    component.create();

    http.expectOne({ method: 'POST', url: '/api/v1/customers' }).flush({ ...customer('Rossi Srl'), id: 'c-9' });

    http.expectNone('/api/v1/customers/c-9/addresses');
    expect(navigate).toHaveBeenCalledWith(['/clienti', 'c-9']);
  });

  it("se l'indirizzo non si salva il cliente c'è comunque e si apre la sua scheda", () => {
    open.mockReturnValue({ afterClosed: () => of(result(true)) });
    component.create();

    http.expectOne({ method: 'POST', url: '/api/v1/customers' }).flush({ ...customer('Rossi Srl'), id: 'c-9' });
    http.expectOne('/api/v1/customers/c-9/addresses').flush({ detail: 'x' }, { status: 500, statusText: 'Errore' });

    expect(navigate).toHaveBeenCalledWith(['/clienti', 'c-9']);
  });

  it('un errore nella registrazione non apre nessuna scheda', () => {
    open.mockReturnValue({ afterClosed: () => of(result(false)) });
    component.create();

    http.expectOne({ method: 'POST', url: '/api/v1/customers' }).flush({ detail: 'Email già in uso' }, { status: 409, statusText: 'Conflict' });

    expect(navigate).not.toHaveBeenCalled();
  });
});
