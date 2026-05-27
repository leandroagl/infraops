import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { ShellComponent } from './shell.component';

@NgModule({
  declarations: [ShellComponent],
  imports: [CommonModule, RouterModule],
  exports: [ShellComponent],
})
export class ShellModule {}
