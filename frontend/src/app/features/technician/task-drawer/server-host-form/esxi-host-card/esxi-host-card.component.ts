import { Component, EventEmitter, Input, Output } from '@angular/core';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { VmwareHealthResult } from '../../../../../core/models/maintenance-log.models';
import { resolveVmwareUri } from '../../../utils/vmware-uri';

@Component({
  selector: 'app-esxi-host-card',
  templateUrl: './esxi-host-card.component.html',
  styleUrl: './esxi-host-card.component.scss',
})
export class EsxiHostCardComponent {
  @Input() host!: InfraAsset;
  @Input() result: VmwareHealthResult | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() readOnly = false;
  @Output() runCheck = new EventEmitter<string>();

  get vmwareUri(): string | null {
    return resolveVmwareUri(this.host);
  }

  get canRun(): boolean {
    return !!this.vmwareUri && !this.loading && !this.readOnly;
  }

  onRunClick(): void {
    const uri = this.vmwareUri;
    if (uri) this.runCheck.emit(uri);
  }

  statusBadgeClass(status: 'green' | 'yellow' | 'red'): string {
    if (status === 'red')    return 'badge--crit';
    if (status === 'yellow') return 'badge--warn';
    return 'badge--ok';
  }

  datastoreClass(usedPct: number, accessible: boolean): string {
    if (!accessible)     return 'metric--crit';
    if (usedPct > 85)    return 'metric--crit';
    if (usedPct > 70)    return 'metric--warn';
    return 'metric--ok';
  }

  snapshotClass(oldestDays: number): string {
    if (oldestDays > 90) return 'badge--crit';
    if (oldestDays > 30) return 'badge--warn';
    return 'badge--ok';
  }
}
