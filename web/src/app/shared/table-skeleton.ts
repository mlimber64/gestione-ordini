import { Component, input } from '@angular/core';

/** Righe segnaposto mentre una tabella carica: meno salti di layout di una barra di avanzamento. */
@Component({
  selector: 'app-table-skeleton',
  template: `
    <div class="rows" role="status" aria-label="Caricamento in corso">
      @for (row of rowList(); track row) {
        <div class="row" [style.grid-template-columns]="'repeat(' + cols() + ', 1fr)'">
          @for (col of colList(); track col) {
            <span class="skeleton" [style.width.%]="60 + ((row * 7 + col * 13) % 35)"></span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .rows {
      padding: 4px 16px 8px;
    }
    .row {
      display: grid;
      gap: 24px;
      align-items: center;
      height: 48px;
      border-bottom: 1px solid var(--app-border);
    }
    .row:last-child {
      border-bottom: 0;
    }
    .skeleton {
      height: 12px;
    }
  `,
})
export class TableSkeleton {
  readonly rows = input(8);
  readonly cols = input(5);

  protected rowList(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }

  protected colList(): number[] {
    return Array.from({ length: this.cols() }, (_, i) => i);
  }
}
