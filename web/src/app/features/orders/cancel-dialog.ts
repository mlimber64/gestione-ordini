import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-cancel-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Annulla ordine</h2>
    <form [formGroup]="form" (ngSubmit)="confirm()">
      <mat-dialog-content class="content">
        <p>La merce riservata tornerà disponibile. L'operazione non si può annullare.</p>
        <mat-form-field>
          <mat-label>Motivo</mat-label>
          <input matInput formControlName="reason" maxlength="300" />
          <mat-error>Indica il motivo dell'annullamento</mat-error>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Indietro</button>
        <button mat-flat-button type="submit">Annulla l'ordine</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      min-width: min(420px, 80vw);
    }
  `,
})
export class CancelDialog {
  private readonly ref = inject<MatDialogRef<CancelDialog, string>>(MatDialogRef);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(300), Validators.pattern(/\S/)]],
  });

  protected confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) this.ref.close(this.form.getRawValue().reason.trim());
  }
}
