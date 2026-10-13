import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { Client } from '../../../../core/models/client.models';
import type {
  AvailableJetbackupJob, BackupConfig, BackupProvider, CreateJetbackupConfigsRequest,
  CreateVeeamConfigRequest, UpdateVeeamConfigRequest,
} from '../../../../features/backups/models/backup.models';

type ApiError = { error?: { message?: string } };

@Component({
  selector: 'app-backups-config-dialog',
  templateUrl: './backups-config-dialog.component.html',
  styleUrl: './backups-config-dialog.component.scss',
})
export class BackupsConfigDialogComponent implements OnInit {
  saving      = false;
  loadingHost = false;
  isEdit      = false;
  clients: Client[] = [];

  jobs: AvailableJetbackupJob[] = [];
  loadingJobs = false;
  jobsError   = '';
  errorMessage = '';
  private jobsLoaded = false;

  form = new FormGroup({
    provider:  new FormControl<BackupProvider>('VEEAM'),
    clientId:  new FormControl('',   [Validators.required]),
    host:      new FormControl('',   [Validators.required]),
    port:      new FormControl<number>(9419, [Validators.required, Validators.min(1), Validators.max(65535)]),
    isEnabled: new FormControl(true),
    jobIds:    new FormControl<string[]>([]),
  });

  constructor(
    private readonly dialogRef:   MatDialogRef<BackupsConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: BackupConfig | null,
    private readonly svc:         BackupsService,
    private readonly clientsSvc:  ClientsService,
    private readonly infradocSvc: InfradocService,
  ) {}

  ngOnInit(): void {
    this.clientsSvc.getAll().subscribe(all => {
      this.clients = all.filter(c => c.isActive);
    });

    if (this.data) {
      this.isEdit = true;
      this.form.patchValue({
        provider:  this.data.provider,
        clientId:  this.data.clientId,
        isEnabled: this.data.isEnabled,
        ...(this.data.provider === 'VEEAM' ? { host: this.data.host, port: this.data.port } : {}),
      });
      this.applyProviderValidators(this.data.provider);
      this.form.controls.jobIds.clearValidators();
      this.form.controls.clientId.setValidators([]);
      this.form.controls.clientId.updateValueAndValidity();
      this.form.controls.clientId.disable();
      this.form.controls.provider.disable();
    }
  }

  get provider(): BackupProvider {
    return this.form.controls.provider.value ?? 'VEEAM';
  }

  /** Nombre del job de una config de JetBackup en edición (el job no se puede cambiar). */
  get editJobName(): string {
    return this.data?.provider === 'JETBACKUP' ? this.data.jobName : '';
  }

  onProviderChange(provider: BackupProvider): void {
    this.form.controls.provider.setValue(provider);
    this.errorMessage = '';
    this.applyProviderValidators(provider);
    if (provider === 'JETBACKUP') this.loadJobs();
  }

  // Veeam necesita host y puerto; JetBackup necesita al menos un job (el servidor es global).
  private applyProviderValidators(provider: BackupProvider): void {
    const { host, port, jobIds } = this.form.controls;
    if (provider === 'VEEAM') {
      host.setValidators([Validators.required]);
      port.setValidators([Validators.required, Validators.min(1), Validators.max(65535)]);
      jobIds.clearValidators();
    } else {
      host.clearValidators();
      port.clearValidators();
      jobIds.setValidators([Validators.required]);
    }
    host.updateValueAndValidity();
    port.updateValueAndValidity();
    jobIds.updateValueAndValidity();
  }

  private loadJobs(): void {
    if (this.jobsLoaded || this.loadingJobs) return;
    this.loadingJobs = true;
    this.jobsError = '';
    this.svc.listJetbackupJobs().subscribe({
      next: jobs => { this.jobs = jobs; this.jobsLoaded = true; this.loadingJobs = false; },
      error: (e: ApiError) => {
        this.jobsError = e?.error?.message ?? 'No se pudieron cargar los jobs de JetBackup';
        this.loadingJobs = false;
      },
    });
  }

  onClientChange(clientId: string): void {
    if (this.isEdit || this.provider !== 'VEEAM') return;
    this.loadingHost = true;
    this.infradocSvc.getClientInfrastructure(clientId).subscribe({
      next: infra => {
        const esxi = infra.esxiHosts[0];
        if (esxi) {
          const uri = esxi.uri1 ?? esxi.uri2;
          if (uri) {
            const noProto = uri.replace(/^https?:\/\//, '');
            const colonIdx = noProto.lastIndexOf(':');
            const host = colonIdx >= 0 ? noProto.slice(0, colonIdx) : noProto;
            this.form.controls.host.setValue(host);
          }
        }
        this.loadingHost = false;
      },
      error: () => { this.loadingHost = false; },
    });
  }

  get isValid(): boolean {
    return this.form.valid;
  }

  save(): void {
    if (!this.isValid) return;
    this.saving = true;
    this.errorMessage = '';
    if (this.provider === 'JETBACKUP') this.saveJetbackup();
    else this.saveVeeam();
  }

  private saveVeeam(): void {
    const v = this.form.value;

    if (this.isEdit && this.data) {
      const dto: UpdateVeeamConfigRequest = {
        host:      v.host      ?? undefined,
        port:      v.port      ?? 9419,
        isEnabled: v.isEnabled ?? true,
      };
      this.svc.updateConfig(this.data.id, dto).subscribe({
        next: updated => { this.saving = false; this.dialogRef.close(updated); },
        error: (e: ApiError) => { this.saving = false; this.errorMessage = e?.error?.message ?? ''; },
      });
    } else {
      const clientName = this.clients.find(c => c.id === v.clientId)?.name ?? '';
      const dto: CreateVeeamConfigRequest = {
        clientId:  v.clientId!,
        clientName,
        host:      v.host!,
        port:      v.port ?? 9419,
        isEnabled: v.isEnabled ?? true,
      };
      this.svc.createConfig(dto).subscribe({
        next: created => { this.saving = false; this.dialogRef.close(created); },
        error: (e: ApiError) => { this.saving = false; this.errorMessage = e?.error?.message ?? ''; },
      });
    }
  }

  private saveJetbackup(): void {
    const v = this.form.value;
    const isEnabled = v.isEnabled ?? true;
    const onError = (e: ApiError) => {
      this.saving = false;
      this.errorMessage = e?.error?.message ?? 'No se pudo guardar la configuración';
    };

    if (this.isEdit && this.data) {
      this.svc.updateJetbackupConfig(this.data.id, { isEnabled }).subscribe({
        next: updated => { this.saving = false; this.dialogRef.close(updated); },
        error: onError,
      });
      return;
    }

    const selected = new Set(v.jobIds ?? []);
    const dto: CreateJetbackupConfigsRequest = {
      clientId:   v.clientId!,
      clientName: this.clients.find(c => c.id === v.clientId)?.name ?? '',
      isEnabled,
      jobs: this.jobs.filter(j => selected.has(j.jobId)).map(j => ({ jobId: j.jobId, jobName: j.name })),
    };
    this.svc.createJetbackupConfigs(dto).subscribe({
      next: created => { this.saving = false; this.dialogRef.close(created); },
      error: onError,
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
