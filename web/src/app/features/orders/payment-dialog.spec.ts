import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { PaymentInput } from '../../core/models';
import { PaymentDialog } from './payment-dialog';

describe('PaymentDialog', () => {
  const close = vi.fn();

  function open(registrable = 36.6) {
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [PaymentDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { registrable } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(PaymentDialog);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      form: {
        controls: {
          amount: { setValue(v: number): void; valid: boolean };
          method: { setValue(v: string): void };
          reference: { setValue(v: string): void };
        };
      };
      save(): void;
    };
    const controls = component.form.controls;
    return {
      amount: (value: number) => controls.amount.setValue(value),
      method: (value: string) => controls.method.setValue(value),
      reference: (value: string) => controls.reference.setValue(value),
      valid: () => controls.amount.valid,
      save: () => component.save(),
    };
  }

  it('propone di registrare tutto ciò che resta da pagare', () => {
    const dialog = open(36.6);
    dialog.save();

    expect(close).toHaveBeenCalledWith({ method: 'BANK_TRANSFER', amount: 36.6, reference: null } satisfies PaymentInput);
  });

  it("l'importo deve essere positivo, con al massimo due decimali e non oltre il residuo", () => {
    const dialog = open(36.6);

    dialog.amount(0);
    expect(dialog.valid()).toBe(false);
    dialog.amount(-5);
    expect(dialog.valid()).toBe(false);
    dialog.amount(10.123);
    expect(dialog.valid()).toBe(false);
    dialog.amount(36.61);
    expect(dialog.valid()).toBe(false);

    dialog.amount(36.6);
    expect(dialog.valid()).toBe(true);
    dialog.amount(0.01);
    expect(dialog.valid()).toBe(true);
    dialog.amount(10.1);
    expect(dialog.valid()).toBe(true);
  });

  it('con un importo non valido non si chiude', () => {
    const dialog = open(36.6);
    dialog.amount(100);
    dialog.save();

    expect(close).not.toHaveBeenCalled();
  });

  it('chiude con metodo, importo e riferimento ripulito', () => {
    const dialog = open(100);
    dialog.method('CASH_ON_DELIVERY');
    dialog.amount(25.5);
    dialog.reference('  CRO 99  ');
    dialog.save();

    expect(close).toHaveBeenCalledWith({ method: 'CASH_ON_DELIVERY', amount: 25.5, reference: 'CRO 99' } satisfies PaymentInput);
  });
});
