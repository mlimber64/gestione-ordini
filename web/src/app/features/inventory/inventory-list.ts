import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Observable, debounceTime, distinctUntilChanged } from 'rxjs';
import { InventoryApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { Stock } from '../../core/models';
import { MovementsDialog } from './movements-dialog';
import { StockAction, StockDialog, StockDialogData, StockDialogResult } from './stock-dialog';

@Component({
  selector: 'app-inventory-list',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header"><h1>Magazzino</h1></div>

      <div class="filters">
        <mat-form-field>
          <mat-label>Cerca per nome o SKU</mat-label>
          <input matInput [formControl]="query" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-slide-toggle [formControl]="lowOnly">Solo scorte basse</mat-slide-toggle>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <div class="table-card">
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="sku">
            <th mat-header-cell *matHeaderCellDef>SKU</th>
            <td mat-cell *matCellDef="let s">{{ s.sku }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Prodotto</th>
            <td mat-cell *matCellDef="let s">{{ s.productName }}</td>
          </ng-container>
          <ng-container matColumnDef="onHand">
            <th mat-header-cell *matHeaderCellDef class="num">In magazzino</th>
            <td mat-cell *matCellDef="let s" class="num">{{ s.onHand }}</td>
          </ng-container>
          <ng-container matColumnDef="reserved">
            <th mat-header-cell *matHeaderCellDef class="num">Riservati</th>
            <td mat-cell *matCellDef="let s" class="num">{{ s.reserved }}</td>
          </ng-container>
          <ng-container matColumnDef="available">
            <th mat-header-cell *matHeaderCellDef class="num">Disponibili</th>
            <td mat-cell *matCellDef="let s" class="num">
              <strong>{{ s.available }}</strong>
            </td>
          </ng-container>
          <ng-container matColumnDef="reorder">
            <th mat-header-cell *matHeaderCellDef class="num">Soglia</th>
            <td mat-cell *matCellDef="let s" class="num">{{ s.reorderLevel || '–' }}</td>
          </ng-container>
          <ng-container matColumnDef="state">
            <th mat-header-cell *matHeaderCellDef>Stato</th>
            <td mat-cell *matCellDef="let s">
              @if (s.lowStock) {
                <span class="chip warn">Scorta bassa</span>
              } @else if (s.available === 0) {
                <span class="chip bad">Esaurito</span>
              } @else {
                <span class="chip ok">Ok</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let s">
              <button mat-icon-button [matMenuTriggerFor]="menu" [attr.aria-label]="'Azioni per ' + s.sku">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                @if (auth.canWrite()) {
                  <button mat-menu-item (click)="act('receive', s)"><mat-icon>add_box</mat-icon>Carico merce</button>
                  <button mat-menu-item (click)="act('adjust', s)"><mat-icon>tune</mat-icon>Rettifica</button>
                  <button mat-menu-item (click)="act('reorder', s)"><mat-icon>notifications_active</mat-icon>Soglia di riordino</button>
                }
                <button mat-menu-item (click)="movements(s)"><mat-icon>history</mat-icon>Movimenti</button>
              </mat-menu>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        @if (!loading() && rows().length === 0) {
          <p class="empty">Nessun prodotto trovato.</p>
        }
        <mat-paginator
          [length]="total()"
          [pageSize]="size"
          [pageIndex]="page()"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPage($event)"
          showFirstLastButtons
        />
      </div>
    </div>
  `,
})
export class InventoryList implements OnInit {
  private readonly api = inject(InventoryApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);

  protected readonly columns = ['sku', 'name', 'onHand', 'reserved', 'available', 'reorder', 'state', 'actions'];
  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly lowOnly = new FormControl(false, { nonNullable: true });
  protected size = 20;

  protected readonly rows = signal<Stock[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly loading = signal(false);

  constructor() {
    this.query.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(0));
    this.lowOnly.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.reload(0));
  }

  ngOnInit(): void {
    this.reload(0);
  }

  protected onPage(event: PageEvent): void {
    this.size = event.pageSize;
    this.reload(event.pageIndex);
  }

  protected act(action: StockAction, stock: Stock): void {
    this.dialog
      .open<StockDialog, StockDialogData, StockDialogResult>(StockDialog, { data: { action, stock } })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.request(action, stock, result).subscribe({
          next: () => {
            this.snackBar.open('Giacenza aggiornata');
            this.reload(this.page());
          },
          error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi', { duration: 8000 }),
        });
      });
  }

  private request(action: StockAction, stock: Stock, result: StockDialogResult): Observable<Stock> {
    switch (action) {
      case 'receive':
        return this.api.receive(stock.productId, result.value, result.note || null);
      case 'adjust':
        return this.api.adjust(stock.productId, result.value, result.note);
      case 'reorder':
        return this.api.setReorderLevel(stock.productId, result.value);
    }
  }

  protected movements(stock: Stock): void {
    this.dialog.open(MovementsDialog, { data: stock });
  }

  private reload(page: number): void {
    this.loading.set(true);
    this.api.list(this.query.value.trim(), this.lowOnly.value, { page, size: this.size, sort: 'sku' }).subscribe({
      next: (result) => {
        this.rows.set(result.content);
        this.total.set(result.totalElements);
        this.page.set(result.page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
