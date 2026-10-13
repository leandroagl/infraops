import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';

import { ShellComponent } from './shell.component';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [ShellComponent, NotificationBellComponent],
  imports: [CommonModule, RouterModule, MatBadgeModule, MatButtonModule, MatDividerModule, MatMenuModule, MatSidenavModule, MatToolbarModule, SharedModule],
  exports: [ShellComponent],
})
export class ShellModule {}
