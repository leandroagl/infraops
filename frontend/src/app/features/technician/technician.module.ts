import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { TechnicianRoutingModule } from './technician-routing.module';
import { TaskListComponent } from './task-list/task-list.component';
import { TaskDrawerComponent } from './task-drawer/task-drawer.component';
import { MaintenanceFormComponent } from './task-drawer/maintenance-form/maintenance-form.component';
import { ConfirmMaintenanceDialogComponent } from './task-drawer/confirm-maintenance-dialog/confirm-maintenance-dialog.component';
import { TimeSpentDialogComponent } from './task-drawer/time-spent-dialog/time-spent-dialog.component';
import { DcHealthCardComponent } from './task-drawer/maintenance-form/dc-health-card/dc-health-card.component';
import { QnapFormComponent } from './task-drawer/qnap-form/qnap-form.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [TaskListComponent, TaskDrawerComponent, MaintenanceFormComponent, ConfirmMaintenanceDialogComponent, TimeSpentDialogComponent, DcHealthCardComponent, QnapFormComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatSnackBarModule,
    TechnicianRoutingModule,
    SharedModule,
    TextFieldModule,
  ],
})
export class TechnicianModule {}
