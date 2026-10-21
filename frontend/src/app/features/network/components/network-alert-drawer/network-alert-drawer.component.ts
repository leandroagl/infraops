import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NetworkService } from '../../../../core/services/network.service';
import type { NetworkAlert } from '../../../../core/models/network.models';

@Component({
  selector: 'app-network-alert-drawer',
  templateUrl: './network-alert-drawer.component.html',
  styleUrl: './network-alert-drawer.component.scss',
})
export class NetworkAlertDrawerComponent {
  @Input() alert!: NetworkAlert;
  @Output() drawerClosed  = new EventEmitter<void>();
  @Output() ticketCreated = new EventEmitter<NetworkAlert>();

  creatingTicket = false;
  helpdeskTeamId: number | null = null;

  constructor(
    private readonly svc: NetworkService,
    private readonly snackBar: MatSnackBar,
  ) {}

  createTicket(): void {
    if (!this.helpdeskTeamId) {
      this.snackBar.open('Ingresá el ID del equipo Odoo', 'Cerrar', { duration: 3000 });
      return;
    }
    this.creatingTicket = true;
    this.svc.createTicket(this.alert.alertId, {
      helpdeskTeamId: this.helpdeskTeamId,
      tagIds: [],
      clientId: this.alert.clientId,
      siteId: this.alert.siteId,
    }).subscribe({
      next: res => {
        this.snackBar.open(`Ticket #${res.odooTicketId} creado en Odoo`, 'Cerrar', { duration: 4000 });
        this.ticketCreated.emit({ ...this.alert, odooTicketId: res.odooTicketId });
        this.creatingTicket = false;
      },
      error: err => {
        const msg = (err?.error?.message as string | undefined) ?? 'Error al crear ticket';
        this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
        this.creatingTicket = false;
      },
    });
  }
}
