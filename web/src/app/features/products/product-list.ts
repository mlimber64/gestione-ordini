import { CurrencyPipe } from '@angular/common';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CatalogApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { Category, Product, ProductInput } from '../../core/models';
import { EmptyState } from '../../shared/empty-state';
import { TableSkeleton } from '../../shared/table-skeleton';
import { CategoryDialog } from './category-dialog';
import { ProductDialog, ProductDialogData } from './product-dialog';

@Component({
  selector: 'app-product-list',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    EmptyState,
    TableSkeleton,
  ],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-title">
          <h1>Prodotti</h1>
          <p class="page-sub">{{ total() }} prodotti in totale</p>
        </div>
        @if (auth.isAdmin()) {
          <button mat-stroked-button (click)="manageCategories()"><mat-icon>folder</mat-icon>Categorie</button>
          <button mat-flat-button (click)="edit(null)"><mat-icon>add</mat-icon>Nuovo prodotto</button>
        }
      </div>

      <div class="table-card">
        <div class="toolbar">
          <mat-form-field>
            <mat-label>Cerca per nome o SKU</mat-label>
            <input matInput [formControl]="query" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Categoria</mat-label>
            <mat-select [formControl]="category">
              <mat-option value="">Tutte</mat-option>
              @for (c of categories(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Stato</mat-label>
            <mat-select [formControl]="active">
              <mat-option value="">Tutti</mat-option>
              <mat-option [value]="true">Attivi</mat-option>
              <mat-option [value]="false">Disattivati</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        @if (loading() && rows().length === 0) {
          <app-table-skeleton [cols]="6" />
        }
        <table mat-table [dataSource]="rows()">
          <ng-container matColumnDef="sku">
            <th mat-header-cell *matHeaderCellDef>SKU</th>
            <td mat-cell *matCellDef="let p" class="muted">{{ p.sku }}</td>
          </ng-container>
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Nome</th>
            <td mat-cell *matCellDef="let p"><strong>{{ p.name }}</strong></td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>Categoria</th>
            <td mat-cell *matCellDef="let p"><span class="chip">{{ p.categoryName }}</span></td>
          </ng-container>
          <ng-container matColumnDef="price">
            <th mat-header-cell *matHeaderCellDef class="num">Prezzo</th>
            <td mat-cell *matCellDef="let p" class="num"><strong>{{ p.unitPrice | currency: 'EUR' }}</strong></td>
          </ng-container>
          <ng-container matColumnDef="vat">
            <th mat-header-cell *matHeaderCellDef class="num">IVA</th>
            <td mat-cell *matCellDef="let p" class="num muted">{{ p.vatRate }}%</td>
          </ng-container>
          <ng-container matColumnDef="active">
            <th mat-header-cell *matHeaderCellDef>Attivo</th>
            <td mat-cell *matCellDef="let p">
              <mat-slide-toggle
                hideIcon
                [checked]="p.active"
                [disabled]="!auth.isAdmin()"
                (change)="toggle(p, $event.checked)"
                [attr.aria-label]="'Attiva o disattiva ' + p.name"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let p">
              @if (auth.isAdmin()) {
                <button mat-icon-button (click)="edit(p)" aria-label="Modifica"><mat-icon>edit</mat-icon></button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
        @if (!loading() && rows().length === 0) {
          <app-empty-state icon="search_off" title="Nessun prodotto trovato" message="Cambia la ricerca o i filtri." />
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
export class ProductList implements OnInit {
  private readonly api = inject(CatalogApi);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly auth = inject(AuthService);

  protected readonly columns = ['sku', 'name', 'category', 'price', 'vat', 'active', 'actions'];
  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly category = new FormControl('', { nonNullable: true });
  protected readonly active = new FormControl<boolean | ''>('', { nonNullable: true });
  protected size = 20;

  protected readonly rows = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(0);
  protected readonly loading = signal(false);

  constructor() {
    this.query.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(0));
    this.category.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.reload(0));
    this.active.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.reload(0));
  }

  ngOnInit(): void {
    this.api.categories().subscribe((categories) => this.categories.set(categories));
    this.reload(0);
  }

  protected onPage(event: PageEvent): void {
    this.size = event.pageSize;
    this.reload(event.pageIndex);
  }

  protected edit(product: Product | null): void {
    this.dialog
      .open<ProductDialog, ProductDialogData, ProductInput>(ProductDialog, {
        data: { product, categories: this.categories() },
      })
      .afterClosed()
      .subscribe((input) => {
        if (!input) return;
        const request = product ? this.api.updateProduct(product.id, input) : this.api.createProduct(input);
        request.subscribe({
          next: () => {
            this.snackBar.open('Prodotto salvato');
            this.reload(this.page());
          },
          error: (error: unknown) => this.fail(error),
        });
      });
  }

  protected toggle(product: Product, active: boolean): void {
    this.api.setProductActive(product.id, active).subscribe({
      next: () => this.reload(this.page()),
      error: (error: unknown) => {
        this.fail(error);
        this.reload(this.page());
      },
    });
  }

  protected manageCategories(): void {
    this.dialog
      .open(CategoryDialog, { data: this.categories() })
      .afterClosed()
      .subscribe(() => this.api.categories().subscribe((categories) => this.categories.set(categories)));
  }

  private reload(page: number): void {
    this.loading.set(true);
    this.api
      .products(this.query.value.trim(), this.category.value, this.active.value, { page, size: this.size, sort: 'name' })
      .subscribe({
        next: (result) => {
          this.rows.set(result.content);
          this.total.set(result.totalElements);
          this.page.set(result.page);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private fail(error: unknown): void {
    this.snackBar.open(errorMessage(error), 'Chiudi', { duration: 8000 });
  }
}
