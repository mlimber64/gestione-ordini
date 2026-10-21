import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { InventoryApi, OrdersApi } from '../../core/api';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from '../../core/labels';
import { OrderStatus, OrderSummary, Stock } from '../../core/models';
import { NotificationService } from '../../core/notification.service';

const STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, MatIconModule, MatButtonModule, MatProgressBarModule],
  template: `
    <div class="page">
      <div class="page-header"><h1>Cruscotto</h1></div>
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <section class="kpis">
        @for (s of statuses; track s) {
          <a class="card kpi" routerLink="/ordini" [queryParams]="{ stato: s }">
            <span class="kpi-label">{{ label[s] }}</span>
            <span class="kpi-value">{{ counts()[s] ?? '–' }}</span>
          </a>
        }
      </section>

      <div class="columns">
        <section class="card">
          <h2>Ultimi ordini</h2>
          @for (o of recent(); track o.id) {
            <a class="row" [routerLink]="['/ordini', o.id]">
              <span>
                <strong>{{ o.number }}</strong>
                <small class="muted">{{ o.customerName }}</small>
              </span>
              <span class="right">
                <span>{{ o.totalGross | currency: 'EUR' }}</span>
                <span class="chip" [class]="cls[o.status]">{{ label[o.status] }}</span>
              </span>
            </a>
          } @empty {
            <p class="empty">Nessun ordine ancora.</p>
          }
        </section>

        <section class="card">
          <h2>Scorte basse</h2>
          @for (s of low(); track s.productId) {
            <div class="row">
              <span>
                <strong>{{ s.sku }}</strong>
                <small class="muted">{{ s.productName }}</small>
              </span>
              <span class="chip warn">{{ s.available }} / soglia {{ s.reorderLevel }}</span>
            </div>
          } @empty {
            <p class="empty">Tutte le scorte sono sopra soglia.</p>
          }
          <a mat-button routerLink="/magazzino">Vai al magazzino</a>
        </section>

        <section class="card wide">
          <h2>Attività in diretta</h2>
          @for (n of notifications.items().slice(0, 6); track n.id) {
            <div class="row">
              <span class="note">
                <mat-icon [class.warn]="n.severity === 'WARNING'">{{ n.severity === 'WARNING' ? 'warning' : 'info' }}</mat-icon>
                <span>
                  <strong>{{ n.title }}</strong>
                  <small class="muted">{{ n.message }}</small>
                </span>
              </span>
              <small class="muted">{{ n.receivedAt | date: 'dd/MM HH:mm' }}</small>
            </div>
          } @empty {
            <p class="empty">Le novità compariranno qui appena accadono.</p>
          }
          <a mat-button routerLink="/notifiche">Tutte le notifiche</a>
        </section>
      </div>
    </div>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin: 12px 0 16px;
    }
    .kpi {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: inherit;
      text-decoration: none;
      align-items: flex-start;
    }
    .kpi:hover {
      border-color: var(--mat-sys-primary);
    }
    .kpi-label {
      color: var(--mat-sys-on-surface-variant);
    }
    .kpi-value {
      font: var(--mat-sys-headline-medium);
    }
    .columns {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 12px;
    }
    .wide {
      grid-column: 1 / -1;
    }
    h2 {
      font: var(--mat-sys-title-medium);
      margin: 0 0 8px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      color: inherit;
      text-decoration: none;
    }
    .row > span:first-child {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .right {
      display: flex;
      align-items: center;
      gap: 10px;
      white-space: nowrap;
    }
    .note {
      display: flex !important;
      flex-direction: row !important;
      align-items: flex-start;
      gap: 10px;
    }
    .note > span {
      display: flex;
      flex-direction: column;
    }
    mat-icon.warn {
      color: #b26a00;
    }
  `,
})
export class Dashboard implements OnInit {
  private readonly orders = inject(OrdersApi);
  private readonly inventory = inject(InventoryApi);
  protected readonly notifications = inject(NotificationService);

  protected readonly statuses = STATUSES;
  protected readonly label: Record<string, string> = ORDER_STATUS_LABEL;
  protected readonly cls: Record<string, string> = ORDER_STATUS_CLASS;

  protected readonly loading = signal(true);
  protected readonly counts = signal<Partial<Record<OrderStatus, number>>>({});
  protected readonly recent = signal<OrderSummary[]>([]);
  protected readonly low = signal<Stock[]>([]);

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
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });  }
}
