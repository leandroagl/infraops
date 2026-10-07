import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BackupsRoutingModule } from './backups-routing.module';
import { BackupsComponent } from './backups.component';
import { BackupClientCardComponent } from './components/backup-client-card/backup-client-card.component';
import { BackupClientDrawerComponent } from './components/backup-client-drawer/backup-client-drawer.component';

@NgModule({
  declarations: [
    BackupsComponent,
    BackupClientCardComponent,
    BackupClientDrawerComponent,
  ],
  imports: [
    CommonModule,
    BackupsRoutingModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
})
export class BackupsModule {}
