import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminRoutingModule } from './admin-routing.module';
import { UsersComponent } from './users/users.component';
import { UserFormDialogComponent } from './users/user-form-dialog/user-form-dialog.component';
import { PasswordDisplayDialogComponent } from './users/password-display-dialog/password-display-dialog.component';

@NgModule({
  declarations: [UsersComponent, UserFormDialogComponent, PasswordDisplayDialogComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    AdminRoutingModule,
  ],
})
export class AdminModule {}
