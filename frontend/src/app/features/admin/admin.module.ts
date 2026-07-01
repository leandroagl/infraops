import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { UsersComponent } from './users/users.component';
import { UserFormDialogComponent } from './users/user-form-dialog/user-form-dialog.component';
import { PasswordDisplayDialogComponent } from './users/password-display-dialog/password-display-dialog.component';
import { TechniciansComponent } from './technicians/technicians.component';
import { AssignTechnicianDialogComponent } from './technicians/assign-technician-dialog/assign-technician-dialog.component';
import { TasksComponent } from './tasks/tasks.component';
import { TaskCreateDialogComponent } from './tasks/task-create-dialog/task-create-dialog.component';
import { AdminTaskDrawerComponent } from './tasks/admin-task-drawer/admin-task-drawer.component';
import { SyncComponent } from './sync/sync.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    AdminLayoutComponent,
    UsersComponent,
    UserFormDialogComponent,
    PasswordDisplayDialogComponent,
    TechniciansComponent,
    AssignTechnicianDialogComponent,
    TasksComponent,
    TaskCreateDialogComponent,
    AdminTaskDrawerComponent,
    SyncComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTableModule,
    MatSortModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    AdminRoutingModule,
    SharedModule,
  ],
})
export class AdminModule {}
