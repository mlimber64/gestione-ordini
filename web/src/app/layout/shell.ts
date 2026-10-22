import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription, filter, map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ROLE_LABEL } from '../core/labels';
import { NotificationService } from '../core/notification.service';
import { ThemeService } from '../core/theme.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const COLLAPSED_KEY = 'gestione-ordini.menu-compresso';

/**
 * Struttura delle schermate private: menu laterale scuro (comprimibile, cassetto su schermi piccoli), barra
 * superiore con percorso, stato delle notifiche in diretta, tema e menu utente.
 */
@Component({
  selector: 'app-shell',
  imports: [
    DatePipe,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  template: `
    <a class="skip" href="/" (click)="skipToContent($event)">Vai al contenuto</a>
    <div class="layout" [class.compact]="compact()" (keydown.escape)="drawer.set(false)">
      @if (mobile() && drawer()) {
        <button class="scrim" type="button" aria-label="Chiudi il menu" (click)="drawer.set(false)"></button>
      }

      <aside class="sidebar" [class.open]="drawer()" aria-label="Menu principale">
        <div class="brand">
          <span class="mark"><mat-icon>inventory_2</mat-icon></span>
          <span class="brand-name">Gestione Ordini</span>
        </div>

        <nav class="nav">
          @for (group of groups; track group.title) {
            <p class="group-title">{{ group.title }}</p>
            @for (item of group.items; track item.path) {
              <a
                class="nav-item"
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                [attr.aria-label]="item.label"
                [matTooltip]="compact() ? item.label : ''"
                matTooltipPosition="right"
                (click)="drawer.set(false)"
              >
                <mat-icon>{{ item.icon }}</mat-icon>
                <span class="nav-label">{{ item.label }}</span>
                @if (item.path === '/notifiche' && notifications.unread() > 0) {
                  <span class="nav-badge">{{ notifications.unread() }}</span>
                }
              </a>
            }
          }
        </nav>

        <button
          class="collapse"
          type="button"
          (click)="toggleCompact()"
          [attr.aria-label]="compact() ? 'Espandi il menu' : 'Comprimi il menu'"
          [matTooltip]="compact() ? 'Espandi il menu' : ''"
          matTooltipPosition="right"
        >
          <mat-icon>{{ compact() ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left' }}</mat-icon>
          <span class="nav-label">Comprimi il menu</span>
        </button>
      </aside>

      <div class="content">
        <header class="topbar">
          @if (mobile()) {
            <button mat-icon-button (click)="drawer.set(true)" aria-label="Apri il menu">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <nav class="crumbs" aria-label="Percorso">
            <span class="crumb-root">Gestione Ordini</span>
            <mat-icon class="crumb-sep">chevron_right</mat-icon>
            <strong>{{ section() }}</strong>
          </nav>
          <span class="spacer"></span>

          <span
            class="live"
            [class.on]="notifications.connected()"
            [matTooltip]="notifications.connected() ? 'Notifiche in tempo reale attive' : 'Notifiche non collegate'"
          >
            <span class="dot"></span>
            {{ notifications.connected() ? 'In diretta' : 'Connessione…' }}
          </span>

          <button mat-icon-button (click)="theme.cycle()" [attr.aria-label]="theme.label()" [matTooltip]="theme.label()">
            <mat-icon>{{ theme.icon() }}</mat-icon>
          </button>

          <button
            mat-icon-button
            class="bell"
            [matMenuTriggerFor]="bell"
            (menuOpened)="notifications.markAllRead()"
            aria-label="Notifiche"
          >
            <mat-icon>notifications</mat-icon>
            @if (notifications.unread() > 0) {
              <span class="bell-dot" aria-hidden="true"></span>
            }
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

          <button type="button" [matMenuTriggerFor]="userMenu" class="user">
            <span class="avatar" aria-hidden="true">{{ initials() }}</span>
            <span class="user-text">
              <span class="user-name">{{ auth.user()?.username }}</span>
              <span class="user-role">{{ role() }}</span>
            </span>
            <mat-icon class="user-caret">expand_more</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <div class="user-info">
              <strong>{{ auth.user()?.username }}</strong>
              <small>{{ role() }}</small>
            </div>
            <mat-divider />
            <button mat-menu-item (click)="logout()"><mat-icon>logout</mat-icon>Esci</button>
          </mat-menu>
        </header>

        <main id="contenuto" tabindex="-1"><router-outlet /></main>
      </div>
    </div>
  `,
  styles: `
    :host {
      --nav-width: 256px;
      --nav-width-compact: 76px;
    }
    .skip {
      position: fixed;
      top: 8px;
      left: 8px;
      z-index: 100;
      padding: 10px 16px;
      border-radius: 8px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      text-decoration: none;
      transform: translateY(-200%);
    }
    .skip:focus {
      transform: none;
    }
    main:focus {
      outline: none;
    }
    .layout {
      display: grid;
      grid-template-columns: var(--nav-width) minmax(0, 1fr);
      min-height: 100vh;
      transition: grid-template-columns 0.2s ease;
    }
    .layout.compact {
      grid-template-columns: var(--nav-width-compact) minmax(0, 1fr);
    }

    /* --- Menu laterale --- */
    .sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--app-nav-bg);
      color: var(--app-nav-fg);
      overflow: hidden;
      z-index: 20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 64px;
      padding: 0 20px;
      flex: none;
      border-bottom: 1px solid var(--app-nav-line);
      color: var(--app-nav-fg-strong);
      white-space: nowrap;
    }
    .mark {
      flex: none;
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: linear-gradient(135deg, #1aa3b0, #0e6f78);
      color: #fff;
    }
    .mark mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .brand-name {
      font: var(--mat-sys-title-medium);
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .nav {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 8px 12px 12px;
    }
    .group-title {
      margin: 18px 12px 6px;
      font: var(--mat-sys-label-small);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--app-nav-muted);
      white-space: nowrap;
      overflow: hidden;
    }
    .nav-item,
    .collapse {
      position: relative;
      display: flex;
      align-items: center;
      gap: 14px;
      height: 42px;
      padding: 0 12px;
      margin-bottom: 2px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: var(--app-nav-fg);
      font: var(--mat-sys-label-large);
      font-size: 14px;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      width: 100%;
      box-sizing: border-box;
    }
    .nav-item:hover,
    .collapse:hover {
      background: var(--app-nav-hover);
      color: var(--app-nav-fg-strong);
    }
    .nav-item.active {
      background: var(--app-nav-active);
      color: var(--app-nav-fg-strong);
      font-weight: 600;
    }
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: -12px;
      top: 9px;
      bottom: 9px;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: var(--app-nav-accent);
    }
    .nav-item mat-icon,
    .collapse mat-icon {
      flex: none;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .nav-item.active mat-icon {
      color: var(--app-nav-accent);
    }
    .nav-badge {
      margin-left: auto;
      min-width: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: var(--app-nav-accent);
      color: #062b30;
      font: var(--mat-sys-label-small);
      font-weight: 700;
      line-height: 20px;
      text-align: center;
    }
    .collapse {
      flex: none;
      width: auto;
      margin: 0 12px 12px;
      color: var(--app-nav-muted);
    }
    .compact .nav-label,
    .compact .brand-name,
    .compact .nav-badge {
      display: none;
    }
    .compact .group-title {
      visibility: hidden;
      height: 8px;
      margin: 10px 0 0;
    }
    .compact .brand {
      padding: 0 20px;
    }
    .compact .nav-item {
      padding: 0 10px;
    }
    .compact .nav-item.active::before {
      left: -12px;
    }

    /* --- Contenuto --- */
    .content {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 4px;
      height: 64px;
      padding: 0 20px 0 24px;
      background: color-mix(in srgb, var(--app-surface) 88%, transparent);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--app-border);
    }
    .crumbs {
      display: flex;
      align-items: center;
      gap: 2px;
      font: var(--mat-sys-body-medium);
    }
    .crumb-root {
      color: var(--mat-sys-on-surface-variant);
    }
    .crumb-sep {
      width: 20px;
      height: 20px;
      font-size: 20px;
      color: var(--mat-sys-outline);
    }
    .spacer {
      flex: 1 1 auto;
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-right: 8px;
      padding: 4px 12px 4px 10px;
      border-radius: 999px;
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
      font: var(--mat-sys-label-medium);
      font-weight: 500;
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
    .live.on .dot {
      animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 55%, transparent);
      }
      100% {
        box-shadow: 0 0 0 8px transparent;
      }
    }
    .bell {
      position: relative;
    }
    .bell-dot {
      position: absolute;
      top: 10px;
      right: 11px;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--mat-sys-error);
      border: 2px solid var(--app-surface);
      box-sizing: content-box;
    }
    .user {
      display: flex;
      align-items: center;
      height: 44px;
      margin-left: 6px;
      padding: 0 8px 0 6px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .user:hover {
      background: var(--app-surface-sunken);
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-label-large);
      font-weight: 600;
      text-transform: uppercase;
    }
    .user-text {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin: 0 6px 0 10px;
      line-height: 1.2;
    }
    .user-name {
      font: var(--mat-sys-label-large);
      font-weight: 600;
    }
    .user-role {
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .user-caret {
      color: var(--mat-sys-on-surface-variant);
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
      color: var(--app-warn-fg);
    }
    .scrim {
      position: fixed;
      inset: 0;
      z-index: 19;
      border: 0;
      background: rgb(8 20 24 / 55%);
    }

    /* --- Schermi piccoli: il menu diventa un cassetto --- */
    @media (max-width: 900px) {
      .layout,
      .layout.compact {
        grid-template-columns: minmax(0, 1fr);
      }
      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        width: min(280px, 86vw);
        transform: translateX(-100%);
        transition: transform 0.2s ease;
        box-shadow: var(--app-shadow-lg);
      }
      .sidebar.open {
        transform: none;
      }
      .layout.compact .nav-label,
      .layout.compact .brand-name {
        display: inline;
      }
      .layout.compact .group-title {
        visibility: visible;
        height: auto;
        margin: 18px 12px 6px;
      }
      .collapse {
        display: none;
      }
      .topbar {
        padding: 0 8px 0 8px;
      }
      .crumb-root,
      .crumb-sep,
      .user-text,
      .user-caret,
      .live {
        display: none;
      }
    }
  `,
})
export class Shell implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private toasts?: Subscription;

  protected readonly mobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** Il menu compresso (solo icone) vale solo su schermi larghi; su quelli piccoli il menu è un cassetto. */
  protected readonly collapsed = signal(this.readCollapsed());
  protected readonly compact = computed(() => this.collapsed() && !this.mobile());
  protected readonly drawer = signal(false);

  protected readonly groups: NavGroup[] = [
    {
      title: 'Vendite',
      items: [
        { path: '/', label: 'Cruscotto', icon: 'dashboard' },
        { path: '/ordini', label: 'Ordini', icon: 'receipt_long' },
        { path: '/clienti', label: 'Clienti', icon: 'groups' },
      ],
    },
    {
      title: 'Catalogo',
      items: [
        { path: '/prodotti', label: 'Prodotti', icon: 'category' },
        { path: '/magazzino', label: 'Magazzino', icon: 'warehouse' },
      ],
    },
    { title: 'Sistema', items: [{ path: '/notifiche', label: 'Notifiche', icon: 'notifications' }] },
  ];

  protected readonly section = signal('Cruscotto');

  protected role(): string {
    const role = this.auth.user()?.roles[0];
    return role ? ROLE_LABEL[role] : '';
  }

  protected initials(): string {
    return (this.auth.user()?.username ?? '?').slice(0, 2);
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

  /** Porta il focus sul contenuto: chi naviga da tastiera salta il menu senza attraversarlo ogni volta. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    document.getElementById('contenuto')?.focus();
  }

  protected toggleCompact(): void {
    this.collapsed.update((value) => !value);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(this.collapsed()));
    } catch {
      // Archiviazione non disponibile: la scelta vale solo per questa visita
    }
  }

  protected logout(): void {
    this.notifications.stop();
    this.auth.logout();
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private updateSection(url: string): void {
    const path = '/' + (url.split('?')[0].split('/')[1] ?? '');
    const items = this.groups.flatMap((group) => group.items);
    this.section.set(items.find((item) => item.path === path)?.label ?? 'Cruscotto');
  }
}
