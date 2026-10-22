import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { AuthConfig } from '../../core/models';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="wrap">
      <aside class="hero" aria-hidden="true">
        <div class="hero-brand"><span class="mark"><mat-icon>inventory_2</mat-icon></span>Gestione Ordini</div>
        <div class="hero-copy">
          <h2>Ordini, magazzino e pagamenti in un solo posto.</h2>
          <ul>
            <li><mat-icon>bolt</mat-icon>Giacenze riservate in modo atomico alla conferma</li>
            <li><mat-icon>notifications_active</mat-icon>Notifiche in diretta su ogni cambio di stato</li>
            <li><mat-icon>payments</mat-icon>Acconti, saldi e rimborsi sempre quadrati</li>
          </ul>
        </div>
      </aside>
      <div class="panel">
      <form class="box" [formGroup]="form" (ngSubmit)="submit()">
        <div class="brand"><span class="mark"><mat-icon>inventory_2</mat-icon></span><span>Gestione Ordini</span></div>
        <h1>Accedi</h1>
        <p class="muted">Inserisci le tue credenziali per continuare.</p>

        @switch (mode()) {
          @case ('oidc') {
            <!-- Link normale, non una rotta: è il server a mandare il browser alla pagina di accesso di Keycloak -->
            <a mat-flat-button href="/api/v1/auth/oidc/login">Accedi con Keycloak</a>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
          }
          @case ('local') {

        <mat-form-field>
          <mat-label>Nome utente</mat-label>
          <input matInput formControlName="username" autocomplete="username" autofocus />
          @if (form.controls.username.touched && form.controls.username.invalid) {
            <mat-error>Inserisci il nome utente</mat-error>
          }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Password</mat-label>
          <input matInput formControlName="password" [type]="show() ? 'text' : 'password'" autocomplete="current-password" />
          <button
            mat-icon-button
            matSuffix
            type="button"
            (click)="show.set(!show())"
            [attr.aria-label]="show() ? 'Nascondi la password' : 'Mostra la password'"
          >
            <mat-icon>{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
          @if (form.controls.password.touched && form.controls.password.invalid) {
            <mat-error>Inserisci la password</mat-error>
          }
        </mat-form-field>

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button mat-flat-button type="submit" [disabled]="busy()">Accedi</button>
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" />
        }
          }
          @default {
            <mat-progress-bar mode="indeterminate" />
          }
        }
      </form>
      </div>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      background: var(--app-canvas);
    }
    .hero {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 56px;
      color: #e8f4f5;
      background:
        radial-gradient(900px 500px at 10% -10%, rgb(92 209 220 / 28%), transparent 60%),
        linear-gradient(160deg, #0f4a52, #0a2a30 70%);
    }
    .hero-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font: var(--mat-sys-title-medium);
      font-weight: 600;
    }
    .hero-copy h2 {
      margin: 0 0 24px;
      max-width: 18ch;
      font: var(--mat-sys-display-small);
      font-weight: 600;
      letter-spacing: -0.02em;
      text-wrap: balance;
    }
    .hero-copy ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 14px;
      color: #b9d5d9;
    }
    .hero-copy li {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .hero-copy li mat-icon {
      color: #5cd1dc;
    }
    .panel {
      display: grid;
      place-items: center;
      padding: 24px 16px;
    }
    .box {
      width: min(400px, 100%);
      display: flex;
      flex-direction: column;
      gap: 8px;
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
    .box .brand {
      display: none;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      font: var(--mat-sys-title-medium);
      font-weight: 600;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .muted {
      margin: 0 0 16px;
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
    }
    button[type='submit'],
    a[mat-flat-button] {
      height: 46px;
    }
    @media (max-width: 900px) {
      .wrap {
        grid-template-columns: minmax(0, 1fr);
      }
      .hero {
        display: none;
      }
      .box .brand {
        display: flex;
      }
    }
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  /** Si sa solo dopo aver chiesto al server: finché non risponde si mostra una barra di attesa. */
  protected readonly mode = signal<AuthConfig['mode'] | null>(null);
  protected readonly show = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  constructor() {
    // Dopo un accesso con Keycloak non riuscito il server riporta qui con ?error=oidc
    if (inject(ActivatedRoute).snapshot.queryParamMap.get('error') === 'oidc') {
      this.error.set('Accesso con Keycloak non riuscito. Riprova.');
    }
    this.http.get<AuthConfig>('/api/v1/auth/config').subscribe({
      next: (config) => this.mode.set(config.mode),
      // Un server che non risponde alla configurazione è un server di base: si mostra il modulo
      error: () => this.mode.set('local'),
    });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    this.auth.login(username.trim(), password).subscribe({
      next: () => void this.router.navigate(['/']),
      error: (error: unknown) => {
        this.busy.set(false);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.error.set(
          status === 401 || status === 400
            ? 'Nome utente o password non corretti.'
            : 'Impossibile contattare il server. Riprova tra poco.',
        );
      },
    });
  }
}
