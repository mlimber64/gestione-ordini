import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Category, Product, ProductInput } from '../../core/models';
import { DialogHeader } from '../../shared/dialog-header';

export interface ProductDialogData {
  product: Product | null;
  categories: Category[];
}

@Component({
  selector: 'app-product-dialog',
  imports: [DialogHeader, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <app-dialog-header icon="category" [title]="data.product ? 'Modifica prodotto' : 'Nuovo prodotto'" />
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="content">
        <mat-form-field>
          <mat-label>SKU</mat-label>
          <input matInput formControlName="sku" />
          <mat-hint>Lettere, numeri, punto, trattino. Non modificabile dopo la creazione.</mat-hint>
          <mat-error>SKU obbligatorio (solo lettere, numeri, . - _)</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Nome</mat-label>
          <input matInput formControlName="name" />
          <mat-error>Obbligatorio</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Descrizione</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Categoria</mat-label>
          <mat-select formControlName="categoryId">
            @for (c of data.categories; track c.id) {
              <mat-option [value]="c.id">{{ c.name }}</mat-option>
            }
          </mat-select>
          <mat-error>Scegli una categoria</mat-error>
        </mat-form-field>
        <div class="row">
          <mat-form-field>
            <mat-label>Prezzo (€, IVA esclusa)</mat-label>
            <input matInput type="number" step="0.01" min="0" formControlName="unitPrice" />
            <mat-error>Prezzo non valido</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Aliquota IVA</mat-label>
            <mat-select formControlName="vatRate">
              <mat-option [value]="22">22%</mat-option>
              <mat-option [value]="10">10%</mat-option>
              <mat-option [value]="4">4%</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: min(480px, 80vw);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
  `,
})
export class ProductDialog {
  protected readonly data = inject<ProductDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ProductDialog, ProductInput>>(MatDialogRef);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    sku: [
      { value: this.data.product?.sku ?? '', disabled: !!this.data.product },
      [Validators.required, Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9._-]+$/)],
    ],
    name: [this.data.product?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    description: [this.data.product?.description ?? ''],
    categoryId: [this.data.product?.categoryId ?? '', Validators.required],
    unitPrice: [this.data.product?.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
    vatRate: [this.data.product?.vatRate ?? 22, Validators.required],
  });

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.ref.close({
      sku: value.sku.trim(),
      name: value.name.trim(),
      description: value.description.trim() || null,
      categoryId: value.categoryId,
      unitPrice: Number(value.unitPrice),
      vatRate: Number(value.vatRate),
    });
  }
}
