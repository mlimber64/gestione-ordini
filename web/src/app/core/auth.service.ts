import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AccessToken, Role } from './models';

export interface SessionUser {
  username: string;
  roles: Role[];
}

/** Legge il contenuto del JWT. Serve solo a mostrare l'utente e nascondere i comandi: i permessi veri li applica il server. */
export function decodeUser(token: string | null): SessionUser | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    const json = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    return { username: json.sub, roles: json.roles ?? [] };
  } catch {
    return null;
  }
}

/**
 * Sessione dell'utente. Il token di accesso (15 minuti) vive solo in memoria. Quello di refresh sta in un cookie
 * HttpOnly che il server imposta e il browser rimanda da solo a /api/v1/auth: il codice della pagina non lo vede mai,
 * quindi un XSS non può rubarlo. Il cookie dura quanto il browser aperto: un ricaricamento della pagina non obbliga
 * a rifare il login, la chiusura del browser sì.
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
    return this.http.post<AccessToken>('/api/v1/auth/login', { username, password }).pipe(
      tap((token) => this.accessToken.set(token.accessToken)),
      map(() => undefined),
    );
  }

  /**
   * All'avvio: se il browser ha ancora il cookie di refresh della sessione, ottiene un token di accesso. Il cookie è
   * HttpOnly, quindi la pagina non può sapere se c'è: lo si prova e, se manca o è scaduto, si resta senza accesso.
   */
  restore(): Observable<boolean> {
    return this.refresh().pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  /** Ottiene un nuovo token di accesso. Più richieste simultanee condividono un'unica chiamata. */
  refresh(): Observable<string> {
    if (!this.inFlightRefresh) {
      this.inFlightRefresh = this.http.post<AccessToken>('/api/v1/auth/refresh', null).pipe(
        tap((token) => this.accessToken.set(token.accessToken)),
        map((token) => token.accessToken),
        catchError((error) => {
          this.accessToken.set(null);
          return throwError(() => error);
        }),
        finalize(() => (this.inFlightRefresh = null)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.inFlightRefresh;
  }

  /** Chiude la sessione: toglie il token dalla memoria e chiede al server di eliminare il cookie. */
  logout(redirect = true): void {
    this.accessToken.set(null);
    // Se la chiamata fallisce il cookie resta, ma scade con il browser e senza token di accesso non serve a nulla
    this.http.post<void>('/api/v1/auth/logout', null).subscribe({ error: () => undefined });
    if (redirect) void this.router.navigate(['/login']);
  }
}
