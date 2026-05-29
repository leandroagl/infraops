import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { TechnicianRoutingModule } from './technician-routing.module';
import { TaskListComponent } from './task-list/task-list.component';
import { TaskDrawerComponent } from './task-drawer/task-drawer.component';
import { MaintenanceFormComponent } from './task-drawer/maintenance-form/maintenance-form.component';

@NgModule({
  declarations: [TaskListComponent, TaskDrawerComponent, MaintenanceFormComponent],
  imports: [CommonModule, ReactiveFormsModule, TechnicianRoutingModule],
})
export class TechnicianModule {}
