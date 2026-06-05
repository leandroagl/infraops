import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalDatePipe } from './pipes/local-date.pipe';

@NgModule({
  declarations: [LocalDatePipe],
  imports: [CommonModule],
  exports: [LocalDatePipe],
})
export class SharedModule {}
