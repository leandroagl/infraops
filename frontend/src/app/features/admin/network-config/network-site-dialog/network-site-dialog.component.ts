import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NetworkService } from '../../../../core/services/network.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { Client } from '../../../../core/models/client.models';
import type { AvailableUnifiSite, UnifiSiteConfig } from '../../../../core/models/network.models';

export interface NetworkSiteDialogData {
  site: UnifiSiteConfig | null;
  configuredSiteIds: string[];
}

@Component({
  selector: 'app-network-site-dialog',
  templateUrl: './network-site-dialog.component.html',
  styleUrl: './network-site-dialog.component.scss',
})
export class NetworkSiteDialogComponent implements OnInit {
  saving = false;
  clients: Client[] = [];
  availableSites: AvailableUnifiSite[] = [];
  loadingSites = false;
  sitesError = '';

  form = new FormGroup({
    clientId:  new FormControl('', [Validators.required]),
    siteIds:   new FormControl<string[]>([], [Validators.required]),
    isEnabled: new FormControl(true),
  });

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly svc: NetworkService,
    private readonly clientsSvc: ClientsService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<NetworkSiteDialogComponent>,
    @Inject(MAT_DIALOG_DATA) readonly data: NetworkSiteDialogData,
  ) {}

  get isEdit(): boolean { return !!this.data.site; }

  ngOnInit(): void {
    if (this.isEdit) {
      this.form.patchValue({ isEnabled: this.data.site!.isEnabled });
      return;
    }
    this.clientsSvc.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(all => {
      this.clients = all.filter(c => c.isActive);
    });
    this.loadAvailableSites();
  }

  private loadAvailableSites(): void {
    this.loadingSites = true;
    this.sitesError = '';
    this.svc.getAvailableSites().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sites => { this.availableSites = sites; this.loadingSites = false; },
      error: () => {
        this.sitesError = 'No se pudieron cargar los sites de UniFi. Verificá la API key en Integraciones.';
        this.loadingSites = false;
      },
    });
  }

  isAlreadyConfigured(siteId: string): boolean {
    return this.data.configuredSiteIds.includes(siteId);
  }

  isSiteSelected(siteId: string): boolean {
    return (this.form.controls.siteIds.value ?? []).includes(siteId);
  }

  toggleSite(siteId: string): void {
    if (this.isAlreadyConfigured(siteId)) return;
    const current = this.form.controls.siteIds.value ?? [];
    const next = current.includes(siteId)
      ? current.filter(id => id !== siteId)
      : [...current, siteId];
    this.form.controls.siteIds.setValue(next);
  }

  get selectedCount(): number {
    return (this.form.controls.siteIds.value ?? []).length;
  }

  get isValid(): boolean {
    if (this.isEdit) return true;
    return !!this.form.controls.clientId.value && this.selectedCount > 0;
  }

  save(): void {
    if (!this.isValid) return;
    this.saving = true;

    if (this.isEdit) {
      this.svc.updateSite(this.data.site!.id, { isEnabled: this.form.controls.isEnabled.value ?? true })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: updated => { this.snackBar.open('Guardado', 'Cerrar', { duration: 3000 }); this.dialogRef.close([updated]); },
          error: () => { this.saving = false; this.snackBar.open('Error al guardar', 'Cerrar', { duration: 3000 }); },
        });
      return;
    }

    const clientId = this.form.controls.clientId.value!;
    const clientName = this.clients.find(c => c.id === clientId)?.name ?? '';
    const selectedIds = new Set(this.form.controls.siteIds.value ?? []);
    const sites = this.availableSites
      .filter(s => selectedIds.has(s.siteId))
      .map(s => ({ siteId: s.siteId, siteName: s.siteName }));

    this.svc.createSitesBulk({ clientId, clientName, isEnabled: this.form.controls.isEnabled.value ?? true, sites })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: created => { this.snackBar.open('Sites agregados', 'Cerrar', { duration: 3000 }); this.dialogRef.close(created); },
        error: () => { this.saving = false; this.snackBar.open('Error al guardar', 'Cerrar', { duration: 3000 }); },
      });
  }

  cancel(): void { this.dialogRef.close(null); }
}
