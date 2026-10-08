import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BackupsService } from '../../../../features/backups/services/backups.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { CredentialVaultService } from '../../../../core/services/credential-vault.service';
import { Client } from '../../../../core/models/client.models';
import type { CredentialVaultEntry } from '../../../../core/models/credential-vault.models';
import type { CreateVeeamConfigRequest, UpdateVeeamConfigRequest, VeeamClientConfig } from '../../../../features/backups/models/backup.models';

@Component({
  selector: 'app-backups-config-dialog',
  templateUrl: './backups-config-dialog.component.html',
})
export class BackupsConfigDialogComponent implements OnInit {
  saving      = false;
  loadingHost = false;
  isEdit      = false;
  clients:      Client[]               = [];
  vaultEntries: CredentialVaultEntry[] = [];

  form = new FormGroup({
    clientId:          new FormControl('',   [Validators.required]),
    host:              new FormControl('',   [Validators.required]),
    port:              new FormControl<number>(9419, [Validators.required, Validators.min(1), Validators.max(65535)]),
    username:          new FormControl('',   [Validators.required]),
    credentialVaultId: new FormControl<string | null>(null),
    isEnabled:         new FormControl(true),
  });

  constructor(
    private readonly dialogRef:    MatDialogRef<BackupsConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: VeeamClientConfig | null,
    private readonly svc:          BackupsService,
    private readonly clientsSvc:   ClientsService,
    private readonly infradocSvc:  InfradocService,
    private readonly vaultSvc:     CredentialVaultService,
  ) {}

  ngOnInit(): void {
    this.clientsSvc.getAll().subscribe(all => {
      this.clients = all.filter(c => c.isActive);
    });

    this.vaultSvc.list().subscribe(entries => {
      this.vaultEntries = entries;
    });

    if (this.data) {
      this.isEdit = true;
      this.form.patchValue({
        clientId:          this.data.clientId,
        host:              this.data.host,
        port:              this.data.port,
        username:          this.data.username,
        isEnabled:         this.data.isEnabled,
        credentialVaultId: this.data.credentialVaultEntryId ?? null,
      });
      this.form.controls.clientId.setValidators([]);
      this.form.controls.clientId.updateValueAndValidity();
      this.form.get('clientId')?.disable();
    } else {
      this.form.controls.credentialVaultId.setValidators([Validators.required]);
      this.form.controls.credentialVaultId.updateValueAndValidity();
    }
  }

  onClientChange(clientId: string): void {
    if (this.isEdit) return;
    this.loadingHost = true;
    this.infradocSvc.getClientInfrastructure(clientId).subscribe({
      next: infra => {
        const esxi = infra.esxiHosts[0];
        if (esxi) {
          const uri = esxi.uri1 ?? esxi.uri2;
          if (uri) {
            const colonIdx = uri.lastIndexOf(':');
            const host = colonIdx >= 0 ? uri.slice(0, colonIdx) : uri;
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
    const v = this.form.value;

    if (this.isEdit && this.data) {
      const dto: UpdateVeeamConfigRequest = {
        host:      v.host      ?? undefined,
        port:      v.port      ?? 9419,
        username:  v.username  ?? undefined,
        isEnabled: v.isEnabled ?? true,
      };
      if (v.credentialVaultId) dto.credentialVaultId = v.credentialVaultId;

      this.svc.updateConfig(this.data.id, dto).subscribe({
        next: updated => { this.saving = false; this.dialogRef.close(updated); },
        error: ()      => { this.saving = false; },
      });
    } else {
      const clientName = this.clients.find(c => c.id === v.clientId)?.name ?? '';
      const dto: CreateVeeamConfigRequest = {
        clientId:          v.clientId!,
        clientName,
        host:              v.host!,
        port:              v.port ?? 9419,
        username:          v.username!,
        credentialVaultId: v.credentialVaultId!,
        isEnabled:         v.isEnabled ?? true,
      };

      this.svc.createConfig(dto).subscribe({
        next: created => { this.saving = false; this.dialogRef.close(created); },
        error: ()      => { this.saving = false; },
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
