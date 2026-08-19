import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { UsersComponent } from './users/users.component';
import { TechniciansComponent } from './technicians/technicians.component';
import { SyncComponent } from './sync/sync.component';
import { TaskConfigComponent } from './task-config/task-config.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'users',        component: UsersComponent       },
      { path: 'technicians',  component: TechniciansComponent },
      { path: 'sync',         component: SyncComponent        },
      { path: 'task-config',  component: TaskConfigComponent  },
      { path: 'tasks',        redirectTo: '/tasks', pathMatch: 'full' },
      { path: '',             redirectTo: 'users',  pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
