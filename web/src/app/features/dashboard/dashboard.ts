import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { InventoryApi, OrdersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { eventLook, relativeTime } from '../../core/format';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from '../../core/labels';
import { OrderStatus, OrderSummary, Stock } from '../../core/models';
import { NotificationService } from '../../core/notification.service';

const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const STATUS_ICON: Record<OrderStatus, string> = {
  PENDING: 'hourglass_top',
  CONFIRMED: 'task_alt',
  SHIPPED: 'local_shipping',
  DELIVERED: 'inventory',
  CANCELLED: 'block',
};

/** Il cerchio dell'anello ha circonferenza 100 (r = 100 / 2π): le lunghezze dei tratti sono percentuali. */
const RING_RADIUS = 100 / (2 * Math.PI);

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, MatIconModule, MatButtonModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Cruscotto</h1>
          <p class="page-sub">{{ today | date: 'EEEE d MMMM y' }}</p>
        </div>
        @if (auth.canWrite()) {
          <a mat-flat-button routerLink="/ordini/nuovo"><mat-icon>add</mat-icon>Nuovo ordine</a>
        }
      </div>

      @if (!loading() && (counts()['PENDING'] || lowTotal())) {
        <section class="attention" aria-label="Da gestire">
          @if (counts()['PENDING']) {
            <a class="alert warn" routerLink="/ordini" [queryParams]="{ stato: 'PENDING' }">
              <mat-icon>hourglass_top</mat-icon>
              <span>
                <strong>Da confermare: {{ counts()['PENDING'] }}</strong>
                <small>Hanno la merce riservata ma aspettano la conferma</small>
              </span>
              <mat-icon class="go">arrow_forward</mat-icon>
            </a>
          }
          @if (lowTotal()) {
            <a class="alert bad" routerLink="/magazzino">
              <mat-icon>warning</mat-icon>
              <span>
                <strong>Sotto scorta: {{ lowTotal() }}</strong>
                <small>Prodotti al di sotto della soglia di riordino</small>
              </span>
              <mat-icon class="go">arrow_forward</mat-icon>
            </a>
          }
        </section>
      }

      <section class="kpis" aria-label="Stato degli ordini">
        @for (s of statuses; track s) {
          <a class="card kpi" [class]="cls[s]" routerLink="/ordini" [queryParams]="{ stato: s }">
            <span class="kpi-head">
              <span class="kpi-icon"><mat-icon>{{ icon[s] }}</mat-icon></span>
              <span class="kpi-label">{{ label[s] }}</span>
            </span>
            @if (loading()) {
              <span class="skeleton kpi-skeleton"></span>
            } @else {
              <span class="kpi-value">{{ counts()[s] ?? 0 }}</span>
              <span class="kpi-share">
                <span class="bar"><span class="fill" [style.width.%]="share(s)"></span></span>
                <small>{{ share(s) }}%</small>
              </span>
            }
          </a>
        }
      </section>

      <div class="columns">
        <section class="card recent">
          <h2 class="card-title">
            Ultimi ordini
            <a class="more" routerLink="/ordini">Vedi tutti</a>
          </h2>
          @if (loading()) {
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <span class="skeleton row-skeleton"></span>
            }
          }
          @for (o of recent(); track o.id) {
            <a class="row" [routerLink]="['/ordini', o.id]">
              <span class="who">
                <strong>{{ o.number }}</strong>
                <small class="muted">{{ o.customerName }}</small>
              </span>
              <span class="right">
                <span class="amount">{{ o.totalGross | currency: 'EUR' }}</span>
                <span class="chip" [class]="cls[o.status]">{{ label[o.status] }}</span>
              </span>
            </a>
          } @empty {
            @if (!loading()) {
              <p class="empty">Nessun ordine ancora.</p>
            }
          }
        </section>

        <div class="side">
          <section class="card">
            <h2 class="card-title">Ordini per stato</h2>
            <div class="ring-wrap">
              <svg class="ring" viewBox="0 0 42 42" role="img" [attr.aria-label]="'Totale ' + total() + ' ordini'">
                <circle class="track" cx="21" cy="21" [attr.r]="radius" />
                @for (seg of segments(); track seg.status) {
                  <circle
                    class="seg"
                    [class]="cls[seg.status]"
                    cx="21"
                    cy="21"
                    [attr.r]="radius"
                    [attr.stroke-dasharray]="seg.length + ' ' + (100 - seg.length)"
                    [attr.stroke-dashoffset]="25 - seg.offset"
                  />
                }
                <text x="21" y="20.5" class="ring-total">{{ total() }}</text>
                <text x="21" y="26" class="ring-caption">totale</text>
              </svg>
              <ul class="legend">
                @for (s of statuses; track s) {
                  <li>
                    <span class="swatch" [class]="cls[s]"></span>
                    <span>{{ label[s] }}</span>
                    <strong>{{ counts()[s] ?? 0 }}</strong>
                  </li>
                }
              </ul>
            </div>
          </section>

          <section class="card">
            <h2 class="card-title">
              Scorte basse
              <a class="more" routerLink="/magazzino">Magazzino</a>
            </h2>
            @for (s of low(); track s.productId) {
              <div class="stock">
                <span class="who">
                  <strong>{{ s.sku }}</strong>
                  <small class="muted">{{ s.productName }}</small>
                </span>
                <span class="stock-level">
                  <span class="bar warn"><span class="fill" [style.width.%]="level(s)"></span></span>
                  <small>{{ s.available }} / {{ s.reorderLevel }}</small>
                </span>
              </div>
            } @empty {
              @if (!loading()) {
                <p class="empty small">Tutte le scorte sono sopra soglia.</p>
              }
            }
          </section>
        </div>

        <section class="card wide">
          <h2 class="card-title">
            Attività in diretta
            <a class="more" routerLink="/notifiche">Tutte le notifiche</a>
          </h2>
          <ol class="timeline">
            @for (n of notifications.items().slice(0, 6); track n.id) {
              <li>
                <span class="t-icon" [class]="look(n).tone"><mat-icon>{{ look(n).icon }}</mat-icon></span>
                <span class="t-text">
                  <strong>{{ n.title }}</strong>
                  <small class="muted">{{ n.message }}</small>
                </span>
                <time class="t-time muted" [attr.datetime]="n.receivedAt">{{ ago(n.receivedAt) }}</time>
              </li>
            } @empty {
              <li class="empty small">Le novità compariranno qui appena accadono.</li>
            }
          </ol>
        </section>
      </div>
    </div>
  `,
  styles: `
    mat-icon {
      flex: none;
    }
    .attention {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .alert {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: var(--app-radius);
      text-decoration: none;
      color: inherit;
      border: 1px solid transparent;
    }
    .alert > span {
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .alert small {
      opacity: 0.85;
    }
    .alert.warn {
      background: var(--app-warn-bg);
      color: var(--app-warn-fg);
    }
    .alert.bad {
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
    }
    .alert .go {
      opacity: 0.6;
      transition: transform 0.15s ease;
    }
    .alert:hover .go {
      transform: translateX(3px);
      opacity: 1;
    }

    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: 6px;
      color: inherit;
      text-decoration: none;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }
    .kpi:hover {
      border-color: var(--mat-sys-primary);
      box-shadow: var(--app-shadow-lg);
    }
    .kpi-head {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .kpi-icon {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--mat-sys-surface-container-high);
    }
    .kpi-icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .kpi.ok .kpi-icon {
      background: var(--app-ok-bg);
      color: var(--app-ok-fg);
    }
    .kpi.warn .kpi-icon {
      background: var(--app-warn-bg);
      color: var(--app-warn-fg);
    }
    .kpi.bad .kpi-icon {
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
    }
    .kpi.info .kpi-icon {
      background: var(--app-info-bg);
      color: var(--app-info-fg);
    }
    .kpi-label {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
    }
    .kpi-value {
      font: var(--mat-sys-headline-large);
      font-weight: 600;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .kpi-skeleton {
      height: 34px;
      width: 60%;
    }
    .kpi-share {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--mat-sys-on-surface-variant);
    }
    .bar {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--mat-sys-surface-container-high);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      border-radius: 3px;
      background: var(--mat-sys-primary);
      transition: width 0.4s ease;
    }
    .kpi.ok .fill {
      background: var(--app-ok-solid);
    }
    .kpi.warn .fill,
    .bar.warn .fill {
      background: var(--app-warn-solid);
    }
    .kpi.bad .fill {
      background: var(--app-bad-solid);
    }
    .kpi.info .fill {
      background: var(--app-info-solid);
    }

    .columns {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: 16px;
      align-items: start;
    }
    .side {
      display: grid;
      gap: 16px;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .more {
      font: var(--mat-sys-label-large);
      font-weight: 500;
      text-decoration: none;
    }
    .more:hover {
      text-decoration: underline;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 11px 8px;
      margin: 0 -8px;
      border-radius: var(--app-radius-sm);
      color: inherit;
      text-decoration: none;
    }
    .row:hover {
      background: var(--app-surface-sunken);
    }
    .row + .row {
      border-top: 1px solid var(--app-border);
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
    .who {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .who small {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .right {
      display: flex;
      align-items: center;
      gap: 14px;
      white-space: nowrap;
    }
    .amount {
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }
    .row-skeleton {
      height: 38px;
      margin: 8px 0;
    }

    .ring-wrap {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .ring {
      width: 150px;
      height: 150px;
      flex: none;
    }
    .ring circle {
      fill: none;
      stroke-width: 5;
    }
    .ring .track {
      stroke: var(--mat-sys-surface-container-high);
    }
    .ring .seg {
      stroke: var(--mat-sys-primary);
    }
    .ring .seg.ok {
      stroke: var(--app-ok-fg);
    }
    .ring .seg.warn {
      stroke: var(--app-warn-fg);
    }
    .ring .seg.bad {
      stroke: var(--app-bad-fg);
    }
    .ring .seg.info {
      stroke: var(--app-info-fg);
    }
    .ring text {
      text-anchor: middle;
      fill: var(--mat-sys-on-surface);
    }
    .ring-total {
      font-size: 8px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .ring-caption {
      font-size: 2.6px;
      fill: var(--mat-sys-on-surface-variant) !important;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .legend {
      flex: 1;
      min-width: 150px;
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .legend li {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .legend strong {
      margin-left: auto;
      font-variant-numeric: tabular-nums;
    }
    .swatch {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      background: var(--mat-sys-primary);
    }
    .swatch.ok {
      background: var(--app-ok-fg);
    }
    .swatch.warn {
      background: var(--app-warn-fg);
    }
    .swatch.bad {
      background: var(--app-bad-fg);
    }
    .swatch.info {
      background: var(--app-info-fg);
    }

    .stock {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 10px 0;
    }
    .stock + .stock {
      border-top: 1px solid var(--app-border);
    }
    .stock-level {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 150px;
      flex: none;
    }
    .stock-level small {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .empty.small {
      padding: 20px 8px;
    }

    .timeline {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .timeline li {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 12px 0;
    }
    .timeline li + li {
      border-top: 1px solid var(--app-border);
    }
    .t-icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 34px;
      height: 34px;
      border-radius: 50%;
    }
    .t-icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .t-icon.ok {
      background: var(--app-ok-bg);
      color: var(--app-ok-fg);
    }
    .t-icon.warn {
      background: var(--app-warn-bg);
      color: var(--app-warn-fg);
    }
    .t-icon.bad {
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
    }
    .t-icon.info {
      background: var(--app-info-bg);
      color: var(--app-info-fg);
    }
    .t-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }
    .t-time {
      white-space: nowrap;
      font: var(--mat-sys-label-medium);
    }

    @media (max-width: 1000px) {
      .columns {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly orders = inject(OrdersApi);
  private readonly inventory = inject(InventoryApi);
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);

  protected readonly today = new Date();
  protected readonly statuses = STATUSES;
  protected readonly label: Record<string, string> = ORDER_STATUS_LABEL;
  protected readonly cls: Record<string, string> = ORDER_STATUS_CLASS;
  protected readonly icon: Record<string, string> = STATUS_ICON;
  protected readonly radius = RING_RADIUS;
  protected readonly look = (n: { eventType: string; severity: 'INFO' | 'WARNING' }) => eventLook(n.eventType, n.severity);
  protected readonly ago = (iso: string) => relativeTime(iso);

  protected readonly loading = signal(true);
  protected readonly counts = signal<Partial<Record<OrderStatus, number>>>({});
  protected readonly recent = signal<OrderSummary[]>([]);
  protected readonly low = signal<Stock[]>([]);
  protected readonly lowTotal = signal(0);

  protected readonly total = computed(() => STATUSES.reduce((sum, status) => sum + (this.counts()[status] ?? 0), 0));

  /** Tratti dell'anello: lunghezza e posizione di ogni stato sul totale (in percentuale della circonferenza). */
  protected readonly segments = computed(() => {
    const total = this.total();
    if (total === 0) return [];
    let offset = 0;
    return STATUSES.filter((status) => (this.counts()[status] ?? 0) > 0).map((status) => {
      const length = ((this.counts()[status] ?? 0) / total) * 100;
      const segment = { status, length, offset };
      offset += length;
      return segment;
    });
  });

  protected share(status: OrderStatus): number {
    const total = this.total();
    return total === 0 ? 0 : Math.round(((this.counts()[status] ?? 0) / total) * 100);
  }

  /** Quanto resta della soglia di riordino: 0 % a scorta finita, 100 % a soglia raggiunta. */
  protected level(stock: Stock): number {
    return stock.reorderLevel <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((stock.available / stock.reorderLevel) * 100)));
  }

  ngOnInit(): void {
    const paging = { page: 0, size: 1 };
    forkJoin({
      counts: forkJoin(STATUSES.map((status) => this.orders.search({ status, q: '' }, paging))),
      recent: this.orders.search({ status: '', q: '' }, { page: 0, size: 6 }),
      low: this.inventory.list('', true, { page: 0, size: 6 }),
    }).subscribe({
      next: ({ counts, recent, low }) => {
        const byStatus: Partial<Record<OrderStatus, number>> = {};
        STATUSES.forEach((status, index) => (byStatus[status] = counts[index].totalElements));
        this.counts.set(byStatus);
        this.recent.set(recent.content);
        this.low.set(low.content);
        this.lowTotal.set(low.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
