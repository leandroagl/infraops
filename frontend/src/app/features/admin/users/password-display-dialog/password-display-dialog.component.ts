import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-password-display-dialog',
  templateUrl: './password-display-dialog.component.html',
})
export class PasswordDisplayDialogComponent {
  copied = false;

  constructor(
    private dialogRef: MatDialogRef<PasswordDisplayDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string; plainPassword: string },
  ) {}

  copy(): void {
    navigator.clipboard?.writeText(this.data.plainPassword).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    }).catch(() => {
      // clipboard unavailable — password is visible in the dialog
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
