import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { UsersComponent } from './users/users.component';
import { SyncComponent } from './sync/sync.component';
import { IntegracionesComponent } from './integraciones/integraciones.component';
import { TaskConfigComponent } from './task-config/task-config.component';
import { NotificationsConfigComponent } from './notifications-config/notifications-config.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'users',            component: UsersComponent               },
      { path: 'sync',             component: SyncComponent                },
      { path: 'integraciones',    component: IntegracionesComponent       },
      { path: 'mantenimientos',   component: TaskConfigComponent          },
      { path: 'vencimientos',     component: NotificationsConfigComponent },
      { path: '',                 redirectTo: 'users',                    pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
