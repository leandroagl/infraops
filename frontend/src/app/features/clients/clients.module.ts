import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AgGridModule } from 'ag-grid-angular';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientOverviewComponent } from './client-overview/client-overview.component';
import { ClientMantenimientosComponent } from './client-mantenimientos/client-mantenimientos.component';

@NgModule({
  declarations: [
    ClientsListComponent,
    ClientDetailComponent,
    ClientOverviewComponent,
    ClientMantenimientosComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    AgGridModule,
    ClientsRoutingModule,
  ],
})
export class ClientsModule {}
