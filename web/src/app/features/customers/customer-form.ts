import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { CustomersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { Address, AddressInput, Customer, CustomerInput } from '../../core/models';
import { AddressDialog } from './address-dialog';

/** Controllo della cifra di controllo della partita IVA, lo stesso algoritmo del server. */
export function validVatNumber(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let digit = Number(value[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}

@Component({
  selector: 'app-customer-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <a mat-icon-button routerLink="/clienti" aria-label="Torna ai clienti"><mat-icon>arrow_back</mat-icon></a>
        <h1>{{ customer() ? customer()!.name : 'Nuovo cliente' }}</h1>
        @if (customer(); as c) {
          <span class="chip" [class]="c.status === 'ACTIVE' ? 'ok' : 'bad'">{{
            c.status === 'ACTIVE' ? 'Attivo' : 'Bloccato'
          }}</span>
          @if (auth.canWrite() && c.status === 'ACTIVE') {
            <button mat-stroked-button (click)="block()"><mat-icon>block</mat-icon>Blocca</button>
          }
        }
      </div>

      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <form class="card" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">
          <mat-form-field>
            <mat-label>Ragione sociale o nome</mat-label>
            <input matInput formControlName="name" />
            <mat-error>Obbligatorio</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" type="email" />
            <mat-error>Inserisci un indirizzo email valido</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Telefono</mat-label>
            <input matInput formControlName="phone" />
          </mat-form-field>
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
        @if (auth.canWrite()) {
          <div class="actions"><button mat-flat-button type="submit" [disabled]="busy()">Salva</button></div>
        }
      </form>

      @if (customer(); as c) {
        <div class="page-header addresses-head">
          <h1>Indirizzi</h1>
          @if (auth.canWrite()) {
            <button mat-stroked-button (click)="editAddress(null)"><mat-icon>add</mat-icon>Aggiungi</button>
          }
        </div>
        <div class="addresses">
          @for (a of c.addresses; track a.id) {
            <div class="card address">
              <div>
                <span class="chip info">{{ a.type === 'SHIPPING' ? 'Spedizione' : 'Fatturazione' }}</span>
                @if (a.defaultAddress) {
                  <span class="chip ok">Predefinito</span>
                }
              </div>
              <p>
                {{ a.street }}<br />{{ a.postalCode }} {{ a.city }} ({{ a.province }}) · {{ a.country }}
              </p>
              @if (auth.canWrite()) {
                <div class="address-actions">
                  <button mat-button (click)="editAddress(a)">Modifica</button>
                  <button mat-button (click)="removeAddress(a)">Elimina</button>
                </div>
              }
            </div>
          } @empty {
            <p class="empty card">
              Nessun indirizzo. Per creare ordini serve almeno un indirizzo di spedizione.
            </p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .addresses-head {
      margin-top: 24px;
    }
    .addresses {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .address p {
      margin: 8px 0;
    }
    .address .chip {
      margin-right: 6px;
    }
    .address-actions {
      display: flex;
      justify-content: flex-end;
    }
  `,
})
export class CustomerForm implements OnInit {
  /** Id nella rotta {@code /clienti/:id}; assente per un nuovo cliente. */
  readonly id = input<string>();

  private readonly api = inject(CustomersApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly customer = signal<Customer | null>(null);
  protected readonly busy = signal(false);
  protected readonly isNew = computed(() => !this.id());

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    phone: [''],
    vatNumber: ['', (control: { value: string }) => (!control.value || validVatNumber(control.value) ? null : { vat: true })],
    taxCode: ['', Validators.pattern(/^([A-Za-z0-9]{16}|\d{11})?$/)],
  });

  ngOnInit(): void {
    if (!this.auth.canWrite()) this.form.disable();
    const id = this.id();
    if (id) this.load(id);
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    const value = this.form.getRawValue();
    const input: CustomerInput = {
      name: value.name.trim(),
      email: value.email.trim(),
      phone: value.phone.trim() || null,
      vatNumber: value.vatNumber.trim() || null,
      taxCode: value.taxCode.trim().toUpperCase() || null,
    };
    this.busy.set(true);
    const id = this.id();
    const request = id ? this.api.update(id, input) : this.api.create(input);
    request.subscribe({
      next: (saved) => {
        this.busy.set(false);
        this.snackBar.open('Cliente salvato');
        if (id) this.customer.set(saved);
        else void this.router.navigate(['/clienti', saved.id]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected block(): void {
    const c = this.customer();
    if (!c || !confirm(`Bloccare il cliente ${c.name}? Resterà nello storico ma non potrà più fare ordini.`)) return;
    this.api.block(c.id).subscribe({
      next: () => {
        this.snackBar.open('Cliente bloccato');
        this.load(c.id);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected editAddress(address: Address | null): void {
    const c = this.customer();
    if (!c) return;
    this.dialog
      .open<AddressDialog, Address | null, AddressInput>(AddressDialog, { data: address })
      .afterClosed()
      .subscribe((input) => {
        if (!input) return;
        const request = address ? this.api.updateAddress(c.id, address.id, input) : this.api.addAddress(c.id, input);
        request.subscribe({ next: () => this.load(c.id), error: (error: unknown) => this.fail(error) });
      });
  }

  protected removeAddress(address: Address): void {
    const c = this.customer();
    if (!c || !confirm('Eliminare questo indirizzo?')) return;
    this.api.deleteAddress(c.id, address.id).subscribe({
      next: () => this.load(c.id),
      error: (error: unknown) => this.fail(error),
    });
  }

  private load(id: string): void {
    this.busy.set(true);
    this.api.get(id).subscribe({
      next: (customer) => {
        this.customer.set(customer);
        this.form.patchValue({
          name: customer.name,
          email: customer.email,
          phone: customer.phone ?? '',
          vatNumber: customer.vatNumber ?? '',
          taxCode: customer.taxCode ?? '',
        });
        this.busy.set(false);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.snackBar.open(errorMessage(error), 'Chiudi', { duration: 8000 });
  }
}
