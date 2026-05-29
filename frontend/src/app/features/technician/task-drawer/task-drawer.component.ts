import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Task, TaskType } from '../../../core/models/task.models';
import { ClientInfrastructure, InfraAsset } from '../../../core/models/infradoc.models';
import { InfradocService } from '../../../core/services/infradoc.service';

@Component({
  selector: 'app-task-drawer',
  templateUrl: './task-drawer.component.html',
  styleUrl: './task-drawer.component.scss',
})
export class TaskDrawerComponent implements OnChanges {
  @Input() task!: Task;

  infrastructure: ClientInfrastructure | null = null;
  loadingInfra = false;
  infraError = '';

  expandedServerId: number | null = null;

  constructor(private infradocService: InfradocService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task) {
      this.loadInfrastructure();
    }
  }

  private loadInfrastructure(): void {
    this.infrastructure = null;
    this.infraError = '';
    this.loadingInfra = true;
    this.expandedServerId = null;

    this.infradocService.getClientInfrastructure(this.task.clientId).subscribe({
      next: data => { this.infrastructure = data; this.loadingInfra = false; },
      error: () => { this.infraError = 'No se pudo cargar la infraestructura del cliente.'; this.loadingInfra = false; },
    });
  }

  toggleServer(assetId: number): void {
    this.expandedServerId = this.expandedServerId === assetId ? null : assetId;
  }

  isExpanded(assetId: number): boolean {
    return this.expandedServerId === assetId;
  }

  get hasInfra(): boolean {
    if (!this.infrastructure) return false;
    const { servers, vms, nas, routers } = this.infrastructure;
    return servers.length + vms.length + nas.length + routers.length > 0;
  }

  typeLabel(type: TaskType): string {
    const labels: Record<TaskType, string> = {
      SERVER_MAINTENANCE:   'Mantenimiento de servidores',
      TERMINAL_MAINTENANCE: 'Visita de terminales',
      SITE_VISIT:           'Visita presencial',
      AV_CONTROL:           'Control antivirus',
      UPS_CONTROL:          'Control UPS',
      ENDPOINT_INVENTORY:   'Inventario',
    };
    return labels[type];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'Pendiente', IN_PROGRESS: 'En curso',
      DONE: 'Listo', ESCALATED: 'Escalado', NOT_DONE: 'No realizado',
    };
    return labels[status] ?? status;
  }

  statusBadge(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'badge--neutral', IN_PROGRESS: 'badge--accent',
      DONE: 'badge--ok', ESCALATED: 'badge--warn', NOT_DONE: 'badge--crit',
    };
    return map[status] ?? 'badge--neutral';
  }

  trackByAssetId(_: number, asset: InfraAsset): number {
    return asset.assetId;
  }
}
