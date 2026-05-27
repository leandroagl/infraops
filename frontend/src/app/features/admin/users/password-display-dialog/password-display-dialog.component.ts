import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-password-display-dialog',
  template: '',
})
export class PasswordDisplayDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<PasswordDisplayDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string; plainPassword: string },
  ) {}
}
