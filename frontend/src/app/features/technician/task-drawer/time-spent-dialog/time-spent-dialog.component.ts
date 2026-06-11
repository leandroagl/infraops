import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-time-spent-dialog',
  templateUrl: './time-spent-dialog.component.html',
})
export class TimeSpentDialogComponent {
  form = new FormGroup({
    timeSpent: new FormControl('', [
      Validators.required,
      Validators.pattern(/^\d+:\d{2}$/),
    ]),
  });

  constructor(private dialogRef: MatDialogRef<TimeSpentDialogComponent>) {}

  confirm(): void {
    if (this.form.invalid) return;
    const [h, m] = this.form.value.timeSpent!.split(':').map(Number);
    this.dialogRef.close(h * 60 + m);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
