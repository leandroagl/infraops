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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TechnicianRoutingModule } from './technician-routing.module';
import { TaskListComponent } from './task-list/task-list.component';
import { TaskDrawerComponent } from './task-drawer/task-drawer.component';
import { MaintenanceFormComponent } from './task-drawer/maintenance-form/maintenance-form.component';
import { ConfirmMaintenanceDialogComponent } from './task-drawer/confirm-maintenance-dialog/confirm-maintenance-dialog.component';
import { TimeSpentDialogComponent } from './task-drawer/time-spent-dialog/time-spent-dialog.component';
import { DcHealthCardComponent } from './task-drawer/maintenance-form/dc-health-card/dc-health-card.component';
import { QnapFormComponent } from './task-drawer/qnap-form/qnap-form.component';
import { QnapDeviceCardComponent } from './task-drawer/qnap-form/qnap-device-card/qnap-device-card.component';
import { VeeamFormComponent } from './task-drawer/veeam-form/veeam-form.component';
import { ServerHostFormComponent } from './task-drawer/server-host-form/server-host-form.component';
import { RouterFormComponent } from './task-drawer/router-form/router-form.component';
import { RouterDeviceCardComponent } from './task-drawer/router-form/router-device-card/router-device-card.component';
import { EsxiHostCardComponent } from './task-drawer/server-host-form/esxi-host-card/esxi-host-card.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [TaskListComponent, TaskDrawerComponent, MaintenanceFormComponent, ConfirmMaintenanceDialogComponent, TimeSpentDialogComponent, DcHealthCardComponent, QnapFormComponent, QnapDeviceCardComponent, VeeamFormComponent, ServerHostFormComponent, RouterFormComponent, RouterDeviceCardComponent, EsxiHostCardComponent],
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
    MatProgressSpinnerModule,
    TechnicianRoutingModule,
    SharedModule,
    TextFieldModule,
  ],
})
export class TechnicianModule {}
