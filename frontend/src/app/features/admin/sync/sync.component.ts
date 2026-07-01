import { Component } from '@angular/core';
import { ClientSyncResult, OdooSyncResult, SyncService } from '../../../core/services/sync.service';

type SyncStep = 'clients' | 'odoo' | null;

@Component({
  selector: 'app-sync',
  templateUrl: './sync.component.html',
  styleUrl: './sync.component.scss',
})
export class SyncComponent {
  loading = false;
  currentStep: SyncStep = null;
  clientsResult: ClientSyncResult | null = null;
  odooResult: OdooSyncResult | null = null;
  error = '';

  constructor(private syncService: SyncService) {}

  runSync(): void {
    this.loading = true;
    this.error = '';
    this.clientsResult = null;
    this.odooResult = null;
    this.currentStep = 'clients';

    this.syncService.syncClients().subscribe({
      next: (result) => {
        this.clientsResult = result;
        this.currentStep = 'odoo';
        this.syncService.syncOdooPartners().subscribe({
          next: (odoo) => {
            this.odooResult = odoo;
            this.currentStep = null;
            this.loading = false;
          },
          error: (err) => {
            this.error = err?.error?.message ?? 'Error al sincronizar partners de Odoo';
            this.currentStep = null;
            this.loading = false;
          },
        });
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Error al sincronizar clientes desde InfraDoc';
        this.currentStep = null;
        this.loading = false;
      },
    });
  }
}
