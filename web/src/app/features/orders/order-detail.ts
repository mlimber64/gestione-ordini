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
import { Order, OrderStatus } from '../../core/models';
import { CancelDialog } from './cancel-dialog';
import { OrderPaymentsPanel } from './order-payments';

type Step = 'confirm' | 'ship' | 'deliver' | 'cancel';

const STEP_LABEL: Record<Step, { text: string; icon: string }> = {
  confirm: { text: 'Conferma', icon: 'check_circle' },
  ship: { text: 'Spedisci', icon: 'local_shipping' },
  deliver: { text: 'Segna come consegnato', icon: 'inventory' },
  cancel: { text: 'Annulla ordine', icon: 'cancel' },
};

/** Le tappe del percorso normale di un ordine, nell'ordine in cui avvengono. */
const JOURNEY: { status: OrderStatus; icon: string }[] = [
  { status: 'PENDING', icon: 'hourglass_top' },
  { status: 'CONFIRMED', icon: 'task_alt' },
  { status: 'SHIPPED', icon: 'local_shipping' },
  { status: 'DELIVERED', icon: 'inventory' },
];

export interface JourneyStep {
  status: OrderStatus;
  icon: string;
  state: 'done' | 'current' | 'todo';
  at: string | null;
}

/** Stato di ogni tappa: fatta (con la data), in corso o ancora da fare. Un ordine annullato non ha percorso. */
export function journeyOf(order: Pick<Order, 'status' | 'history'>): JourneyStep[] {
  if (order.status === 'CANCELLED') return [];
  return JOURNEY.map(({ status, icon }) => ({
    status,
    icon,
    state: status === order.status ? 'current' : order.history.some((h) => h.to === status) ? 'done' : 'todo',
    at: order.history.find((h) => h.to === status)?.changedAt ?? null,
  }));
}

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
          <span class="spacer"></span>
          @if (auth.canWrite()) {
            @for (step of steps(); track step) {
              <button
                [class.danger]="step === 'cancel'"
                class="step"
                [class.primary]="step !== 'cancel'"
                [disabled]="busy()"
                (click)="run(step)"
              >
                <mat-icon>{{ stepLabel[step].icon }}</mat-icon>{{ stepLabel[step].text }}
              </button>
            }
          }
        </div>

        @if (o.status === 'CANCELLED') {
          <div class="banner" role="status">
            <mat-icon>block</mat-icon>
            <span>
              <strong>Ordine annullato</strong>
              @if (cancellation(); as c) {
                <small>il {{ c.changedAt | date: 'dd/MM/yyyy HH:mm' }} da {{ c.changedBy }}@if (c.reason) { · Motivo: {{ c.reason }} }</small>
              }
            </span>
          </div>
        } @else {
          <ol class="journey" aria-label="Avanzamento dell'ordine">
            @for (s of journey(); track s.status) {
              <li [class]="s.state">
                <span class="node"><mat-icon>{{ s.state === 'done' ? 'check' : s.icon }}</mat-icon></span>
                <span class="j-text">
                  <strong>{{ label[s.status] }}</strong>
                  <small class="muted">{{ s.at ? (s.at | date: 'dd/MM HH:mm') : '' }}</small>
                </span>
              </li>
            }
          </ol>
        }

        <section class="card facts" aria-label="Dati dell'ordine">
          <div class="info-item">
            <span class="info-icon"><mat-icon>person</mat-icon></span>
            <div>
              <span class="info-label">Cliente</span>
              <a [routerLink]="['/clienti', o.customerId]">{{ o.customerName }}</a>
              <span class="muted">{{ o.customerCode }}</span>
            </div>
          </div>
          <div class="info-item">
            <span class="info-icon"><mat-icon>local_shipping</mat-icon></span>
            <div>
              <span class="info-label">Spedizione</span>
              <span>{{ o.shippingAddress.street }}</span>
              <span class="muted">{{ o.shippingAddress.postalCode }} {{ o.shippingAddress.city }} ({{ o.shippingAddress.province }})</span>
            </div>
          </div>
          <div class="info-item">
            <span class="info-icon"><mat-icon>event</mat-icon></span>
            <div>
              <span class="info-label">Creato</span>
              <span>{{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
              <span class="muted">da {{ o.createdBy }}</span>
            </div>
          </div>
        </section>
        @if (o.notes) {
          <p class="card notes"><mat-icon>sticky_note_2</mat-icon><span><strong>Note:</strong> {{ o.notes }}</span></p>
        }

        <div class="table-card lines">
          <table mat-table [dataSource]="o.lines">
            <ng-container matColumnDef="product">
              <th mat-header-cell *matHeaderCellDef>Prodotto</th>
              <td mat-cell *matCellDef="let l">
                <span class="stack">
                  <strong>{{ l.productName }}</strong>
                  <small class="muted">{{ l.sku }}</small>
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="qty">
              <th mat-header-cell *matHeaderCellDef class="num">Qtà</th>
              <td mat-cell *matCellDef="let l" class="num">{{ l.quantity }}</td>
            </ng-container>
            <ng-container matColumnDef="price">
              <th mat-header-cell *matHeaderCellDef class="num">Prezzo</th>
              <td mat-cell *matCellDef="let l" class="num">{{ l.unitPrice | currency: 'EUR' }}</td>
            </ng-container>
            <ng-container matColumnDef="net">
              <th mat-header-cell *matHeaderCellDef class="num">Imponibile</th>
              <td mat-cell *matCellDef="let l" class="num">{{ l.lineNet | currency: 'EUR' }}</td>
            </ng-container>
            <ng-container matColumnDef="vat">
              <th mat-header-cell *matHeaderCellDef class="num">IVA</th>
              <td mat-cell *matCellDef="let l" class="num muted">{{ l.lineVat | currency: 'EUR' }} ({{ l.vatRate }}%)</td>
            </ng-container>
            <ng-container matColumnDef="gross">
              <th mat-header-cell *matHeaderCellDef class="num">Totale</th>
              <td mat-cell *matCellDef="let l" class="num"><strong>{{ l.lineGross | currency: 'EUR' }}</strong></td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
          <dl class="totals">
            <div>
              <dt>Imponibile</dt>
              <dd>{{ o.totalNet | currency: 'EUR' }}</dd>
            </div>
            <div>
              <dt>IVA</dt>
              <dd>{{ o.totalVat | currency: 'EUR' }}</dd>
            </div>
            <div class="grand">
              <dt>Totale</dt>
              <dd>{{ o.totalGross | currency: 'EUR' }}</dd>
            </div>
          </dl>
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
    .page-header h1 {
      flex: 0 1 auto;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .step {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 16px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 10px;
      background: transparent;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
    .step:hover:not(:disabled) {
      background: var(--app-surface-sunken);
    }
    .step.primary {
      border-color: transparent;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }
    .step.primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--mat-sys-primary) 88%, black);
    }
    .step.danger {
      border-color: var(--mat-sys-error);
      color: var(--mat-sys-error);
    }
    .step:disabled {
      opacity: 0.5;
      cursor: default;
    }
    .step mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .banner {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 16px;
      padding: 14px 18px;
      border-radius: var(--app-radius);
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
    }
    .banner span {
      display: flex;
      flex-direction: column;
    }

    /* Percorso: tappe collegate da una linea, fatte in verde e quella in corso evidenziata */
    .journey {
      display: flex;
      list-style: none;
      margin: 0 0 16px;
      padding: 18px 20px;
      background: var(--app-surface);
      border: 1px solid var(--app-border);
      border-radius: var(--app-radius);
      box-shadow: var(--app-shadow);
      overflow-x: auto;
    }
    .journey li {
      position: relative;
      display: flex;
      flex: 1 1 0;
      align-items: center;
      gap: 12px;
      min-width: 150px;
    }
    .journey li:not(:last-child)::after {
      content: '';
      flex: 1;
      height: 2px;
      margin: 0 12px;
      background: var(--mat-sys-outline-variant);
    }
    .journey li.done:not(:last-child)::after {
      background: var(--app-ok-solid);
    }
    .node {
      display: grid;
      place-items: center;
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 2px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-on-surface-variant);
    }
    .node mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .done .node {
      border-color: var(--app-ok-solid);
      background: var(--app-ok-solid);
      color: #fff;
    }
    .current .node {
      border-color: var(--mat-sys-primary);
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .j-text {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
      white-space: nowrap;
    }
    .todo .j-text strong {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 500;
    }

    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px 24px;
      margin-bottom: 16px;
    }
    .info-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }
    .info-item > div {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .info-icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface-variant);
    }
    .info-label {
      font: var(--mat-sys-label-medium);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--mat-sys-on-surface-variant);
    }
    .notes {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0 0 16px;
    }
    .notes mat-icon {
      color: var(--mat-sys-on-surface-variant);
    }

    .lines {
      margin-bottom: 8px;
    }
    .totals {
      display: grid;
      gap: 6px;
      width: min(320px, 100%);
      margin: 0 0 0 auto;
      padding: 16px 20px 18px;
      border-top: 1px solid var(--app-border);
    }
    .totals div {
      display: flex;
      justify-content: space-between;
      gap: 24px;
    }
    .totals dt {
      color: var(--mat-sys-on-surface-variant);
    }
    .totals dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .totals .grand {
      margin-top: 4px;
      padding-top: 10px;
      border-top: 1px solid var(--app-border);
      font: var(--mat-sys-title-medium);
      font-weight: 600;
    }
    .totals .grand dt {
      color: var(--mat-sys-on-surface);
    }

    .section {
      margin: 28px 0 10px;
      font: var(--mat-sys-title-small);
      font-weight: 600;
    }
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0 0 0 10px;
      border-left: 2px solid var(--mat-sys-outline-variant);
    }
    .timeline li {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 12px;
      padding: 8px 0 8px 22px;
    }
    .timeline li::before {
      content: '';
      position: absolute;
      left: -17px;
      top: 50%;
      width: 12px;
      height: 12px;
      margin-top: -6px;
      border-radius: 50%;
      border: 2px solid var(--mat-sys-primary);
      background: var(--app-canvas);
    }
    @media (max-width: 700px) {
      .journey {
        padding: 14px;
      }
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
  protected readonly journey = computed(() => {
    const order = this.order();
    return order ? journeyOf(order) : [];
  });
  protected readonly cancellation = computed(() => this.order()?.history.find((h) => h.to === 'CANCELLED') ?? null);

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
