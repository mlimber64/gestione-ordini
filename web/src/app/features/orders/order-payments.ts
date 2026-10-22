import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Observable } from 'rxjs';
import { PaymentsApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_CLASS,
  PAYMENT_STATUS_LABEL,
  SETTLEMENT_CLASS,
  SETTLEMENT_LABEL,
} from '../../core/labels';
import { OrderPayments, Payment, PaymentInput, PaymentMethod, PaymentStatus } from '../../core/models';
import { PaymentDialog, PaymentDialogData } from './payment-dialog';
import { ConfirmOptions, ConfirmService } from '../../shared/confirm';

/**
 * Pagamenti di un ordine, registrati a mano da chi ha il permesso. Il pagamento non cambia lo stato dell'ordine:
 * dice solo quanto è stato incassato.
 */
@Component({
  selector: 'app-order-payments',
  imports: [CurrencyPipe, DatePipe, MatTableModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <section>
      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <div class="head">
        <h2>Pagamenti</h2>
        @if (data(); as d) {
          <span class="chip" [class]="settlementClass[d.settlement]">{{ settlementLabel[d.settlement] }}</span>
        }
        <span class="spacer"></span>
        @if (canRegister()) {
          <button mat-stroked-button [disabled]="busy()" (click)="register()">
            <mat-icon>add_card</mat-icon>Registra pagamento
          </button>
        }
      </div>

      @if (data(); as d) {
        <div class="card summary">
          <div class="figures">
            <div>
              <span class="muted">Totale ordine</span>
              <strong>{{ d.total | currency: 'EUR' }}</strong>
            </div>
            <div>
              <span class="muted">Incassato</span>
              <strong class="paid">{{ d.paid | currency: 'EUR' }}</strong>
            </div>
            <div>
              <span class="muted">Ancora da incassare</span>
              <strong>{{ d.balance | currency: 'EUR' }}</strong>
            </div>
          </div>
          <div class="meter" role="img" [attr.aria-label]="'Incassato il ' + percent(d) + '% del totale'">
            <span class="fill" [style.width.%]="percent(d)"></span>
          </div>
        </div>

        @if (d.payments.length) {
          <div class="table-card">
            <table mat-table [dataSource]="d.payments">
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Registrato</th>
                <td mat-cell *matCellDef="let p">{{ p.createdAt | date: 'dd/MM/yyyy HH:mm' }}<br /><span class="muted">{{ p.createdBy }}</span></td>
              </ng-container>
              <ng-container matColumnDef="method">
                <th mat-header-cell *matHeaderCellDef>Metodo</th>
                <td mat-cell *matCellDef="let p">
                  {{ methodText(p.method) }}
                  @if (p.reference) {
                    <br /><span class="muted">{{ p.reference }}</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef class="num">Importo</th>
                <td mat-cell *matCellDef="let p" class="num">{{ p.amount | currency: 'EUR' }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Stato</th>
                <td mat-cell *matCellDef="let p">
                  <span class="chip" [class]="statusCss(p.status)">{{ statusText(p.status) }}</span>
                  @if (p.paidAt) {
                    <br /><span class="muted">il {{ p.paidAt | date: 'dd/MM/yyyy' }}</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let p" class="actions">
                  @if (auth.canWrite()) {
                    @if (p.status === 'PENDING') {
                      <button mat-stroked-button [disabled]="busy()" (click)="act(p, 'pay')">Incassa</button>
                      <button mat-button [disabled]="busy()" (click)="act(p, 'fail')">Non riuscito</button>
                    }
                    @if (p.status === 'PAID') {
                      <button mat-button [disabled]="busy()" (click)="act(p, 'refund')">Rimborsa</button>
                    }
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns"></tr>
            </table>
          </div>
        } @else {
          <div class="card none">
            <mat-icon>payments</mat-icon>
            <span>
              <strong>Nessun pagamento registrato</strong>
              <small class="muted">Registra un bonifico, una carta o un contrassegno quando arriva.</small>
            </span>
          </div>
        }
      }
    </section>
  `,
  styles: `
    section {
      margin-top: 24px;
    }
    .none {
      display: flex;
      align-items: center;
      gap: 14px;
      color: var(--mat-sys-on-surface-variant);
    }
    .none span {
      display: flex;
      flex-direction: column;
    }
    .none strong {
      color: var(--mat-sys-on-surface);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin-bottom: 8px;
    }
    h2 {
      font: var(--mat-sys-title-small);
      font-weight: 600;
      margin: 0;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .summary {
      display: grid;
      gap: 14px;
      margin-bottom: 12px;
    }
    .figures {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px 24px;
    }
    .figures div {
      display: flex;
      flex-direction: column;
    }
    .figures strong {
      font: var(--mat-sys-title-large);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .paid {
      color: var(--app-ok-fg);
    }
    .meter {
      height: 8px;
      border-radius: 4px;
      background: var(--mat-sys-surface-container-high);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      border-radius: 4px;
      background: var(--app-ok-solid);
      transition: width 0.4s ease;
    }
    .actions {
      text-align: right;
      white-space: nowrap;
    }
  `,
})
export class OrderPaymentsPanel implements OnInit {
  /** Id dell'ordine di cui mostrare i pagamenti. */
  readonly orderId = input.required<string>();
  /** Per un ordine annullato i pagamenti si vedono ma non se ne registrano di nuovi. */
  readonly cancelled = input(false);

  private readonly api = inject(PaymentsApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmation = inject(ConfirmService);
  protected readonly auth = inject(AuthService);

  protected readonly data = signal<OrderPayments | null>(null);
  protected readonly busy = signal(false);
  protected readonly canRegister = computed(
    () => this.auth.canWrite() && !this.cancelled() && (this.data()?.registrable ?? 0) > 0,
  );

  protected readonly columns = ['date', 'method', 'amount', 'status', 'actions'];
  protected readonly settlementLabel = SETTLEMENT_LABEL;
  protected readonly settlementClass = SETTLEMENT_CLASS;

  ngOnInit(): void {
    this.reload();
  }

  /** Quota già incassata del totale, tra 0 e 100. */
  protected percent(summary: OrderPayments): number {
    return summary.total > 0 ? Math.max(0, Math.min(100, Math.round((summary.paid / summary.total) * 100))) : 0;
  }

  protected methodText(method: PaymentMethod): string {
    return PAYMENT_METHOD_LABEL[method];
  }

  protected statusText(status: PaymentStatus): string {
    return PAYMENT_STATUS_LABEL[status];
  }

  protected statusCss(status: PaymentStatus): string {
    return PAYMENT_STATUS_CLASS[status];
  }

  protected register(): void {
    const registrable = this.data()?.registrable ?? 0;
    this.dialog
      .open<PaymentDialog, PaymentDialogData, PaymentInput>(PaymentDialog, { data: { registrable } })
      .afterClosed()
      .subscribe((input) => {
        if (input) this.execute(this.api.register(this.orderId(), input), 'Pagamento registrato');
      });
  }

  protected act(payment: Payment, action: 'pay' | 'fail' | 'refund'): void {
    const done = { pay: 'Pagamento incassato', fail: 'Pagamento segnato come non riuscito', refund: 'Pagamento rimborsato' };
    const amount = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(payment.amount);
    const confirmation: Record<typeof action, ConfirmOptions> = {
      pay: {
        title: 'Incassare il pagamento?',
        message: `Segni come incassati ${amount}: l'importo si somma a quanto già pagato.`,
        confirmLabel: 'Incassa',
        icon: 'payments',
      },
      fail: {
        title: 'Segnare come non riuscito?',
        message: `Il pagamento di ${amount} non verrà contato e l'importo tornerà da incassare.`,
        confirmLabel: 'Segna come non riuscito',
        icon: 'error',
        tone: 'warn',
      },
      refund: {
        title: 'Rimborsare il pagamento?',
        message: `Il pagamento di ${amount} viene rimborsato e l'importo torna da incassare.`,
        confirmLabel: 'Rimborsa',
        icon: 'undo',
        tone: 'warn',
      },
    };
    this.confirmation.ask(confirmation[action]).subscribe((yes) => {
      if (yes) this.execute(this.api[action](payment.id), done[action]);
    });
  }

  private execute(request: Observable<Payment>, message: string): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.snackBar.open(message);
        this.reload();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private reload(): void {
    this.busy.set(true);
    this.api.forOrder(this.orderId()).subscribe({
      next: (payments) => {
        this.data.set(payments);
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
