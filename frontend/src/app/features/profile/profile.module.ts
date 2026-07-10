// frontend/src/app/features/profile/profile.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedModule } from '../../shared/shared.module';

import { ProfileComponent } from './profile.component';

const routes: Routes = [{ path: '', component: ProfileComponent }];

@NgModule({
  declarations: [ProfileComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    SharedModule,
  ],
})
export class ProfileModule {}
