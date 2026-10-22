import { Component, Injectable, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Observable, map } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  /** Che cosa succede se si conferma: l'effetto, non solo la domanda. */
  message: string;
  /** Il verbo dell'azione («Conferma ordine», «Blocca cliente»…): mai un generico «Sì». */
  confirmLabel: string;
  icon?: string;
  /** {@code danger} per ciò che non si può disfare, {@code warn} per ciò che ha conseguenze, altrimenti neutro. */
  tone?: 'primary' | 'warn' | 'danger';
}

/** Finestra di conferma, al posto del {@code confirm()} del browser. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="body">
      <span class="icon" [class]="data.tone ?? 'primary'"><mat-icon>{{ data.icon ?? 'help' }}</mat-icon></span>
      <h2 mat-dialog-title class="title">{{ data.title }}</h2>
      <p class="message">{{ data.message }}</p>
    </div>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Indietro</button>
      <button mat-flat-button type="button" [class.danger]="data.tone === 'danger'" [mat-dialog-close]="true" cdkFocusInitial>
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .body {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 28px 28px 8px;
      text-align: center;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      margin-bottom: 8px;
      border-radius: 50%;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .icon.warn {
      background: var(--app-warn-bg);
      color: var(--app-warn-fg);
    }
    .icon.danger {
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
    }
    h2.title {
      margin: 0;
      padding: 0;
      font: var(--mat-sys-title-large);
      font-weight: 600;
    }
    h2.title::before {
      display: none;
    }
    .message {
      margin: 0;
      max-width: 38ch;
      color: var(--mat-sys-on-surface-variant);
    }
    button.danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}

/** Chiede una conferma e risponde {@code true} solo se l'utente la dà: chiudere la finestra o premere Esc è un no. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  ask(options: ConfirmOptions): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialog, ConfirmOptions, boolean>(ConfirmDialog, { data: options, width: '440px', maxWidth: '92vw' })
      .afterClosed()
      .pipe(map((answer) => answer === true));
  }
}
