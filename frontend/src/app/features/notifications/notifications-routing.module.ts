import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotificationsComponent } from './notifications.component';
import { NotificationsConfigComponent } from './config/notifications-config.component';

const routes: Routes = [
  { path: '', component: NotificationsComponent },
  { path: 'config', component: NotificationsConfigComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NotificationsRoutingModule {}
