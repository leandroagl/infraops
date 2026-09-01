import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  ClientSchedule, GenerationResult, MonthlyPreview, MonthlyPreviewClient, SchedulesService,
} from '../schedules.service';
import { typeLabelLong } from '../../../shared/utils/task-labels';

const MONTH_NAMES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

@Component({
  selector: 'app-generation-tab',
  templateUrl: './generation-tab.component.html',
  styleUrl: './generation-tab.component.scss',
})
export class GenerationTabComponent implements OnInit, OnDestroy {
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  preview: MonthlyPreview | null = null;
  loading = false;
  generating = false;
  lastResult: GenerationResult | null = null;
  displayedColumns = ['client', 'technician'];

  private readonly destroy$ = new Subject<void>();

  get monthName(): string { return MONTH_NAMES[this.month]; }
  get isEvenGroup(): boolean { return this.preview?.group === 'BIMONTHLY_EVEN'; }
  get isFutureMonth(): boolean {
    const now = new Date();
    const cy = now.getFullYear(), cm = now.getMonth() + 1;
    return this.year > cy || (this.year === cy && this.month > cm);
  }
  get canGenerate(): boolean {
    return !!this.preview &&
      !this.preview.wasGenerated &&
      this.preview.clientsWithoutTechnician === 0 &&
      this.preview.taskTypesWithoutTags.length === 0 &&
      this.preview.clients.length > 0 &&
      !this.generating &&
      !this.isFutureMonth;
  }

  get taskTypesWithoutTagsLabels(): string[] {
    return (this.preview?.taskTypesWithoutTags ?? []).map(typeLabelLong);
  }

  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadPreview();
    this.schedulesService.scheduleUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(updated => this.applyScheduleUpdate(updated));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Refleja en el preview ya cargado el cambio de grupo/técnico guardado en la pestaña de configuración, sin recargar desde la API. */
  private applyScheduleUpdate(updated: ClientSchedule): void {
    if (!this.preview) return;

    const idx = this.preview.clients.findIndex(c => c.clientId === updated.clientId);
    const belongsToCurrentGroup = updated.isActive && updated.scheduleGroup === this.preview.group;

    let clients: MonthlyPreviewClient[];
    if (!belongsToCurrentGroup) {
      if (idx === -1) return;
      clients = this.preview.clients.filter(c => c.clientId !== updated.clientId);
    } else {
      const entry: MonthlyPreviewClient = {
        clientId: updated.clientId,
        clientName: updated.client.name,
        technicianId: updated.technicianId,
        technicianName: updated.technician?.user?.name ?? null,
      };
      clients = idx !== -1
        ? this.preview.clients.map((c, i) => (i === idx ? entry : c))
        : [...this.preview.clients, entry];
    }

    this.preview = {
      ...this.preview,
      clients,
      clientsWithoutTechnician: clients.filter(c => !c.technicianId).length,
    };
  }

  private loadPreview(): void {
    this.preview = null;
    this.lastResult = null;
    this.loading = true;
    this.schedulesService.getMonthlyPreview(this.year, this.month).subscribe({
      next: p => { this.preview = p; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  prevMonth(): void {
    if (this.month === 1) { this.month = 12; this.year--; } else { this.month--; }
    this.loadPreview();
  }

  nextMonth(): void {
    if (this.month === 12) { this.month = 1; this.year++; } else { this.month++; }
    this.loadPreview();
  }

  generate(): void {
    this.generating = true;
    this.schedulesService.generateMonth(this.year, this.month).subscribe({
      next: result => {
        this.lastResult = result;
        this.generating = false;
        this.snack.open(
          `✓ ${result.tasksCreated} tareas generadas · ${result.tasksSkipped} omitidas`,
          undefined, { duration: 4000 },
        );
        this.loadPreview();
      },
      error: () => {
        this.generating = false;
        this.snack.open('Error al generar tareas', 'OK', { duration: 4000 });
      },
    });
  }
}
