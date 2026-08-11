import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { RotationConfig, RotationFrequency, RotationPreview, SchedulesService } from '../../schedules.service';

@Component({
  selector: 'app-rotation-modal',
  templateUrl: './rotation-modal.component.html',
  styleUrl: './rotation-modal.component.scss',
})
export class RotationModalComponent implements OnInit {
  isActive: boolean;
  frequency: RotationFrequency;
  preview: RotationPreview | null = null;
  loading = false;
  saving = false;
  maxCount = 1;

  constructor(
    @Inject(MAT_DIALOG_DATA) private data: RotationConfig,
    private ref: MatDialogRef<RotationModalComponent>,
    private schedulesService: SchedulesService,
  ) {
    this.isActive = data?.isActive ?? false;
    this.frequency = data?.frequency ?? 'EVERY_GENERATION';
  }

  ngOnInit(): void {
    this.loadPreview();
  }

  private loadPreview(): void {
    this.loading = true;
    this.schedulesService.previewRotation().subscribe({
      next: p => {
        this.preview = p;
        this.maxCount = Math.max(...p.technicians.map(t => t.clientCount), 1);
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  barWidth(count: number): number {
    return this.maxCount > 0 ? Math.round((count / this.maxCount) * 100) : 0;
  }

  save(): void {
    this.saving = true;
    this.schedulesService.saveRotationConfig({ isActive: this.isActive, frequency: this.frequency }).subscribe({
      next: cfg => { this.saving = false; this.ref.close(cfg); },
      error: () => { this.saving = false; },
    });
  }

  deactivateAndClose(): void {
    this.schedulesService.saveRotationConfig({ isActive: false, frequency: this.frequency }).subscribe({
      next: cfg => this.ref.close(cfg),
    });
  }

  close(): void {
    this.ref.close();
  }
}
