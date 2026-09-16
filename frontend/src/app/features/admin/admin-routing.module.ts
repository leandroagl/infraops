import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { UsersComponent } from './users/users.component';
import { SyncComponent } from './sync/sync.component';
import { IntegracionesComponent } from './integraciones/integraciones.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'users',          component: UsersComponent         },
      { path: 'sync',           component: SyncComponent          },
      { path: 'integraciones',  component: IntegracionesComponent },
      { path: 'tasks',          redirectTo: '/tasks',             pathMatch: 'full' },
      { path: '',               redirectTo: 'users',              pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
