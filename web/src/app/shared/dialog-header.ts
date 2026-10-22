import { Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

/**
 * Intestazione comune delle finestre: icona colorata, titolo con sottotitolo facoltativo e pulsante per chiudere.
 * La chiusura non conferma niente: chi apre la finestra riceve {@code undefined}, come con Annulla.
 */
@Component({
  selector: 'app-dialog-header',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="head">
      <span class="icon" [class]="tone()"><mat-icon>{{ icon() }}</mat-icon></span>
      <div class="text">
        <h2 mat-dialog-title class="title">{{ title() }}</h2>
        @if (subtitle()) {
          <p class="sub">{{ subtitle() }}</p>
        }
      </div>
      <button mat-icon-button type="button" mat-dialog-close aria-label="Chiudi"><mat-icon>close</mat-icon></button>
    </div>
  `,
  styles: `
    .head {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 20px 16px 8px 24px;
    }
    .icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .icon.danger {
      background: var(--app-bad-bg);
      color: var(--app-bad-fg);
    }
    .icon.warn {
      background: var(--app-warn-bg);
      color: var(--app-warn-fg);
    }
    .text {
      flex: 1;
      min-width: 0;
    }
    h2.title {
      margin: 0;
      padding: 0;
      font: var(--mat-sys-title-large);
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    h2.title::before {
      display: none;
    }
    .sub {
      margin: 2px 0 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class DialogHeader {
  readonly icon = input('edit');
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly tone = input<'primary' | 'danger' | 'warn'>('primary');
}
