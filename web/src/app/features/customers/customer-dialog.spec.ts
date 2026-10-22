import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { CustomerDialog, CustomerDialogResult } from './customer-dialog';

describe('CustomerDialog', () => {
  const close = vi.fn();

  beforeEach(() => {
    close.mockReset();
    TestBed.configureTestingModule({ imports: [CustomerDialog], providers: [{ provide: MatDialogRef, useValue: { close } }] });
  });

  function open() {
    const fixture = TestBed.createComponent(CustomerDialog);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = () => {
      element.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      fixture.detectChanges();
    };
    const toggleAddress = () => {
      element.querySelector<HTMLInputElement>('mat-checkbox input')!.click();
      fixture.detectChanges();
    };
    return { fixture, element, type, submit, toggleAddress };
  }

  it('senza dati non chiude e segnala i campi obbligatori', () => {
    const { element, submit } = open();
    submit();

    expect(close).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Obbligatorio');
  });

  it("senza indirizzo i suoi campi non esistono e non impediscono di salvare", () => {
    const { element, type, submit } = open();
    expect(element.querySelector('[formgroupname=address]')).toBeNull();

    type('input[formcontrolname=name]', '  Rossi Srl ');
    type('input[formcontrolname=email]', 'info@rossi.example');
    type('input[formcontrolname=taxCode]', 'rssmra80a01h501u');
    submit();

    const result = close.mock.lastCall![0] as CustomerDialogResult;
    expect(result.customer).toEqual({
      name: 'Rossi Srl',
      email: 'info@rossi.example',
      phone: null,
      vatNumber: null,
      taxCode: 'RSSMRA80A01H501U',
    });
    expect(result.address).toBeNull();
  });

  it('una partita IVA con la cifra finale sbagliata non si accetta', () => {
    const { element, type, submit } = open();
    type('input[formcontrolname=name]', 'Rossi Srl');
    type('input[formcontrolname=email]', 'info@rossi.example');
    type('input[formcontrolname=vatNumber]', '12345678901');
    submit();

    expect(close).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Partita IVA non valida');
  });

  it("con l'indirizzo spuntato i suoi campi sono obbligatori e il risultato lo porta come predefinito di spedizione", () => {
    const { element, type, submit, toggleAddress } = open();
    type('input[formcontrolname=name]', 'Rossi Srl');
    type('input[formcontrolname=email]', 'info@rossi.example');
    toggleAddress();
    submit();
    expect(close).not.toHaveBeenCalled();
    expect(element.querySelector('[formgroupname=address]')).not.toBeNull();

    type('input[formcontrolname=street]', 'Via Roma 1');
    type('input[formcontrolname=city]', 'Salerno');
    type('input[formcontrolname=province]', 'sa');
    type('input[formcontrolname=postalCode]', '84121');
    submit();

    const result = close.mock.lastCall![0] as CustomerDialogResult;
    expect(result.address).toEqual({
      type: 'SHIPPING',
      street: 'Via Roma 1',
      city: 'Salerno',
      province: 'SA',
      postalCode: '84121',
      country: 'IT',
      defaultAddress: true,
    });
  });

  it("togliendo la spunta l'indirizzo non si invia, anche se era stato compilato", () => {
    const { type, submit, toggleAddress } = open();
    type('input[formcontrolname=name]', 'Rossi Srl');
    type('input[formcontrolname=email]', 'info@rossi.example');
    toggleAddress();
    type('input[formcontrolname=street]', 'Via Roma 1');
    toggleAddress();
    submit();

    expect((close.mock.lastCall![0] as CustomerDialogResult).address).toBeNull();
  });
});
