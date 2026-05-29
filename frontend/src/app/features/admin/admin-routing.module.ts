import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { UsersComponent } from './users/users.component';
import { TechniciansComponent } from './technicians/technicians.component';
import { TasksComponent } from './tasks/tasks.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'users',        component: UsersComponent       },
      { path: 'technicians',  component: TechniciansComponent },
      { path: 'tasks',        component: TasksComponent       },
      { path: '',             redirectTo: 'tasks', pathMatch: 'full' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
