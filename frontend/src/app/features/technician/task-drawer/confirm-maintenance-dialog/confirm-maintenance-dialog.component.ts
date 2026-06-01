import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmMaintenanceDialogData {
  issuesSummary: {
    dcdiagErrors: string[];
    veeamMissing: boolean;
    emptyFields: string[];
  };
  hasAlerts: boolean;
}

@Component({
  selector: 'app-confirm-maintenance-dialog',
  templateUrl: './confirm-maintenance-dialog.component.html',
  styleUrl: './confirm-maintenance-dialog.component.scss',
})
export class ConfirmMaintenanceDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmMaintenanceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmMaintenanceDialogData,
  ) {}
}
