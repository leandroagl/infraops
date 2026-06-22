import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

@Component({
  selector: 'app-qnap-device-card',
  templateUrl: './qnap-device-card.component.html',
  styleUrl: './qnap-device-card.component.scss',
})
export class QnapDeviceCardComponent {
  @Input() device!: InfraAsset;
  @Input() group!: FormGroup;
  @Input() readOnly = false;

  get spaceRatio(): number {
    const v = this.group.value;
    const total = Number(v.totalSpaceGB) * (v.totalSpaceUnit === 'TB' ? 1024 : 1);
    const used  = Number(v.usedSpaceGB)  * (v.usedSpaceUnit  === 'TB' ? 1024 : 1);
    return total ? (used / total) * 100 : 0;
  }

  get cardHealth(): 'ok' | 'warn' | 'crit' {
    const v = this.group.value;
    const ratio = this.spaceRatio;
    if (v.disksWithError?.length || v.raidStatus === 'failed' || ratio > 85) return 'crit';
    if (v.raidStatus === 'degraded' || ratio > 70) return 'warn';
    return 'ok';
  }

  get diskSlotOptions(): string[] {
    const count = Number(this.group.get('diskCount')?.value);
    if (!count || isNaN(count) || count <= 0) return [];
    return Array.from({ length: count }, (_, k) => `Disk ${k + 1}`);
  }

  get firmwareUpdated(): boolean {
    return this.group.get('firmwareUpdated')?.value === true;
  }

  raidBadgeClass(): string {
    const v = this.group.get('raidStatus')?.value;
    if (!v || v === 'ok')       return 'badge--ok';
    if (v === 'degraded')       return 'badge--warn';
    if (v === 'failed')         return 'badge--crit';
    return 'badge--neutral';
  }

  raidBadgeLabel(): string {
    const v = this.group.get('raidStatus')?.value;
    if (!v || v === 'ok')       return 'RAID: OK';
    if (v === 'degraded')       return 'RAID: Degradado';
    if (v === 'failed')         return 'RAID: Error';
    return 'RAID: —';
  }

  selectClass(value: string): string {
    if (!value || value === 'ok') return 'mf-sel--ok';
    if (value === 'degraded')     return 'mf-sel--warn';
    if (value === 'failed')       return 'mf-sel--crit';
    return '';
  }

  metricClass(value: number, warnThreshold: number, critThreshold: number): string {
    if (!value || isNaN(value))         return '';
    if (value >= critThreshold)         return 'mf-inp--crit';
    if (value >= warnThreshold)         return 'mf-inp--warn';
    return 'mf-inp--ok';
  }
}
