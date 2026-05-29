import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TechnicianRoutingModule } from './technician-routing.module';
import { TaskListComponent } from './task-list/task-list.component';
import { TaskDrawerComponent } from './task-drawer/task-drawer.component';

@NgModule({
  declarations: [TaskListComponent, TaskDrawerComponent],
  imports: [CommonModule, TechnicianRoutingModule],
})
export class TechnicianModule {}
