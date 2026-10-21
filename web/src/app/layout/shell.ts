import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter, map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ROLE_LABEL } from '../core/labels';
import { NotificationService } from '../core/notification.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/** Struttura delle schermate private: menu laterale, barra superiore con notifiche e menu utente. */
@Component({
  selector: 'app-shell',
  imports: [
    DatePipe,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <mat-sidenav-container class="container">
      <mat-sidenav
        #sidenav
        class="sidenav"
        [mode]="mobile() ? 'over' : 'side'"
        [opened]="!mobile()"
        [fixedInViewport]="mobile()"
      >
        <div class="brand">
          <mat-icon>inventory_2</mat-icon>
          <span>Gestione Ordini</span>
        </div>
        <mat-nav-list>
          @for (item of nav; track item.path) {
            <a
              mat-list-item
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.path === '/' }"
              (click)="closeIfMobile()"
            >
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content>
        <mat-toolbar class="toolbar">
          @if (mobile()) {
            <button mat-icon-button (click)="sidenav.toggle()" aria-label="Apri il menu">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <span class="title">{{ section() }}</span>
          <span class="spacer"></span>

          <span
            class="live"
            [class.on]="notifications.connected()"
            [matTooltip]="notifications.connected() ? 'Notifiche in tempo reale attive' : 'Notifiche non collegate'"
          >
            <span class="dot"></span>
            {{ notifications.connected() ? 'In diretta' : 'Connessione…' }}
          </span>

          <button
            mat-icon-button
            [matMenuTriggerFor]="bell"
            (menuOpened)="notifications.markAllRead()"
            aria-label="Notifiche"
          >
            <mat-icon [matBadge]="notifications.unread() || null" matBadgeSize="small" matBadgeColor="warn">
              notifications
            </mat-icon>
          </button>
          <mat-menu #bell="matMenu" class="bell-menu">
            @for (n of notifications.items().slice(0, 6); track n.id) {
              <a mat-menu-item [routerLink]="['/notifiche']" class="bell-item">
                <mat-icon [class.warn]="n.severity === 'WARNING'">{{
                  n.severity === 'WARNING' ? 'warning' : 'info'
                }}</mat-icon>
                <span class="bell-text">
                  <strong>{{ n.title }}</strong>
                  <small>{{ n.receivedAt | date: 'dd/MM HH:mm' }}</small>
                </span>
              </a>
            } @empty {
              <div class="bell-empty">Nessuna notifica</div>
            }
            <mat-divider />
            <a mat-menu-item routerLink="/notifiche">Vedi tutte</a>
          </mat-menu>

          <button mat-button [matMenuTriggerFor]="userMenu" class="user">
            <mat-icon>account_circle</mat-icon>
            <span class="user-name">{{ auth.user()?.username }}</span>
          </button>
          <mat-menu #userMenu="matMenu">
            <div class="user-info">
              <strong>{{ auth.user()?.username }}</strong>
              <small>{{ role() }}</small>
            </div>
            <mat-divider />
            <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon>Esci</button>
          </mat-menu>
        </mat-toolbar>

        <main><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .container {
      height: 100vh;
    }
    .sidenav {
      width: 240px;
      border-right: 1px solid var(--mat-sys-outline-variant);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 20px 12px;
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-primary);
    }
    .active {
      background: var(--mat-sys-secondary-container);
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      background: var(--mat-sys-surface);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      gap: 4px;
    }
    .title {
      font: var(--mat-sys-title-medium);
    }
    .spacer {
      flex: 1 1 auto;
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-right: 8px;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #b3261e;
    }
    .live.on .dot {
      background: #2e7d32;
    }
    .user-name {
      margin-left: 6px;
    }
    .user-info {
      display: flex;
      flex-direction: column;
      padding: 8px 16px;
    }
    .bell-item {
      min-width: 280px;
    }
    .bell-text {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    .bell-text small,
    .user-info small {
      color: var(--mat-sys-on-surface-variant);
    }
    .bell-empty {
      padding: 16px;
      color: var(--mat-sys-on-surface-variant);
    }
    mat-icon.warn {
      color: #b26a00;
    }
    @media (max-width: 600px) {
      .user-name,
      .live {
        display: none;
      }
    }
  `,
})
export class Shell implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly sidenav = viewChild.required<MatSidenav>('sidenav');
  private toasts?: Subscription;

  protected readonly mobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly nav: NavItem[] = [
    { path: '/', label: 'Cruscotto', icon: 'dashboard' },
    { path: '/ordini', label: 'Ordini', icon: 'receipt_long' },
    { path: '/clienti', label: 'Clienti', icon: 'groups' },
    { path: '/prodotti', label: 'Prodotti', icon: 'category' },
    { path: '/magazzino', label: 'Magazzino', icon: 'warehouse' },
    { path: '/notifiche', label: 'Notifiche', icon: 'notifications' },
  ];

  protected readonly section = signal('Cruscotto');

  protected role(): string {
    const role = this.auth.user()?.roles[0];
    return role ? ROLE_LABEL[role] : '';
  }

  ngOnInit(): void {
    this.updateSection(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.updateSection(event.urlAfterRedirects));

    this.notifications.start();
    // Ogni notifica che arriva in diretta compare anche come avviso a comparsa, con un link alla sezione
    this.toasts = this.notifications.incoming.subscribe((n) =>
      this.snackBar.open(n.title, 'Apri', { duration: 6000 }).onAction().subscribe(() => void this.router.navigate(['/notifiche'])),
    );
  }

  ngOnDestroy(): void {
    this.toasts?.unsubscribe();
    this.notifications.stop();
  }

  protected closeIfMobile(): void {
    if (this.mobile()) void this.sidenav().close();
  }

  protected logout(): void {
    this.notifications.stop();
    this.auth.logout();
  }

  private updateSection(url: string): void {
    const path = '/' + (url.split('?')[0].split('/')[1] ?? '');
    this.section.set(this.nav.find((item) => item.path === path)?.label ?? 'Cruscotto');
  }
}
