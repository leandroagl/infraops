import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsersComponent } from './users/users.component';
import { TechniciansComponent } from './technicians/technicians.component';

const routes: Routes = [
  { path: 'users', component: UsersComponent },
  { path: 'technicians', component: TechniciansComponent },
  { path: '', redirectTo: 'users', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
