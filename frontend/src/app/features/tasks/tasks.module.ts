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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TasksRoutingModule } from './tasks-routing.module';
import { TasksUnifiedComponent } from './tasks-unified.component';
import { KpiStripComponent } from './kpi-strip/kpi-strip.component';
import { CycleTableComponent } from './cycle-table/cycle-table.component';
import { SharedModule } from '../../shared/shared.module';
import { TaskDrawerComponent } from '../technician/task-drawer/task-drawer.component';
import { MaintenanceFormComponent } from '../technician/task-drawer/maintenance-form/maintenance-form.component';
import { ConfirmMaintenanceDialogComponent } from '../technician/task-drawer/confirm-maintenance-dialog/confirm-maintenance-dialog.component';
import { TimeSpentDialogComponent } from '../technician/task-drawer/time-spent-dialog/time-spent-dialog.component';
import { DcHealthCardComponent } from '../technician/task-drawer/maintenance-form/dc-health-card/dc-health-card.component';
import { QnapFormComponent } from '../technician/task-drawer/qnap-form/qnap-form.component';
import { QnapDeviceCardComponent } from '../technician/task-drawer/qnap-form/qnap-device-card/qnap-device-card.component';
import { VeeamFormComponent } from '../technician/task-drawer/veeam-form/veeam-form.component';
import { ServerHostFormComponent } from '../technician/task-drawer/server-host-form/server-host-form.component';
import { RouterFormComponent } from '../technician/task-drawer/router-form/router-form.component';
import { RouterDeviceCardComponent } from '../technician/task-drawer/router-form/router-device-card/router-device-card.component';
import { EsxiHostCardComponent } from '../technician/task-drawer/server-host-form/esxi-host-card/esxi-host-card.component';
import { TaskCreateDialogComponent } from '../admin/tasks/task-create-dialog/task-create-dialog.component';

@NgModule({
  declarations: [
    TasksUnifiedComponent,
    KpiStripComponent,
    CycleTableComponent,
    TaskDrawerComponent,
    MaintenanceFormComponent,
    ConfirmMaintenanceDialogComponent,
    TimeSpentDialogComponent,
    DcHealthCardComponent,
    QnapFormComponent,
    QnapDeviceCardComponent,
    VeeamFormComponent,
    ServerHostFormComponent,
    RouterFormComponent,
    RouterDeviceCardComponent,
    EsxiHostCardComponent,
    TaskCreateDialogComponent,
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TextFieldModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    TasksRoutingModule,
    SharedModule,
  ],
})
export class TasksModule {}
