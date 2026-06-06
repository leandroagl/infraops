import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { LocalDatePipe } from './pipes/local-date.pipe';

@NgModule({
  declarations: [LocalDatePipe, ConfirmDialogComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  exports: [LocalDatePipe, ConfirmDialogComponent],
})
export class SharedModule {}
