import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup } from '@angular/forms';
import { NetworkService } from '../../../core/services/network.service';
import { NetworkSiteDialogComponent } from './network-site-dialog/network-site-dialog.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import type { UnifiSiteConfig, UnifiAutoConfig } from '../../../core/models/network.models';

@Component({
  selector: 'app-network-config',
  templateUrl: './network-config.component.html',
  styleUrl: './network-config.component.scss',
})
export class NetworkConfigComponent implements OnInit {
  sites: UnifiSiteConfig[] = [];
  autoConfig: UnifiAutoConfig | null = null;
  loadingSites = false;
  savingAuto = false;
  autoForm: FormGroup;
  readonly siteCols = ['clientName', 'siteId', 'siteName', 'isEnabled', 'actions'];
  readonly severityOptions = ['critical', 'high', 'medium', 'low'];
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly svc: NetworkService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly fb: FormBuilder,
  ) {
    this.autoForm = this.fb.group({
      enabled: [false],
      severities: [['critical']],
      helpdeskTeamId: [null],
      tagIds: [[]],
    });
  }

  ngOnInit(): void { this.loadSites(); this.loadAutoConfig(); }

  loadSites(): void {
    this.loadingSites = true;
    this.svc.getSites().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sites => { this.sites = sites; this.loadingSites = false; },
      error: () => { this.loadingSites = false; },
    });
  }

  loadAutoConfig(): void {
    this.svc.getAutoConfig().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cfg => {
        this.autoConfig = cfg;
        this.autoForm.patchValue(cfg);
      },
    });
  }

  openSiteDialog(site?: UnifiSiteConfig): void {
    this.dialog.open(NetworkSiteDialogComponent, { data: site ?? null, width: '480px' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: UnifiSiteConfig | null) => {
        if (!result) return;
        if (site) {
          const idx = this.sites.findIndex(s => s.id === site.id);
          if (idx !== -1) this.sites = this.sites.map((s, i) => i === idx ? result : s);
        } else {
          this.sites = [...this.sites, result];
        }
      });
  }

  deleteSite(site: UnifiSiteConfig): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Eliminar site', message: `¿Eliminar el site "${site.siteName}" del cliente ${site.clientName}?` },
      width: '420px',
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      if (!confirmed) return;
      this.svc.deleteSite(site.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.sites = this.sites.filter(s => s.id !== site.id);
          this.snackBar.open('Site eliminado', 'Cerrar', { duration: 3000 });
        },
        error: () => this.snackBar.open('Error al eliminar el site', 'Cerrar', { duration: 3000 }),
      });
    });
  }

  toggleEnabled(site: UnifiSiteConfig): void {
    this.svc.updateSite(site.id, { isEnabled: !site.isEnabled })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: updated => {
          const idx = this.sites.findIndex(s => s.id === site.id);
          if (idx !== -1) this.sites[idx] = { ...this.sites[idx], isEnabled: updated.isEnabled };
        },
      });
  }

  saveAutoConfig(): void {
    this.savingAuto = true;
    this.svc.patchAutoConfig(this.autoForm.value as UnifiAutoConfig).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: cfg => {
        this.autoConfig = cfg;
        this.autoForm.patchValue(cfg);
        this.savingAuto = false;
        this.snackBar.open('Configuración guardada', 'Cerrar', { duration: 3000 });
      },
      error: () => {
        this.savingAuto = false;
        this.snackBar.open('Error al guardar', 'Cerrar', { duration: 3000 });
      },
    });
  }
}
