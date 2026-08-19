import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TaskType, TaskTypeConfigDto } from '../../../../core/models/task.models';

export interface ConfirmCloseDialogData {
  mode: 'DONE' | 'NOT_DONE';
  taskType: TaskType;
  config: TaskTypeConfigDto;
  odooTicketId: number | null;
  issuesSummary: {
    dcdiagErrors: string[];
    veeamMissing: boolean;
    emptyFields: string[];
  };
}

@Component({
  selector: 'app-confirm-close-dialog',
  templateUrl: './confirm-close-dialog.component.html',
})
export class ConfirmCloseDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ConfirmCloseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmCloseDialogData,
  ) {}

  get formattedTime(): string {
    const m = this.data.config.defaultTimeMinutes ?? 0;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}:${min.toString().padStart(2, '0')} h`;
  }

  get hasAlerts(): boolean {
    const { dcdiagErrors, veeamMissing } = this.data.issuesSummary;
    return dcdiagErrors.length > 0 || veeamMissing;
  }

  get showTags(): boolean {
    return this.data.mode === 'DONE' && this.data.config.odooTagNames.length > 0;
  }

  get showTicket(): boolean {
    return this.data.mode === 'DONE' && this.data.odooTicketId != null;
  }

  get confirmLabel(): string {
    if (this.data.mode === 'NOT_DONE') return 'Confirmar — no realizado';
    return this.hasAlerts ? 'Confirmar con alertas' : 'Confirmar cierre';
  }

  confirm(): void { this.dialogRef.close(true); }
  cancel():  void { this.dialogRef.close(null); }
}
