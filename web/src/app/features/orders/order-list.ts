import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { OrdersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from '../../core/labels';
import { OrderStatus, OrderSummary } from '../../core/models';

@Component({
  selector: 'app-order-list',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Ordini</h1>
        @if (auth.canWrite()) {
          <a mat-flat-button routerLink="/ordini/nuovo"><mat-icon>add</mat-icon>Nuovo ordine</a>
        }
      </div>

      <div class="filters">
        <mat-form-field>
          <mat-label>Cerca per numero d'ordine</mat-label>
          <input matInput [formControl]="query" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Stato</mat-label>
          <mat-select [formControl]="status">
            <mat-option value="">Tutti</mat-option>
            @for (s of statuses; track s) {
              <mat-option [value]="s">{{ label[s] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <div class="table-card">
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="number">
            <th mat-header-cell *matHeaderCellDef>Numero</th>
            <td mat-cell *matCellDef="let o">
              <strong>{{ o.number }}</strong>
            </td>
          </ng-container>
          <ng-container matColumnDef="customer">
            <th mat-header-cell *matHeaderCellDef>Cliente</th>
            <td mat-cell *matCellDef="let o">{{ o.customerName }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Stato</th>
            <td mat-cell *matCellDef="let o">
              <span class="chip" [class]="cls[o.status]">{{ label[o.status] }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef class="num">Totale</th>
            <td mat-cell *matCellDef="let o" class="num">{{ o.totalGross | currency: 'EUR' }}</td>
          </ng-container>
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Data</th>
            <td mat-cell *matCellDef="let o">{{ o.createdAt | date: 'dd/MM/yyyy HH:mm' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" class="clickable" (click)="open(row)"></tr>
        </table>
        @if (!loading() && rows().length === 0) {
          <p class="empty">Nessun ordine trovato.</p>
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
export class OrderList implements OnInit {
  /** Filtro iniziale dalla query string, per esempio {@code /ordini?stato=PENDING} dal cruscotto. */
  readonly stato = input<OrderStatus | ''>('');

  private readonly api = inject(OrdersApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly columns = ['number', 'customer', 'status', 'total', 'date'];
  protected readonly statuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  protected readonly label: Record<string, string> = ORDER_STATUS_LABEL;
  protected readonly cls: Record<string, string> = ORDER_STATUS_CLASS;
  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly status = new FormControl<OrderStatus | ''>('', { nonNullable: true });
  protected size = 20;

  protected readonly rows = signal<OrderSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly loading = signal(false);

  constructor() {
    this.query.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(0));
    this.status.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.reload(0));
  }

  ngOnInit(): void {
    if (this.statuses.includes(this.stato() as OrderStatus)) this.status.setValue(this.stato(), { emitEvent: false });
    this.reload(0);
  }

  protected onPage(event: PageEvent): void {
    this.size = event.pageSize;
    this.reload(event.pageIndex);
  }

  protected open(order: OrderSummary): void {
    void this.router.navigate(['/ordini', order.id]);
  }

  private reload(page: number): void {
    this.loading.set(true);
    this.api.search({ status: this.status.value, q: this.query.value.trim() }, { page, size: this.size }).subscribe({
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
