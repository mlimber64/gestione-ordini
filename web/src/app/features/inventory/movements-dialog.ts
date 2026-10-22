import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { InventoryApi } from '../../core/api';
import { MOVEMENT_LABEL } from '../../core/labels';
import { Movement, Stock } from '../../core/models';
import { DialogHeader } from '../../shared/dialog-header';

@Component({
  selector: 'app-movements-dialog',
  imports: [DialogHeader, DatePipe, MatDialogModule, MatTableModule, MatPaginatorModule, MatButtonModule],
  template: `
    <app-dialog-header icon="history" [title]="'Movimenti · ' + stock.sku" [subtitle]="stock.productName" />
    <mat-dialog-content class="content">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="date">
          <th mat-header-cell *matHeaderCellDef>Data</th>
          <td mat-cell *matCellDef="let m">{{ m.createdAt | date: 'dd/MM/yy HH:mm' }}</td>
        </ng-container>
        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef>Tipo</th>
          <td mat-cell *matCellDef="let m">{{ label[m.type] }}</td>
        </ng-container>
        <ng-container matColumnDef="qty">
          <th mat-header-cell *matHeaderCellDef class="num">Quantità</th>
          <td mat-cell *matCellDef="let m" class="num">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}</td>
        </ng-container>
        <ng-container matColumnDef="by">
          <th mat-header-cell *matHeaderCellDef>Utente</th>
          <td mat-cell *matCellDef="let m">{{ m.createdBy }}</td>
        </ng-container>
        <ng-container matColumnDef="note">
          <th mat-header-cell *matHeaderCellDef>Nota</th>
          <td mat-cell *matCellDef="let m">{{ m.note ?? (m.referenceType === 'ORDER' ? 'Ordine' : '') }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
      </table>
      @if (rows().length === 0) {
        <p class="empty">Nessun movimento.</p>
      }
      <mat-paginator
        [length]="total()"
        [pageSize]="10"
        [pageIndex]="page()"
        (page)="load($event.pageIndex)"
        hidePageSize
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button mat-dialog-close>Chiudi</button></mat-dialog-actions>
  `,
  styles: `
    .content {
      min-width: min(680px, 85vw);
    }
  `,
})
export class MovementsDialog implements OnInit {
  protected readonly stock = inject<Stock>(MAT_DIALOG_DATA);
  private readonly api = inject(InventoryApi);

  protected readonly columns = ['date', 'type', 'qty', 'by', 'note'];
  protected readonly label: Record<string, string> = MOVEMENT_LABEL;
  protected readonly rows = signal<Movement[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);

  ngOnInit(): void {
    this.load(0);
  }

  protected load(page: number | PageEvent): void {
    const index = typeof page === 'number' ? page : page.pageIndex;
    this.api.movements(this.stock.productId, index, 10).subscribe((result) => {
      this.rows.set(result.content);
      this.total.set(result.totalElements);
      this.page.set(result.page);
    });
  }
}
