import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientOverviewComponent } from './client-overview/client-overview.component';
import { ClientMantenimientosComponent } from './client-mantenimientos/client-mantenimientos.component';

const routes: Routes = [
  { path: '', component: ClientsListComponent },
  {
    path: ':id',
    component: ClientDetailComponent,
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: ClientOverviewComponent },
      { path: 'mantenimientos', component: ClientMantenimientosComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ClientsRoutingModule {}
