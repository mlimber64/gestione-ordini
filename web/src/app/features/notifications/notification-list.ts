import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { eventLook, relativeTime } from '../../core/format';
import { AppNotification } from '../../core/models';
import { NotificationService } from '../../core/notification.service';
import { EmptyState } from '../../shared/empty-state';

@Component({
  selector: 'app-notification-list',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, EmptyState],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Notifiche</h1>
          <p class="page-sub">Ogni cambio di stato degli ordini e ogni scorta bassa, appena accade.</p>
        </div>
        <span class="live" [class.on]="service.connected()">
          <span class="dot"></span>
          {{ service.connected() ? 'Collegato: ricevi gli aggiornamenti in diretta' : 'Non collegato: riprovo da solo' }}
        </span>
      </div>

      <div class="card list">
        @for (n of service.items(); track n.id) {
          <div class="item">
            <span class="icon" [class]="look(n).tone"><mat-icon>{{ look(n).icon }}</mat-icon></span>
            <div class="body">
              <strong>{{ n.title }}</strong>
              <span>{{ n.message }}</span>
            </div>
            <time
              class="when muted"
              [attr.datetime]="n.receivedAt"
              [matTooltip]="(n.receivedAt | date: 'dd/MM/yyyy HH:mm:ss') ?? ''"
              >{{ ago(n.receivedAt) }}</time
            >
            @if (target(n); as link) {
              <a mat-icon-button [routerLink]="link" aria-label="Apri">
                <mat-icon>chevron_right</mat-icon>
              </a>
            }
          </div>
        } @empty {
          <app-empty-state
            icon="notifications_none"
            title="Nessuna notifica ancora"
            message="Arriveranno qui appena si crea o si modifica un ordine."
          />
        }
        @if (more() && service.items().length > 0) {
          <button mat-button class="more" (click)="loadMore()">Mostra le precedenti</button>
        }
      </div>
    </div>
  `,
  styles: `
    .live {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px 4px 10px;
      border-radius: 999px;
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
      font: var(--mat-sys-label-medium);
    }
    .live.on {
      background: var(--app-ok-bg);
      color: var(--app-ok-fg);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }
    .list {
      padding: 0;
      overflow: hidden;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
    }
    .item + .item {
      border-top: 1px solid var(--app-border);
    }
    .item:hover {
      background: var(--app-surface-sunken);
    }
    .icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 38px;
      height: 38px;
      border-radius: 50%;
    }
    .icon.ok {
      background: var(--app-ok-bg);
      color: var(--app-ok-fg);
    }
    .icon.warn {
      background: var(--app-warn-bg);
      color: var(--app-warn-fg);
    }
    .icon.bad {
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
    }
    .icon.info {
      background: var(--app-info-bg);
      color: var(--app-info-fg);
    }
    .body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .when {
      white-space: nowrap;
      font: var(--mat-sys-label-medium);
    }
    .more {
      width: 100%;
      border-top: 1px solid var(--app-border);
      border-radius: 0;
    }
  `,
})
export class NotificationList {
  protected readonly service = inject(NotificationService);
  protected readonly more = signal(true);
  protected readonly look = (n: AppNotification) => eventLook(n.eventType, n.severity);
  protected readonly ago = (iso: string) => relativeTime(iso);

  protected target(notification: AppNotification): string[] | null {
    return notification.eventType.startsWith('Order') ? ['/ordini', notification.aggregateId] : ['/magazzino'];
  }

  protected loadMore(): void {
    void this.service.loadMore().then((hasMore) => this.more.set(hasMore));
  }
}
