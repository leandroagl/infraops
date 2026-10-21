import { Component, DestroyRef, inject, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NetworkService } from '../../../../core/services/network.service';
import type { UnifiSiteConfig } from '../../../../core/models/network.models';

@Component({
  selector: 'app-network-site-dialog',
  templateUrl: './network-site-dialog.component.html',
})
export class NetworkSiteDialogComponent {
  form: FormGroup;
  saving = false;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: NetworkService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<NetworkSiteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) readonly data: UnifiSiteConfig | null,
  ) {
    this.form = this.fb.group({
      clientId:   [data?.clientId   ?? '', Validators.required],
      clientName: [data?.clientName ?? '', Validators.required],
      siteId:     [data?.siteId     ?? '', Validators.required],
      siteName:   [data?.siteName   ?? '', Validators.required],
      isEnabled:  [data?.isEnabled  ?? true],
    });
  }

  get isEdit(): boolean { return !!this.data; }

  save(): void {
    if (this.form.invalid) return;
    this.saving = true;
    const obs = this.isEdit
      ? this.svc.updateSite(this.data!.id, { siteName: this.form.value.siteName, isEnabled: this.form.value.isEnabled })
      : this.svc.createSite(this.form.value);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:  result => { this.snackBar.open('Guardado', 'Cerrar', { duration: 3000 }); this.dialogRef.close(result); },
      error: () => { this.saving = false; this.snackBar.open('Error al guardar', 'Cerrar', { duration: 3000 }); },
    });
  }
}
