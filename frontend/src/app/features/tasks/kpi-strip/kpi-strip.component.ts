import { Component, Input } from '@angular/core';
import { CycleStats } from '../../../core/models/task.models';
import { daysUntilCycleClose, urgencyLabel } from '../../../shared/utils/urgency';

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

  /** Mismo indicador de cierre de ciclo que se muestra en cada chip de tarea activa. */
  get closeLabel(): string {
    return urgencyLabel(daysUntilCycleClose());
  }
}
