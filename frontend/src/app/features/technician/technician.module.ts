import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TechnicianRoutingModule } from './technician-routing.module';
import { TaskListComponent } from './task-list/task-list.component';

@NgModule({
  declarations: [TaskListComponent],
  imports: [CommonModule, TechnicianRoutingModule],
})
export class TechnicianModule {}
