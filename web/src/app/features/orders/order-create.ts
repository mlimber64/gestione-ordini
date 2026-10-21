import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { CatalogApi, CustomersApi, OrdersApi } from '../../core/api';
import { errorMessage } from '../../core/errors';
import { Customer, CustomerSummary, Product } from '../../core/models';

interface Line {
  product: Product;
  quantity: number;
}

/** Alla creazione l'ordine riserva la merce: se manca giacenza il server risponde con il dettaglio e non salva nulla. */
@Component({
  selector: 'app-order-create',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <a mat-icon-button routerLink="/ordini" aria-label="Torna agli ordini"><mat-icon>arrow_back</mat-icon></a>
        <h1>Nuovo ordine</h1>
      </div>
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <section class="card block">
        <h2>1. Cliente</h2>
        <mat-form-field>
          <mat-label>Cerca il cliente per nome, codice o email</mat-label>
          <input matInput [formControl]="customerSearch" [matAutocomplete]="customerAuto" />
          <mat-autocomplete #customerAuto="matAutocomplete" [displayWith]="customerName" (optionSelected)="pickCustomer($event.option.value)">
            @for (c of customerOptions(); track c.id) {
              <mat-option [value]="c" [disabled]="c.status !== 'ACTIVE'">
                {{ c.name }} <span class="muted">· {{ c.code }}{{ c.status !== 'ACTIVE' ? ' · bloccato' : '' }}</span>
              </mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        @if (customer(); as c) {
          @if (shippingAddresses().length) {
            <mat-form-field>
              <mat-label>Indirizzo di spedizione</mat-label>
              <mat-select [formControl]="addressId">
                @for (a of shippingAddresses(); track a.id) {
                  <mat-option [value]="a.id">
                    {{ a.street }}, {{ a.postalCode }} {{ a.city }} ({{ a.province }}){{ a.defaultAddress ? ' · predefinito' : '' }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
          } @else {
            <p class="warning">
              {{ c.name }} non ha indirizzi di spedizione.
              <a [routerLink]="['/clienti', c.id]">Aggiungine uno</a> prima di creare l'ordine.
            </p>
          }
        }
      </section>

      <section class="card block">
        <h2>2. Prodotti</h2>
        <div class="add-line">
          <mat-form-field class="grow">
            <mat-label>Cerca il prodotto per nome o SKU</mat-label>
            <input matInput [formControl]="productSearch" [matAutocomplete]="productAuto" />
            <mat-autocomplete #productAuto="matAutocomplete" [displayWith]="productLabel">
              @for (p of productOptions(); track p.id) {
                <mat-option [value]="p">
                  <strong>{{ p.sku }}</strong> {{ p.name }}
                  <span class="muted">· {{ p.unitPrice | currency: 'EUR' }}</span>
                </mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <mat-form-field class="qty">
            <mat-label>Quantità</mat-label>
            <input matInput type="number" min="1" step="1" [formControl]="quantity" />
          </mat-form-field>
          <button mat-stroked-button type="button" (click)="addLine()" [disabled]="!canAdd()">
            <mat-icon>add</mat-icon>Aggiungi
          </button>
        </div>

        @if (lines().length) {
          <div class="table-card">
            <table mat-table [dataSource]="lines()">
              <ng-container matColumnDef="product">
                <th mat-header-cell *matHeaderCellDef>Prodotto</th>
                <td mat-cell *matCellDef="let l">
                  <strong>{{ l.product.sku }}</strong> · {{ l.product.name }}
                </td>
                <td mat-footer-cell *matFooterCellDef></td>
              </ng-container>
              <ng-container matColumnDef="qty">
                <th mat-header-cell *matHeaderCellDef class="num">Qtà</th>
                <td mat-cell *matCellDef="let l" class="num">{{ l.quantity }}</td>
                <td mat-footer-cell *matFooterCellDef></td>
              </ng-container>
              <ng-container matColumnDef="price">
                <th mat-header-cell *matHeaderCellDef class="num">Prezzo</th>
                <td mat-cell *matCellDef="let l" class="num">{{ l.product.unitPrice | currency: 'EUR' }}</td>
                <td mat-footer-cell *matFooterCellDef class="num">Totale stimato</td>
              </ng-container>
              <ng-container matColumnDef="total">
                <th mat-header-cell *matHeaderCellDef class="num">Totale con IVA</th>
                <td mat-cell *matCellDef="let l" class="num">{{ lineGross(l) | currency: 'EUR' }}</td>
                <td mat-footer-cell *matFooterCellDef class="num">
                  <strong>{{ total() | currency: 'EUR' }}</strong>
                </td>
              </ng-container>
              <ng-container matColumnDef="remove">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let l">
                  <button mat-icon-button type="button" (click)="removeLine(l)" aria-label="Rimuovi la riga">
                    <mat-icon>close</mat-icon>
                  </button>
                </td>
                <td mat-footer-cell *matFooterCellDef></td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
              <tr mat-footer-row *matFooterRowDef="columns"></tr>
            </table>
          </div>
        } @else {
          <p class="empty">Nessun prodotto aggiunto.</p>
        }
      </section>

      <section class="card block">
        <h2>3. Note</h2>
        <mat-form-field>
          <mat-label>Note (facoltative)</mat-label>
          <textarea matInput [formControl]="notes" rows="2" maxlength="500"></textarea>
        </mat-form-field>
      </section>

      <div class="submit">
        <a mat-button routerLink="/ordini">Annulla</a>
        <button mat-flat-button (click)="submit()" [disabled]="!canSubmit() || busy()">Crea ordine e riserva la merce</button>
      </div>
    </div>
  `,
  styles: `
    .block {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
    }
    h2 {
      font: var(--mat-sys-title-small);
      margin: 0 0 8px;
    }
    .add-line {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
    }
    .grow {
      flex: 1 1 280px;
    }
    .qty {
      width: 120px;
    }
    .submit {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .warning {
      color: #7a4a00;
      background: #fff1d6;
      padding: 8px 12px;
      border-radius: 6px;
      margin: 0;
    }
  `,
})
export class OrderCreate {
  private readonly customersApi = inject(CustomersApi);
  private readonly catalog = inject(CatalogApi);
  private readonly orders = inject(OrdersApi);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly columns = ['product', 'qty', 'price', 'total', 'remove'];
  protected readonly customerSearch = new FormControl<string | CustomerSummary>('', { nonNullable: true });
  protected readonly productSearch = new FormControl<string | Product>('', { nonNullable: true });
  protected readonly quantity = new FormControl(1, { nonNullable: true, validators: [Validators.min(1), Validators.max(10000)] });
  protected readonly addressId = new FormControl<string | null>(null);
  protected readonly notes = new FormControl('', { nonNullable: true });

  protected readonly customer = signal<Customer | null>(null);
  protected readonly lines = signal<Line[]>([]);
  protected readonly busy = signal(false);

  protected readonly shippingAddresses = computed(
    () => this.customer()?.addresses.filter((address) => address.type === 'SHIPPING') ?? [],
  );

  protected readonly total = computed(() =>
    this.lines().reduce((sum, line) => sum + this.lineGross(line), 0),
  );

  protected readonly canSubmit = computed(
    () => !!this.customer() && this.shippingAddresses().length > 0 && this.lines().length > 0,
  );

  protected readonly customerOptions = toSignal(
    this.customerSearch.valueChanges.pipe(
      filter((value): value is string => typeof value === 'string'),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) =>
        q.trim().length < 2
          ? of<CustomerSummary[]>([])
          : this.customersApi.search(q.trim(), '', { page: 0, size: 8 }).pipe(map((page) => page.content)),
      ),
    ),
    { initialValue: [] as CustomerSummary[] },
  );

  protected readonly productOptions = toSignal(
    this.productSearch.valueChanges.pipe(
      filter((value): value is string => typeof value === 'string'),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) =>
        q.trim().length < 2
          ? of<Product[]>([])
          : this.catalog.products(q.trim(), '', true, { page: 0, size: 8 }).pipe(map((page) => page.content)),
      ),
    ),
    { initialValue: [] as Product[] },
  );

  protected customerName = (value: CustomerSummary | string | null): string =>
    typeof value === 'string' ? value : (value?.name ?? '');

  protected productLabel = (value: Product | string | null): string => {
    if (typeof value === 'string') return value;
    return value ? `${value.sku} · ${value.name}` : '';
  };

  protected lineGross(line: Line): number {
    const net = Math.round(line.product.unitPrice * line.quantity * 100) / 100;
    return net + Math.round(net * line.product.vatRate) / 100;
  }

  protected pickCustomer(summary: CustomerSummary): void {
    this.customersApi.get(summary.id).subscribe({
      next: (customer) => {
        this.customer.set(customer);
        const shipping = customer.addresses.filter((address) => address.type === 'SHIPPING');
        this.addressId.setValue((shipping.find((address) => address.defaultAddress) ?? shipping[0])?.id ?? null);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected canAdd(): boolean {
    const product = this.productSearch.value;
    return typeof product !== 'string' && this.quantity.valid && Number.isInteger(this.quantity.value);
  }

  protected addLine(): void {
    const product = this.productSearch.value;
    if (typeof product === 'string' || !this.canAdd()) return;
    const quantity = this.quantity.value;
    this.lines.update((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      return existing
        ? current.map((line) => (line === existing ? { ...line, quantity: line.quantity + quantity } : line))
        : [...current, { product, quantity }];
    });
    this.productSearch.setValue('');
    this.quantity.setValue(1);
  }

  protected removeLine(line: Line): void {
    this.lines.update((current) => current.filter((l) => l !== line));
  }

  protected submit(): void {
    const customer = this.customer();
    if (!customer || !this.canSubmit()) return;
    this.busy.set(true);
    this.orders
      .place({
        customerId: customer.id,
        shippingAddressId: this.addressId.value,
        notes: this.notes.value.trim() || null,
        items: this.lines().map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      })
      .subscribe({
        next: (order) => {
          this.snackBar.open(`Ordine ${order.number} creato`);
          void this.router.navigate(['/ordini', order.id]);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.snackBar.open(errorMessage(error), 'Chiudi', { duration: 8000 });
  }
}
