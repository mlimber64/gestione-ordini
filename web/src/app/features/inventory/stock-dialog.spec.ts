import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Stock } from '../../core/models';
import { StockAction, StockDialog, StockDialogResult } from './stock-dialog';

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

describe('StockDialog', () => {
  const close = vi.fn();

  function open(action: StockAction) {
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [StockDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { action, stock } },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    const fixture = TestBed.createComponent(StockDialog);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      form: { controls: { value: { setValue(v: number): void; valid: boolean }; note: { setValue(v: string): void } } };
      save(): void;
    };
    return {
      set: (value: number, note = '') => {
        component.form.controls.value.setValue(value);
        component.form.controls.note.setValue(note);
      },
      save: () => component.save(),
      valid: () => component.form.controls.value.valid,
    };
  }

  it('un carico deve essere di almeno un pezzo', () => {
    const dialog = open('receive');
    dialog.set(0);
    expect(dialog.valid()).toBe(false);
    dialog.set(5);
    expect(dialog.valid()).toBe(true);
  });

  it('la soglia di riordino può essere zero ma non negativa', () => {
    const dialog = open('reorder');
    dialog.set(-1);
    expect(dialog.valid()).toBe(false);
    dialog.set(0);
    expect(dialog.valid()).toBe(true);
  });

  it('una rettifica può essere negativa, ma non zero e richiede il motivo', () => {
    const dialog = open('adjust');
    dialog.set(-3, '');
    dialog.save();
    expect(close).not.toHaveBeenCalled();

    dialog.set(0, 'conteggio');
    dialog.save();
    expect(close).not.toHaveBeenCalled();

    dialog.set(-3, ' rottura ');
    dialog.save();
    expect(close).toHaveBeenCalledWith({ value: -3, note: 'rottura' } satisfies StockDialogResult);
  });

  it('un carico valido si chiude con quantità e nota', () => {
    const dialog = open('receive');
    dialog.set(12, 'bolla 7');
    dialog.save();
    expect(close).toHaveBeenCalledWith({ value: 12, note: 'bolla 7' });
  });
});
