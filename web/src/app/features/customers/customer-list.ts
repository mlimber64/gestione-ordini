import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CustomersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { CustomerStatus, CustomerSummary } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';
import { TableSkeleton } from '../../shared/table-skeleton';
import { errorMessage } from '../../core/errors';
import { CustomerDialog, CustomerDialogResult } from './customer-dialog';

@Component({
  selector: 'app-customer-list',
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    EmptyState,
    TableSkeleton,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Clienti</h1>
          <p class="page-sub">{{ total() }} clienti in totale</p>
        </div>
        @if (auth.canWrite()) {
          <button mat-flat-button (click)="create()"><mat-icon>add</mat-icon>Nuovo cliente</button>
        }
      </div>

      <div class="table-card">
        <div class="toolbar">
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
        @if (loading() && rows().length === 0) {
          <app-table-skeleton [cols]="4" />
        }
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="code">
            <th mat-header-cell *matHeaderCellDef>Codice</th>
            <td mat-cell *matCellDef="let c" class="muted">{{ c.code }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Cliente</th>
            <td mat-cell *matCellDef="let c">
              <span class="cell-who">
                <span class="avatar-sm" aria-hidden="true">{{ initials(c.name) }}</span>
                <span class="stack">
                  <strong>{{ c.name }}</strong>
                  <small class="muted">{{ c.email }}</small>
                </span>
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="vat">
            <th mat-header-cell *matHeaderCellDef>Partita IVA</th>
            <td mat-cell *matCellDef="let c" class="muted">{{ c.vatNumber ?? '–' }}</td>
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
          <app-empty-state icon="search_off" title="Nessun cliente trovato" message="Cambia la ricerca o il filtro per stato." />
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
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);

  protected readonly columns = ['name', 'code', 'vat', 'status'];
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

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('');
  }

  protected onPage(event: PageEvent): void {
    this.size = event.pageSize;
    this.reload(event.pageIndex);
  }

  protected create(): void {
    this.dialog
      .open<CustomerDialog, void, CustomerDialogResult>(CustomerDialog)
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.api.create(result.customer).subscribe({
          next: (saved) => {
            if (!result.address) return this.done(saved.id, 'Cliente registrato');
            this.api.addAddress(saved.id, result.address).subscribe({
              next: () => this.done(saved.id, 'Cliente registrato'),
              // Il cliente c'è: l'indirizzo si potrà aggiungere dalla sua scheda
              error: () => this.done(saved.id, "Cliente registrato, ma l'indirizzo non è stato salvato"),
            });
          },
          error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi', { duration: 8000 }),
        });
      });
  }

  private done(id: string, message: string): void {
    this.snackBar.open(message);
    void this.router.navigate(['/clienti', id]);
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
