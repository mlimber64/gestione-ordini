import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { CustomerSummary, Page } from '../../core/models';
import { fakeJwt } from '../../core/testing';
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
