import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { TaskCardComponent } from './components/task-card/task-card.component';
import { LocalDatePipe } from './pipes/local-date.pipe';

@NgModule({
  declarations: [LocalDatePipe, ConfirmDialogComponent, TaskCardComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatCardModule],
  exports: [LocalDatePipe, ConfirmDialogComponent, TaskCardComponent],
})
export class SharedModule {}
