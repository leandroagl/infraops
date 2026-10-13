import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { concatMap } from 'rxjs';
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

  private readonly destroyRef = inject(DestroyRef);

  constructor(private syncService: SyncService) {}

  runSync(): void {
    this.loading = true;
    this.error = '';
    this.clientsResult = null;
    this.odooResult = null;
    this.currentStep = 'clients';

    this.syncService.syncClients().pipe(
      concatMap(result => {
        this.clientsResult = result;
        this.currentStep = 'odoo';
        return this.syncService.syncOdooPartners();
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (odoo) => {
        this.odooResult = odoo;
        this.currentStep = null;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Error al sincronizar';
        this.currentStep = null;
        this.loading = false;
      },
    });
  }
}
