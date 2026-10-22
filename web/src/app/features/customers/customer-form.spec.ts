import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { Address, Customer } from '../../core/models';
import { fakeJwt } from '../../core/testing';
import { ConfirmService } from '../../shared/confirm';
import { CustomerForm } from './customer-form';

const address = (over: Partial<Address> = {}): Address => ({
  id: 'a-1',
  type: 'SHIPPING',
  street: 'Via Roma 1',
  city: 'Salerno',
  province: 'SA',
  postalCode: '84121',
  country: 'IT',
  defaultAddress: true,
  ...over,
});

const customer = (addresses: Address[]): Customer => ({
  id: 'c-1',
  code: 'CLI-000001',
  name: 'Rossi Srl',
  email: 'info@rossi.example',
  vatNumber: null,
  status: 'ACTIVE',
  phone: null,
  taxCode: null,
  createdAt: '2026-10-21T10:00:00Z',
  updatedAt: '2026-10-21T10:00:00Z',
  addresses,
});

describe('CustomerForm', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CustomerForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function show(role: string, addresses: Address[]) {
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: [role] }));
    const fixture = TestBed.createComponent(CustomerForm);
    fixture.componentRef.setInput('id', 'c-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/customers/c-1').flush(customer(addresses));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra l\'avatar con le iniziali e un riquadro per ogni indirizzo, con il tipo e il predefinito', () => {
    const element = show('ADMIN', [address(), address({ id: 'a-2', type: 'BILLING', defaultAddress: false })]);

    expect(element.querySelector('.avatar-lg')?.textContent?.trim()).toBe('RS');
    const cards = Array.from(element.querySelectorAll('.address'));
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Spedizione');
    expect(cards[0].textContent).toContain('Predefinito');
    expect(cards[1].textContent).toContain('Fatturazione');
    expect(cards[1].textContent).not.toContain('Predefinito');
  });

  it('chi può scrivere ha i pulsanti per modificare ed eliminare ogni indirizzo, chi legge no', () => {
    const writer = show('OPERATOR', [address()]);
    expect(writer.querySelector('button[aria-label="Modifica l\'indirizzo"]')).not.toBeNull();
    expect(writer.querySelector('button[aria-label="Elimina l\'indirizzo"]')).not.toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CustomerForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const reader = show('VIEWER', [address()]);
    expect(reader.querySelector('button[aria-label="Modifica l\'indirizzo"]')).toBeNull();
    expect(reader.querySelector('.address')).not.toBeNull();
  });

  it('senza indirizzi spiega che serve almeno uno di spedizione', () => {
    const element = show('ADMIN', []);

    expect(element.querySelector('.address')).toBeNull();
    expect(element.querySelector('app-empty-state')?.textContent).toContain('almeno un indirizzo di spedizione');
  });
});

describe('CustomerForm · conferme', () => {
  let http: HttpTestingController;
  const ask = vi.fn();
  let component: { block(): void; removeAddress(a: Address): void };

  beforeEach(() => {
    ask.mockReset();
    TestBed.configureTestingModule({
      imports: [CustomerForm],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ConfirmService, useValue: { ask } }],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).accessToken.set(fakeJwt({ sub: 'anna', roles: ['ADMIN'] }));
    const fixture = TestBed.createComponent(CustomerForm);
    fixture.componentRef.setInput('id', 'c-1');
    fixture.detectChanges();
    http.expectOne('/api/v1/customers/c-1').flush(customer([address()]));
    component = fixture.componentInstance as unknown as typeof component;
  });

  it('bloccare il cliente chiede conferma in tono di pericolo e, solo se si conferma, lo blocca', () => {
    ask.mockReturnValue(of(false));
    component.block();
    http.expectNone({ method: 'DELETE', url: '/api/v1/customers/c-1' });

    ask.mockReturnValue(of(true));
    component.block();
    expect(ask).toHaveBeenLastCalledWith(expect.objectContaining({ confirmLabel: 'Blocca cliente', tone: 'danger' }));
    http.expectOne({ method: 'DELETE', url: '/api/v1/customers/c-1' }).flush(null);
    http.expectOne('/api/v1/customers/c-1').flush(customer([address()]));
  });

  it("eliminare un indirizzo dice quale e non parte senza conferma", () => {
    ask.mockReturnValue(of(false));
    component.removeAddress(address());
    http.expectNone('/api/v1/customers/c-1/addresses/a-1');

    ask.mockReturnValue(of(true));
    component.removeAddress(address());
    expect(ask.mock.lastCall![0].message).toContain('Via Roma 1');
    http.expectOne({ method: 'DELETE', url: '/api/v1/customers/c-1/addresses/a-1' }).flush(null);
    http.expectOne('/api/v1/customers/c-1').flush(customer([]));
  });
});
