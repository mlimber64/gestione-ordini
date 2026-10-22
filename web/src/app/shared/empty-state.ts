import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Stato vuoto: un'icona, che cosa manca e, se serve, un'azione (contenuto proiettato). */
@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  template: `
    <div class="empty-state">
      <span class="badge"><mat-icon>{{ icon() }}</mat-icon></span>
      <strong>{{ title() }}</strong>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 48px 24px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .badge {
      display: grid;
      place-items: center;
      width: 52px;
      height: 52px;
      margin-bottom: 8px;
      border-radius: 50%;
      background: var(--mat-sys-surface-container-high);
    }
    strong {
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-title-medium);
    }
    p {
      margin: 0 0 8px;
      max-width: 44ch;
    }
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input('');
}
