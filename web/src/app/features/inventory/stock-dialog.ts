import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Stock } from '../../core/models';
import { DialogHeader } from '../../shared/dialog-header';

export type StockAction = 'receive' | 'adjust' | 'reorder';

export interface StockDialogData {
  action: StockAction;
  stock: Stock;
}

export interface StockDialogResult {
  value: number;
  note: string;
}

const TEXT: Record<StockAction, { title: string; field: string; hint: string }> = {
  receive: { title: 'Carico merce', field: 'Quantità ricevuta', hint: 'Pezzi entrati in magazzino' },
  adjust: {
    title: 'Rettifica giacenza',
    field: 'Variazione (+/−)',
    hint: 'Positiva per aggiungere, negativa per togliere (inventario, rotture)',
  },
  reorder: { title: 'Soglia di riordino', field: 'Soglia', hint: 'Sotto questo disponibile parte l’avviso di scorta bassa. 0 la disattiva.' },
};

/** Valore minimo ammesso: un carico è almeno 1, la soglia almeno 0, una rettifica può togliere fino a un milione. */
function minimumFor(action: StockAction): number {
  if (action === 'receive') return 1;
  if (action === 'reorder') return 0;
  return -1_000_000;
}

/** Una sola finestra per le tre operazioni sulla giacenza di un prodotto. */
@Component({
  selector: 'app-stock-dialog',
  imports: [DialogHeader, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <app-dialog-header [icon]="icon" [title]="text.title" />
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <p class="muted">
          <strong>{{ data.stock.sku }}</strong> · {{ data.stock.productName }}<br />
          In magazzino {{ data.stock.onHand }} · riservati {{ data.stock.reserved }} · disponibili
          {{ data.stock.available }}
        </p>
        <mat-form-field>
          <mat-label>{{ text.field }}</mat-label>
          <input matInput type="number" step="1" formControlName="value" />
          <mat-hint>{{ text.hint }}</mat-hint>
          <mat-error>Valore non valido</mat-error>
        </mat-form-field>
        @if (data.action !== 'reorder') {
          <mat-form-field>
            <mat-label>{{ data.action === 'adjust' ? 'Motivo (obbligatorio)' : 'Nota (facoltativa)' }}</mat-label>
            <input matInput formControlName="note" maxlength="300" />
            <mat-error>Indica il motivo</mat-error>
          </mat-form-field>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit">Conferma</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: min(420px, 80vw);
    }
  `,
})
export class StockDialog {
  protected readonly data = inject<StockDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<StockDialog, StockDialogResult>>(MatDialogRef);
  protected readonly text = TEXT[this.data.action];
  protected readonly icon = { receive: 'add_box', adjust: 'tune', reorder: 'notifications_active' }[this.data.action];

  protected readonly form = inject(FormBuilder).nonNullable.group({
    value: [
      this.data.action === 'reorder' ? this.data.stock.reorderLevel : 0,
      [Validators.required, Validators.min(minimumFor(this.data.action)), Validators.max(1_000_000)],
    ],
    note: ['', this.data.action === 'adjust' ? [Validators.required, Validators.maxLength(300)] : Validators.maxLength(300)],
  });

  protected save(): void {
    this.form.markAllAsTouched();
    const { value, note } = this.form.getRawValue();
    if (this.form.invalid || !Number.isInteger(Number(value)) || (this.data.action === 'adjust' && Number(value) === 0)) {
      this.form.controls.value.setErrors({ invalid: true });
      return;
    }
    this.ref.close({ value: Number(value), note: note.trim() });
  }
}
