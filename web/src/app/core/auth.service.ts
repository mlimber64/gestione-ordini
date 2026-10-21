import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { Role, TokenPair } from './models';

export interface SessionUser {
  username: string;
  roles: Role[];
}

const REFRESH_KEY = 'gestione-ordini.refresh';

/** Legge il contenuto del JWT. Serve solo a mostrare l'utente e nascondere i comandi: i permessi veri li applica il server. */
export function decodeUser(token: string | null): SessionUser | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return { username: json.sub, roles: json.roles ?? [] };
  } catch {
    return null;
  }
}

/**
 * Sessione dell'utente. Il token di accesso (15 minuti) vive solo in memoria; quello di refresh in sessionStorage,
 * così un ricaricamento della pagina non obbliga a rifare il login ma chiudere la scheda sì.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly accessToken = signal<string | null>(null);
  readonly user = computed(() => decodeUser(this.accessToken()));
  readonly isAuthenticated = computed(() => this.user() !== null);

  private inFlightRefresh: Observable<string> | null = null;

  hasRole(...roles: Role[]): boolean {
    const user = this.user();
    return !!user && roles.some((role) => user.roles.includes(role));
  }

  /** Può modificare clienti, magazzino e ordini. */
  readonly canWrite = computed(() => this.user()?.roles.some((r) => r === 'ADMIN' || r === 'OPERATOR') ?? false);
  readonly isAdmin = computed(() => this.user()?.roles.includes('ADMIN') ?? false);

  login(username: string, password: string): Observable<void> {
    return this.http.post<TokenPair>('/api/v1/auth/login', { username, password }).pipe(
      tap((pair) => this.store(pair)),
      map(() => undefined),
    );
  }

  /** All'avvio: se c'è un token di refresh della sessione, prova a ripristinare l'accesso. */
  restore(): Observable<boolean> {
    if (!this.storedRefreshToken()) return of(false);
    return this.refresh().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  /** Ottiene un nuovo token di accesso. Più richieste simultanee condividono un'unica chiamata. */
  refresh(): Observable<string> {
    const refreshToken = this.storedRefreshToken();
    if (!refreshToken) return throwError(() => new Error('Nessuna sessione'));
    if (!this.inFlightRefresh) {
      this.inFlightRefresh = this.http.post<TokenPair>('/api/v1/auth/refresh', { refreshToken }).pipe(
        tap((pair) => this.store(pair)),
        map((pair) => pair.accessToken),
        catchError((error) => {
          this.clear();
          return throwError(() => error);
        }),
        finalize(() => (this.inFlightRefresh = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.inFlightRefresh;
  }

  logout(redirect = true): void {
    this.clear();
    if (redirect) void this.router.navigate(['/login']);
  }

  private store(pair: TokenPair): void {
    this.accessToken.set(pair.accessToken);
    try {
      sessionStorage.setItem(REFRESH_KEY, pair.refreshToken);
    } catch {
      // sessionStorage non disponibile (modalità privata): la sessione dura finché la pagina resta aperta
    }
  }

  private clear(): void {
    this.accessToken.set(null);
    try {
      sessionStorage.removeItem(REFRESH_KEY);
    } catch {
      // niente da fare
    }
  }

  private storedRefreshToken(): string | null {
    try {
      return sessionStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  }
}
