import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import type { VeeamClientConfig } from '../../../../features/backups/models/backup.models';

@Component({
  selector: 'app-backups-config-dialog',
  templateUrl: './backups-config-dialog.component.html',
})
export class BackupsConfigDialogComponent implements OnInit {
  saving = false;
  isEdit = false;

  form = new FormGroup({
    clientName: new FormControl('', [Validators.required]),
    host:       new FormControl('', [Validators.required]),
    port:       new FormControl<number>(9419, [Validators.required, Validators.min(1), Validators.max(65535)]),
    username:   new FormControl('', [Validators.required]),
    password:   new FormControl(''),
    isEnabled:  new FormControl(true),
  });

  constructor(
    private readonly dialogRef: MatDialogRef<BackupsConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VeeamClientConfig | null,
    private readonly svc: BackupsService,
  ) {}

  ngOnInit(): void {
    if (this.data) {
      this.isEdit = true;
      this.form.patchValue({
        clientName: this.data.clientName,
        host:       this.data.host,
        port:       this.data.port,
        username:   this.data.username,
        isEnabled:  this.data.isEnabled,
        password:   '',
      });
    }

    if (this.isEdit) {
      this.form.controls.password.setValidators([]);
      this.form.controls.password.updateValueAndValidity();
    } else {
      this.form.controls.password.setValidators([Validators.required]);
      this.form.controls.password.updateValueAndValidity();
    }
  }

  get isValid(): boolean {
    return this.form.valid;
  }

  save(): void {
    if (!this.isValid) return;
    this.saving = true;
    const v = this.form.value;

    if (this.isEdit && this.data) {
      const dto: any = {
        clientName: v.clientName,
        host:       v.host,
        port:       v.port ?? 9419,
        username:   v.username,
        isEnabled:  v.isEnabled ?? true,
      };
      if (v.password) dto['password'] = v.password;

      this.svc.updateConfig(this.data.id, dto).subscribe({
        next: updated => { this.saving = false; this.dialogRef.close(updated); },
        error: () => { this.saving = false; },
      });
    } else {
      const dto: any = {
        clientName: v.clientName,
        host:       v.host!,
        port:       v.port ?? 9419,
        username:   v.username!,
        password:   v.password!,
        isEnabled:  v.isEnabled ?? true,
      };

      this.svc.createConfig(dto).subscribe({
        next: created => { this.saving = false; this.dialogRef.close(created); },
        error: () => { this.saving = false; },
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
