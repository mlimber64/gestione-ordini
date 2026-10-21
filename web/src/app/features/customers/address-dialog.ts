import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Address, AddressInput } from '../../core/models';

@Component({
  selector: 'app-address-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data ? 'Modifica indirizzo' : 'Nuovo indirizzo' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-form-field>
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="type">
            <mat-option value="SHIPPING">Spedizione</mat-option>
            <mat-option value="BILLING">Fatturazione</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Via e numero civico</mat-label>
          <input matInput formControlName="street" />
          <mat-error>Obbligatorio</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Città</mat-label>
          <input matInput formControlName="city" />
          <mat-error>Obbligatoria</mat-error>
        </mat-form-field>
        <div class="row">
          <mat-form-field>
            <mat-label>Provincia</mat-label>
            <input matInput formControlName="province" maxlength="2" placeholder="SA" />
            <mat-error>Due lettere</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>CAP</mat-label>
            <input matInput formControlName="postalCode" maxlength="5" inputmode="numeric" />
            <mat-error>Cinque cifre</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Paese</mat-label>
            <input matInput formControlName="country" maxlength="2" />
            <mat-error>Due lettere</mat-error>
          </mat-form-field>
        </div>
        <mat-checkbox formControlName="defaultAddress">Indirizzo predefinito per questo tipo</mat-checkbox>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(480px, 80vw);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
    }
  `,
})
export class AddressDialog {
  protected readonly data = inject<Address | null>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<AddressDialog, AddressInput>>(MatDialogRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    type: [this.data?.type ?? 'SHIPPING', Validators.required],
    street: [this.data?.street ?? '', [Validators.required, Validators.maxLength(200)]],
    city: [this.data?.city ?? '', [Validators.required, Validators.maxLength(100)]],
    province: [this.data?.province ?? '', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    postalCode: [this.data?.postalCode ?? '', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    country: [this.data?.country ?? 'IT', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    defaultAddress: [this.data?.defaultAddress ?? false],
  });

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.ref.close({
      ...value,
      street: value.street.trim(),
      city: value.city.trim(),
      province: value.province.toUpperCase(),
      country: value.country.toUpperCase(),
    });
  }
}
