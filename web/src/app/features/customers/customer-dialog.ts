import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AddressInput, CustomerInput } from '../../core/models';
import { DialogHeader } from '../../shared/dialog-header';
import { validVatNumber } from './customer-form';

export interface CustomerDialogResult {
  customer: CustomerInput;
  /** Indirizzo di spedizione, se lo si è inserito subito: così il cliente può già ricevere ordini. */
  address: AddressInput | null;
}

/** Registrazione di un nuovo cliente, con l'indirizzo di spedizione facoltativo nello stesso passaggio. */
@Component({
  selector: 'app-customer-dialog',
  imports: [DialogHeader, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule],
  template: `
    <app-dialog-header icon="person_add" title="Nuovo cliente" subtitle="Anagrafica e, se vuoi, l'indirizzo di spedizione." />
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-form-field>
          <mat-label>Ragione sociale o nome</mat-label>
          <input matInput formControlName="name" />
          <mat-error>Obbligatorio</mat-error>
        </mat-form-field>
        <div class="row two">
          <mat-form-field>
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email" />
            <mat-error>Inserisci un indirizzo email valido</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Telefono</mat-label>
            <input matInput formControlName="phone" />
          </mat-form-field>
        </div>
        <div class="row two">
          <mat-form-field>
            <mat-label>Partita IVA</mat-label>
            <input matInput formControlName="vatNumber" maxlength="11" inputmode="numeric" />
            <mat-hint>11 cifre, facoltativa</mat-hint>
            <mat-error>Partita IVA non valida (controlla la cifra finale)</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Codice fiscale</mat-label>
            <input matInput formControlName="taxCode" maxlength="16" />
            <mat-error>16 caratteri o 11 cifre</mat-error>
          </mat-form-field>
        </div>

        <mat-checkbox [checked]="withAddress()" (change)="toggleAddress($event.checked)">Aggiungi subito l'indirizzo di spedizione</mat-checkbox>
        @if (withAddress()) {
          <div formGroupName="address" class="address">
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
            <div class="row three">
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
          </div>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit">Registra cliente</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(560px, 82vw);
    }
    .row {
      display: grid;
      gap: 12px;
      align-items: start;
    }
    .row.two {
      grid-template-columns: 1fr 1fr;
    }
    .row.three {
      grid-template-columns: 1fr 1fr 1fr;
    }
    .address {
      display: flex;
      flex-direction: column;
      margin-top: 8px;
    }
    @media (max-width: 600px) {
      .row.two {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CustomerDialog {
  private readonly ref = inject<MatDialogRef<CustomerDialog, CustomerDialogResult>>(MatDialogRef);

  protected readonly withAddress = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    phone: [''],
    vatNumber: ['', (control: { value: string }) => (!control.value || validVatNumber(control.value) ? null : { vat: true })],
    taxCode: ['', Validators.pattern(/^([A-Za-z0-9]{16}|\d{11})?$/)],
    address: inject(FormBuilder).nonNullable.group({
      street: ['', [Validators.required, Validators.maxLength(200)]],
      city: ['', [Validators.required, Validators.maxLength(100)]],
      province: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
      postalCode: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      country: ['IT', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    }),
  });

  constructor() {
    // L'indirizzo è facoltativo: finché non lo si vuole, i suoi campi non devono impedire di salvare
    this.form.controls.address.disable();
  }

  protected toggleAddress(checked: boolean): void {
    this.withAddress.set(checked);
    if (checked) this.form.controls.address.enable();
    else this.form.controls.address.disable();
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const address = this.withAddress()
      ? {
          type: 'SHIPPING' as const,
          street: value.address.street.trim(),
          city: value.address.city.trim(),
          province: value.address.province.toUpperCase(),
          postalCode: value.address.postalCode,
          country: value.address.country.toUpperCase(),
          defaultAddress: true,
        }
      : null;
    this.ref.close({
      customer: {
        name: value.name.trim(),
        email: value.email.trim(),
        phone: value.phone.trim() || null,
        vatNumber: value.vatNumber.trim() || null,
        taxCode: value.taxCode.trim().toUpperCase() || null,
      },
      address,
    });
  }
}
