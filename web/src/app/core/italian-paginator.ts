import { Injectable } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';

/** Etichette del paginatore in italiano. */
@Injectable()
export class ItalianPaginatorIntl extends MatPaginatorIntl {
  override itemsPerPageLabel = 'Righe per pagina';
  override nextPageLabel = 'Pagina successiva';
  override previousPageLabel = 'Pagina precedente';
  override firstPageLabel = 'Prima pagina';
  override lastPageLabel = 'Ultima pagina';

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) return '0 di 0';
    const start = page * pageSize;
    const end = Math.min(start + pageSize, length);
    return `${start + 1}–${end} di ${length}`;
  };
}
