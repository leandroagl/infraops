import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GenerationResult, MonthlyPreview, SchedulesService } from '../schedules.service';
import { typeLabelLong } from '../../../shared/utils/task-labels';

const MONTH_NAMES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

@Component({
  selector: 'app-generation-tab',
  templateUrl: './generation-tab.component.html',
  styleUrl: './generation-tab.component.scss',
})
export class GenerationTabComponent implements OnInit {
  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;
  preview: MonthlyPreview | null = null;
  loading = false;
  generating = false;
  lastResult: GenerationResult | null = null;
  displayedColumns = ['client', 'technician'];

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

  get taskTypesWithoutTagsLabel(): string {
    return (this.preview?.taskTypesWithoutTags ?? []).map(typeLabelLong).join(', ');
  }

  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void { this.loadPreview(); }

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
