import { Component, Input } from '@angular/core';
import { CycleStats } from '../../../core/models/task.models';

@Component({
  selector: 'app-kpi-strip',
  templateUrl: './kpi-strip.component.html',
  styleUrl: './kpi-strip.component.scss',
})
export class KpiStripComponent {
  @Input() stats!: CycleStats;
  @Input() closed = false;

  get progressPct(): number {
    if (!this.stats?.assigned) return 0;
    return Math.round((this.stats.done / this.stats.assigned) * 100);
  }
}
