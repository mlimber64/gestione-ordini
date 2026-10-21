import { Component, OnInit, inject, signal } from '@angular/core';
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
import { CustomersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { CustomerStatus, CustomerSummary } from '../../core/models';

@Component({
  selector: 'app-customer-list',
  imports: [
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
        <h1>Clienti</h1>
        @if (auth.canWrite()) {
          <a mat-flat-button routerLink="/clienti/nuovo"><mat-icon>add</mat-icon>Nuovo cliente</a>
        }
      </div>

      <div class="filters">
        <mat-form-field>
          <mat-label>Cerca per nome, codice, email o P.IVA</mat-label>
          <input matInput [formControl]="query" />
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Stato</mat-label>
          <mat-select [formControl]="status">
            <mat-option value="">Tutti</mat-option>
            <mat-option value="ACTIVE">Attivi</mat-option>
            <mat-option value="BLOCKED">Bloccati</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <div class="table-card">
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Codice</th>
            <td mat-cell *matCellDef="let c">{{ c.code }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nome</th>
            <td mat-cell *matCellDef="let c">{{ c.name }}</td>
          </ng-container>
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let c">{{ c.email }}</td>
          </ng-container>
          <ng-container matColumnDef="vat">
            <th mat-header-cell *matHeaderCellDef>Partita IVA</th>
            <td mat-cell *matCellDef="let c">{{ c.vatNumber ?? '–' }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Stato</th>
            <td mat-cell *matCellDef="let c">
              <span class="chip" [class]="c.status === 'ACTIVE' ? 'ok' : 'bad'">{{
                c.status === 'ACTIVE' ? 'Attivo' : 'Bloccato'
              }}</span>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" class="clickable" (click)="open(row)"></tr>
        </table>
        @if (!loading() && rows().length === 0) {
          <p class="empty">Nessun cliente trovato.</p>
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
export class CustomerList implements OnInit {
  private readonly api = inject(CustomersApi);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly columns = ['code', 'name', 'email', 'vat', 'status'];
  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly status = new FormControl<CustomerStatus | ''>('', { nonNullable: true });
  protected size = 20;

  protected readonly rows = signal<CustomerSummary[]>([]);
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
    this.reload(0);
  }

  protected onPage(event: PageEvent): void {
    this.size = event.pageSize;
    this.reload(event.pageIndex);
  }

  protected open(customer: CustomerSummary): void {
    void this.router.navigate(['/clienti', customer.id]);
  }

  private reload(page: number): void {
    this.loading.set(true);
    this.api.search(this.query.value.trim(), this.status.value, { page, size: this.size, sort: 'name' }).subscribe({
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
