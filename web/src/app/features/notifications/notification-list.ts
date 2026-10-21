import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { NotificationService } from '../../core/notification.service';
import { AppNotification } from '../../core/models';

@Component({
  selector: 'app-notification-list',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Notifiche</h1>
        <span class="muted">{{ service.connected() ? 'Collegato: ricevi gli aggiornamenti in diretta' : 'Non collegato: riprovo da solo' }}</span>
      </div>

      <div class="card list">
        @for (n of service.items(); track n.id) {
          <div class="item">
            <mat-icon [class.warn]="n.severity === 'WARNING'">{{ n.severity === 'WARNING' ? 'warning' : 'info' }}</mat-icon>
            <div class="body">
              <strong>{{ n.title }}</strong>
              <span>{{ n.message }}</span>
              <small class="muted">{{ n.receivedAt | date: 'dd/MM/yyyy HH:mm:ss' }}</small>
            </div>
            @if (target(n); as link) {
              <a mat-button [routerLink]="link">Apri</a>
            }
          </div>
        } @empty {
          <p class="empty">Nessuna notifica ancora. Arriveranno qui appena si crea o si modifica un ordine.</p>
        }
        @if (more()) {
          <button mat-button class="more" (click)="loadMore()">Mostra le precedenti</button>
        }
      </div>
    </div>
  `,
  styles: `
    .list {
      padding: 0;
    }
    .item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    mat-icon.warn {
      color: #b26a00;
    }
    .more {
      width: 100%;
    }
  `,
})
export class NotificationList {
  protected readonly service = inject(NotificationService);
  protected readonly more = signal(true);

  protected target(notification: AppNotification): string[] | null {
    return notification.eventType.startsWith('Order') ? ['/ordini', notification.aggregateId] : ['/magazzino'];
  }

  protected loadMore(): void {
    void this.service.loadMore().then((hasMore) => this.more.set(hasMore));
  }
}
