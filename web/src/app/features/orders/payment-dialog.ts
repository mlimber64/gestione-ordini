import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PAYMENT_METHOD_LABEL } from '../../core/labels';
import { PaymentInput, PaymentMethod } from '../../core/models';

export interface PaymentDialogData {
  /** Importo che si può ancora registrare: l'ordine non può essere pagato più del suo totale. */
  registrable: number;
}

/** Al massimo due decimali: i centesimi sono l'unità più piccola. */
function twoDecimals(control: AbstractControl): ValidationErrors | null {
  const value = control.value as number | null;
  if (value === null || !Number.isFinite(value)) return null;
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-6 ? null : { decimals: true };
}

/** Registra un pagamento di un ordine: nasce «in attesa» e poi si incassa o si segna come non riuscito. */
@Component({
  selector: 'app-payment-dialog',
  imports: [CurrencyPipe, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Registra pagamento</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <p class="muted">Ancora da registrare: {{ data.registrable | currency: 'EUR' }}</p>
        <mat-form-field>
          <mat-label>Metodo</mat-label>
          <mat-select formControlName="method">
            @for (m of methods; track m) {
              <mat-option [value]="m">{{ label[m] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Importo (€)</mat-label>
          <input matInput type="number" step="0.01" min="0.01" formControlName="amount" />
          @if (form.controls.amount.hasError('max')) {
            <mat-error>Non può superare {{ data.registrable | currency: 'EUR' }}</mat-error>
          } @else if (form.controls.amount.hasError('decimals')) {
            <mat-error>Al massimo due decimali</mat-error>
          } @else {
            <mat-error>Indica un importo maggiore di zero</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Riferimento (facoltativo)</mat-label>
          <input matInput formControlName="reference" maxlength="100" />
          <mat-hint>Per esempio il CRO del bonifico o il codice della transazione</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit">Registra</button>
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
export class PaymentDialog {
  protected readonly data = inject<PaymentDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<PaymentDialog, PaymentInput>>(MatDialogRef);

  protected readonly methods: PaymentMethod[] = ['BANK_TRANSFER', 'CARD', 'CASH_ON_DELIVERY'];
  protected readonly label = PAYMENT_METHOD_LABEL;

  protected readonly form = inject(FormBuilder).nonNullable.group({
    method: ['BANK_TRANSFER' as PaymentMethod],
    amount: [
      this.data.registrable,
      [Validators.required, Validators.min(0.01), Validators.max(this.data.registrable), twoDecimals],
    ],
    reference: ['', Validators.maxLength(100)],
  });

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { method, amount, reference } = this.form.getRawValue();
    this.ref.close({ method, amount: Number(amount), reference: reference.trim() || null });
  }
}
