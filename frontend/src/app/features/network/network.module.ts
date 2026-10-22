import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NetworkRoutingModule } from './network-routing.module';
import { NetworkComponent } from './network.component';
import { NetworkAlertDrawerComponent } from './components/network-alert-drawer/network-alert-drawer.component';

@NgModule({
  declarations: [NetworkComponent, NetworkAlertDrawerComponent],
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatProgressBarModule, MatIconModule, MatSnackBarModule,
    NetworkRoutingModule,
  ],
})
export class NetworkModule {}
