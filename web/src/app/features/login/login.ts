import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

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
      <form class="card box" [formGroup]="form" (ngSubmit)="submit()">
        <div class="brand"><mat-icon>inventory_2</mat-icon><span>Gestione Ordini</span></div>
        <p class="muted">Accedi per gestire clienti, magazzino e ordini.</p>

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
      </form>
    </div>
  `,
  styles: `
    .wrap {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
      background: var(--mat-sys-surface-container-low);
    }
    .box {
      width: min(400px, 100%);
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 28px 28px 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-primary);
    }
    .muted {
      margin: 0 0 12px;
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
    }
  `,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly show = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

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
