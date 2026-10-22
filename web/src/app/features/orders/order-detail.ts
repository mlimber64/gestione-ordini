import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { OrdersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { NEXT_STEPS, ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from '../../core/labels';
import { Order } from '../../core/models';
import { CancelDialog } from './cancel-dialog';
import { OrderPaymentsPanel } from './order-payments';

type Step = 'confirm' | 'ship' | 'deliver' | 'cancel';

const STEP_LABEL: Record<Step, { text: string; icon: string }> = {
  confirm: { text: 'Conferma', icon: 'check_circle' },
  ship: { text: 'Spedisci', icon: 'local_shipping' },
  deliver: { text: 'Segna come consegnato', icon: 'inventory' },
  cancel: { text: 'Annulla ordine', icon: 'cancel' },
};

@Component({
  selector: 'app-order-detail',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    OrderPaymentsPanel,
  ],
  template: `
    <div class="page">
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      @if (order(); as o) {
        <div class="page-header">
          <a mat-icon-button routerLink="/ordini" aria-label="Torna agli ordini"><mat-icon>arrow_back</mat-icon></a>
          <h1>{{ o.number }}</h1>
          <span class="chip" [class]="cls[o.status]">{{ label[o.status] }}</span>
          @if (auth.canWrite()) {
            @for (step of steps(); track step) {
              <button
                mat-stroked-button
                [class.danger]="step === 'cancel'"
                [disabled]="busy()"
                (click)="run(step)"
              >
                <mat-icon>{{ stepLabel[step].icon }}</mat-icon>{{ stepLabel[step].text }}
              </button>
            }
          }
        </div>

        <div class="summary">
          <div class="card">
            <h2>Cliente</h2>
            <a [routerLink]="['/clienti', o.customerId]">{{ o.customerName }}</a>
            <span class="muted">{{ o.customerCode }}</span>
          </div>
          <div class="card">
            <h2>Spedizione</h2>
            <span>{{ o.shippingAddress.street }}</span>
            <span>{{ o.shippingAddress.postalCode }} {{ o.shippingAddress.city }} ({{ o.shippingAddress.province }})</span>
          </div>
          <div class="card">
            <h2>Creato</h2>
            <span>{{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
            <span class="muted">da {{ o.createdBy }}</span>
          </div>
        </div>
        @if (o.notes) {
          <p class="card notes"><strong>Note:</strong> {{ o.notes }}</p>
        }

        <div class="table-card lines">
          <table mat-table [dataSource]="o.lines">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef>Prodotto</th>
              <td mat-cell *matCellDef="let l">
                <strong>{{ l.sku }}</strong> · {{ l.productName }}
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
              <td mat-cell *matCellDef="let l" class="num">{{ l.unitPrice | currency: 'EUR' }}</td>
              <td mat-footer-cell *matFooterCellDef class="num">Imponibile</td>
            </ng-container>
            <ng-container matColumnDef="net">
              <th mat-header-cell *matHeaderCellDef class="num">Imponibile</th>
              <td mat-cell *matCellDef="let l" class="num">{{ l.lineNet | currency: 'EUR' }}</td>
              <td mat-footer-cell *matFooterCellDef class="num">{{ o.totalNet | currency: 'EUR' }}</td>
            </ng-container>
            <ng-container matColumnDef="vat">
              <th mat-header-cell *matHeaderCellDef class="num">IVA</th>
              <td mat-cell *matCellDef="let l" class="num">{{ l.lineVat | currency: 'EUR' }} ({{ l.vatRate }}%)</td>
              <td mat-footer-cell *matFooterCellDef class="num">{{ o.totalVat | currency: 'EUR' }}</td>
            </ng-container>
            <ng-container matColumnDef="gross">
              <th mat-header-cell *matHeaderCellDef class="num">Totale</th>
              <td mat-cell *matCellDef="let l" class="num">{{ l.lineGross | currency: 'EUR' }}</td>
              <td mat-footer-cell *matFooterCellDef class="num total">{{ o.totalGross | currency: 'EUR' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
            <tr mat-footer-row *matFooterRowDef="columns"></tr>
          </table>
        </div>

        <app-order-payments [orderId]="o.id" [cancelled]="o.status === 'CANCELLED'" />

        <h2 class="section">Storico</h2>
        <ol class="timeline">
          @for (h of o.history; track $index) {
            <li>
              <span class="chip" [class]="cls[h.to]">{{ label[h.to] }}</span>
              <span>{{ h.changedAt | date: 'dd/MM/yyyy HH:mm' }} · {{ h.changedBy }}</span>
              @if (h.reason) {
                <span class="muted">Motivo: {{ h.reason }}</span>
              }
            </li>
          }
        </ol>
      }
    </div>
  `,
  styles: `
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    .summary .card {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    h2 {
      font: var(--mat-sys-title-small);
      margin: 0 0 6px;
      color: var(--mat-sys-on-surface-variant);
    }
    .section {
      margin-top: 24px;
    }
    .notes {
      margin: 0 0 12px;
    }
    .total {
      font: var(--mat-sys-title-small);
    }
    .danger {
      color: var(--mat-sys-error);
    }
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0 0 0 4px;
      border-left: 2px solid var(--mat-sys-outline-variant);
    }
    .timeline li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 12px;
      padding: 6px 0 6px 16px;
    }
  `,
})
export class OrderDetail implements OnInit {
  /** Id nella rotta {@code /ordini/:id}. */
  readonly id = input.required<string>();

  private readonly api = inject(OrdersApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);

  protected readonly order = signal<Order | null>(null);
  protected readonly busy = signal(false);
  protected readonly steps = computed(() => NEXT_STEPS[this.order()?.status ?? 'DELIVERED']);

  protected readonly columns = ['product', 'qty', 'price', 'net', 'vat', 'gross'];
  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly cls = ORDER_STATUS_CLASS;
  protected readonly stepLabel = STEP_LABEL;

  ngOnInit(): void {
    this.busy.set(true);
    this.api.get(this.id()).subscribe({
      next: (order) => this.done(order),
      error: (error: unknown) => this.fail(error),
    });
  }

  protected run(step: Step): void {
    if (step === 'cancel') {
      this.dialog
        .open<CancelDialog, void, string>(CancelDialog)
        .afterClosed()
        .subscribe((reason) => {
          if (reason) this.execute(this.api.cancel(this.id(), reason));
        });
      return;
    }
    const requests: Record<Exclude<Step, 'cancel'>, Observable<Order>> = {
      confirm: this.api.confirm(this.id()),
      ship: this.api.ship(this.id()),
      deliver: this.api.deliver(this.id()),
    };
    this.execute(requests[step]);
  }

  private execute(request: Observable<Order>): void {
    this.busy.set(true);
    request.subscribe({
      next: (order) => {
        this.done(order);
        this.snackBar.open(`Ordine ${order.number}: ${ORDER_STATUS_LABEL[order.status].toLowerCase()}`);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private done(order: Order): void {
    this.order.set(order);
    this.busy.set(false);
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.snackBar.open(errorMessage(error), 'Chiudi', { duration: 8000 });
  }
}
