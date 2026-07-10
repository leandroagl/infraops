import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LoginComponent } from './login/login.component';
import { ChangePasswordComponent } from './change-password/change-password.component';
import { OdooSetupComponent } from './odoo-setup/odoo-setup.component';

const routes: Routes = [
  { path: '',                component: LoginComponent },
  { path: 'change-password', component: ChangePasswordComponent },
  { path: 'odoo-setup',      component: OdooSetupComponent },
];

@NgModule({
  declarations: [LoginComponent, ChangePasswordComponent, OdooSetupComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
})
export class AuthModule {}
