import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { AdminOrTlGuard } from './core/guards/admin-or-tl.guard';
import { ShellComponent } from './core/shell/shell.component';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () =>
      import('./features/auth/auth.module').then(m => m.AuthModule),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.module').then(m => m.DashboardModule),
      },
      {
        path: 'clients',
        loadChildren: () =>
          import('./features/clients/clients.module').then(m => m.ClientsModule),
      },
      {
        path: 'tasks',
        loadChildren: () =>
          import('./features/tasks/tasks.module').then(m => m.TasksModule),
      },
      {
        path: 'notifications',
        loadChildren: () =>
          import('./features/notifications/notifications.module').then(m => m.NotificationsModule),
      },
      {
        path: 'admin',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./features/admin/admin.module').then(m => m.AdminModule),
      },
      {
        path: 'schedules',
        canActivate: [AdminOrTlGuard],
        loadChildren: () =>
          import('./features/schedules/schedules.module').then(m => m.SchedulesModule),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('./features/profile/profile.module').then(m => m.ProfileModule),
      },
      {
        path: 'docs',
        loadChildren: () =>
          import('./features/docs/docs.module').then(m => m.DocsModule),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
