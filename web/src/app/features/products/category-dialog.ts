import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CatalogApi } from '../../core/api';
import { errorMessage } from '../../core/errors';
import { Category } from '../../core/models';

/** Elenco delle categorie con l'aggiunta di una nuova (anche sotto un'altra categoria). */
@Component({
  selector: 'app-category-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Categorie</h2>
    <mat-dialog-content class="content">
      <ul>
        @for (c of categories(); track c.id) {
          <li>{{ path(c) }}</li>
        } @empty {
          <li class="muted">Nessuna categoria.</li>
        }
      </ul>
      <form [formGroup]="form" (ngSubmit)="add()">
        <mat-form-field>
          <mat-label>Nuova categoria</mat-label>
          <input matInput formControlName="name" />
          <mat-error>Obbligatorio</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Dentro la categoria (facoltativo)</mat-label>
          <mat-select formControlName="parentId">
            <mat-option [value]="null">Nessuna: categoria principale</mat-option>
            @for (c of categories(); track c.id) {
              <mat-option [value]="c.id">{{ path(c) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-flat-button type="submit">Aggiungi</button>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Chiudi</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      min-width: min(440px, 80vw);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
    }
    mat-form-field {
      width: 100%;
    }
    ul {
      margin: 0 0 16px;
      padding-left: 20px;
    }
  `,
})
export class CategoryDialog {
  private readonly api = inject(CatalogApi);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly categories = signal<Category[]>(inject<Category[]>(MAT_DIALOG_DATA));

  protected readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    parentId: [null as string | null],
  });

  /** Percorso completo, per esempio "Cancelleria › Penne". */
  protected path(category: Category): string {
    const byId = new Map(this.categories().map((c) => [c.id, c]));
    const names: string[] = [];
    for (let c: Category | undefined = category; c; c = c.parentId ? byId.get(c.parentId) : undefined) {
      names.unshift(c.name);
    }
    return names.join(' › ');
  }

  protected add(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { name, parentId } = this.form.getRawValue();
    this.api.createCategory(name!.trim(), parentId).subscribe({
      next: (created) => {
        this.categories.update((current) => [...current, created]);
        this.form.reset({ name: '', parentId: null });
      },
      error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi', { duration: 8000 }),
    });
  }
}
