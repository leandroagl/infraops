import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({ selector: 'app-task-edit-dialog', template: '' })
export class TaskEditDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<TaskEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { config: unknown },
  ) {}
}
