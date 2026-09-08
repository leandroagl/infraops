import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientOverviewComponent } from './client-overview/client-overview.component';
import { ClientMantenimientosComponent } from './client-mantenimientos/client-mantenimientos.component';
import { SharedModule } from '../../shared/shared.module';

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
    MatButtonModule,
    MatTabsModule,
    ClientsRoutingModule,
    SharedModule,
  ],
})
export class ClientsModule {}
