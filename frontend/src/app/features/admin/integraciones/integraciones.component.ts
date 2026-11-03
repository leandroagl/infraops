import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  IntegrationConfigService, OdooConfigDto, InfraDocConfigDto, VmwareConfigDto, VeeamIntegrationConfigDto,
  JetbackupIntegrationConfigDto, AcronisIntegrationConfigDto, UnifiIntegrationConfigDto, UnifiLocalIntegrationConfigDto,
} from '../../../core/services/integration-config.service';

const MASK = '••••••••';
type ConnectionStatus = 'ok' | 'error' | 'unknown';

interface CardState {
  loading: boolean; saving: boolean; testing: boolean;
  connectionStatus: ConnectionStatus; connectionMessage: string;
  updatedAt: Date | null; updatedBy: string | null;
}

const initCard = (): CardState => ({
  loading: true, saving: false, testing: false,
  connectionStatus: 'unknown', connectionMessage: '',
  updatedAt: null, updatedBy: null,
});

@Component({
  selector: 'app-integraciones',
  templateUrl: './integraciones.component.html',
  styleUrl: './integraciones.component.scss',
})
export class IntegracionesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  readonly MASK = MASK;

  odooForm: FormGroup;
  infradocForm: FormGroup;
  vmwareForm: FormGroup;
  veeamForm: FormGroup;
  jetbackupForm: FormGroup;
  acronisForm: FormGroup;
  unifiForm: FormGroup;
  unifiLocalForm: FormGroup;

  odoo      = initCard();
  infradoc  = initCard();
  vmware    = initCard();
  veeam     = initCard();
  jetbackup = initCard();
  acronis   = initCard();
  unifi     = initCard();
  unifiLocal = initCard();

  showAcronisClientId     = false;
  showAcronisClientSecret = false;
  showOdooApiKey       = false;
  showInfradocApiKey   = false;
  showVmwarePassword   = false;
  showVeeamPassword    = false;
  showJetbackupApiKey  = false;
  showUnifiApiKey      = false;
  showUnifiLocalApiKey = false;

  toggleOdooApiKey(): void      { this.showOdooApiKey      = !this.showOdooApiKey; }
  toggleInfradocApiKey(): void  { this.showInfradocApiKey  = !this.showInfradocApiKey; }
  toggleVmwarePassword(): void  { this.showVmwarePassword  = !this.showVmwarePassword; }
  toggleVeeamPassword(): void   { this.showVeeamPassword   = !this.showVeeamPassword; }
  toggleJetbackupApiKey(): void { this.showJetbackupApiKey = !this.showJetbackupApiKey; }
  toggleAcronisClientId(): void      { this.showAcronisClientId      = !this.showAcronisClientId; }
  toggleAcronisClientSecret(): void  { this.showAcronisClientSecret  = !this.showAcronisClientSecret; }
  toggleUnifiApiKey(): void      { this.showUnifiApiKey      = !this.showUnifiApiKey; }
  toggleUnifiLocalApiKey(): void { this.showUnifiLocalApiKey = !this.showUnifiLocalApiKey; }

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: IntegrationConfigService,
    private readonly snackBar: MatSnackBar,
  ) {
    this.odooForm     = this.fb.group({
      url: [''], db: [''], username: [''], apiKey: [MASK],
    });
    this.infradocForm = this.fb.group({ url: [''], apiKey: [MASK] });
    this.vmwareForm   = this.fb.group({ username: [''], password: [MASK] });
    this.veeamForm    = this.fb.group({ username: [''], password: [MASK] });
    this.jetbackupForm = this.fb.group({ url: [''], username: ['root'], apiKey: [MASK] });
    this.acronisForm   = this.fb.group({ baseUrl: [''], clientId: [MASK], clientSecret: [MASK] });
    this.unifiForm     = this.fb.group({ apiKey: [MASK] });
    this.unifiLocalForm = this.fb.group({ url: [''], apiKey: [MASK] });
  }

  ngOnInit(): void {
    this.svc.getOdoo().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.odooForm.patchValue(d);
        this.odoo.loading           = false;
        this.odoo.updatedAt         = d.updatedAt;
        this.odoo.updatedBy         = d.updatedBy;
      },
    });
    this.svc.getInfraDoc().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.infradocForm.patchValue(d);
        this.infradoc.loading           = false;
        this.infradoc.updatedAt         = d.updatedAt;
        this.infradoc.updatedBy         = d.updatedBy;
      },
    });
    this.svc.getVmware().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.vmwareForm.patchValue(d);
        this.vmware.loading           = false;
        this.vmware.updatedAt         = d.updatedAt;
        this.vmware.updatedBy         = d.updatedBy;
      },
    });
    this.svc.getVeeam().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.veeamForm.patchValue(d);
        this.veeam.loading   = false;
        this.veeam.updatedAt = d.updatedAt;
        this.veeam.updatedBy = d.updatedBy;
      },
    });
    this.svc.getJetbackup().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.jetbackupForm.patchValue(d);
        this.jetbackup.loading   = false;
        this.jetbackup.updatedAt = d.updatedAt;
        this.jetbackup.updatedBy = d.updatedBy;
      },
    });
    this.svc.getAcronis().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.acronisForm.patchValue(d);
        this.acronis.loading   = false;
        this.acronis.updatedAt = d.updatedAt;
        this.acronis.updatedBy = d.updatedBy;
      },
    });
    this.svc.getUnifi().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d: UnifiIntegrationConfigDto) => {
        this.unifiForm.patchValue(d);
        this.unifi.loading   = false;
        this.unifi.updatedAt = d.updatedAt;
        this.unifi.updatedBy = d.updatedBy;
      },
    });
    this.svc.getUnifiLocal().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d: UnifiLocalIntegrationConfigDto) => {
        this.unifiLocalForm.patchValue(d);
        this.unifiLocal.loading   = false;
        this.unifiLocal.updatedAt = d.updatedAt;
        this.unifiLocal.updatedBy = d.updatedBy;
      },
    });
  }

  buildOdooPatchDto(): Partial<OdooConfigDto> {
    const v = this.odooForm.value as { url: string; db: string; username: string; apiKey: string };
    const dto: Partial<OdooConfigDto> = { url: v.url, db: v.db, username: v.username };
    if (v.apiKey && v.apiKey !== MASK) dto.apiKey = v.apiKey;
    return dto;
  }

  buildInfraDocPatchDto(): Partial<InfraDocConfigDto> {
    const v = this.infradocForm.value as { url: string; apiKey: string };
    const dto: Partial<InfraDocConfigDto> = { url: v.url };
    if (v.apiKey && v.apiKey !== MASK) dto.apiKey = v.apiKey;
    return dto;
  }

  buildVmwarePatchDto(): Partial<VmwareConfigDto> {
    const v = this.vmwareForm.value as { username: string; password: string };
    const dto: Partial<VmwareConfigDto> = { username: v.username };
    if (v.password && v.password !== MASK) dto.password = v.password;
    return dto;
  }

  saveOdoo(): void {
    this.odoo.saving = true;
    this.svc.patchOdoo(this.buildOdooPatchDto()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.odooForm.patchValue(d);
        this.odoo.saving            = false;
        this.odoo.updatedAt         = d.updatedAt;
        this.odoo.updatedBy         = d.updatedBy;
        this.snackBar.open('Configuración de Odoo guardada', '', { duration: 3000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.odoo.saving = false;
        this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración de Odoo', '', { duration: 4000 });
      },
    });
  }

  testOdoo(): void {
    this.odoo.testing = true;
    this.svc.testOdoo().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.odoo.testing           = false;
        this.odoo.connectionStatus  = r.ok ? 'ok' : 'error';
        this.odoo.connectionMessage = r.message;
        this.snackBar.open(r.message, '', { duration: r.ok ? 3000 : 5000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.odoo.testing           = false;
        this.odoo.connectionStatus  = 'error';
        this.odoo.connectionMessage = e?.error?.message ?? 'Error de conexión';
        this.snackBar.open(this.odoo.connectionMessage, '', { duration: 5000 });
      },
    });
  }

  saveInfraDoc(): void {
    this.infradoc.saving = true;
    this.svc.patchInfraDoc(this.buildInfraDocPatchDto()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.infradocForm.patchValue(d);
        this.infradoc.saving            = false;
        this.infradoc.updatedAt         = d.updatedAt;
        this.infradoc.updatedBy         = d.updatedBy;
        this.snackBar.open('Configuración de InfraDoc guardada', '', { duration: 3000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.infradoc.saving = false;
        this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración de InfraDoc', '', { duration: 4000 });
      },
    });
  }

  testInfraDoc(): void {
    this.infradoc.testing = true;
    this.svc.testInfraDoc().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.infradoc.testing           = false;
        this.infradoc.connectionStatus  = r.ok ? 'ok' : 'error';
        this.infradoc.connectionMessage = r.message;
        this.snackBar.open(r.message, '', { duration: r.ok ? 3000 : 5000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.infradoc.testing           = false;
        this.infradoc.connectionStatus  = 'error';
        this.infradoc.connectionMessage = e?.error?.message ?? 'Error de conexión';
        this.snackBar.open(this.infradoc.connectionMessage, '', { duration: 5000 });
      },
    });
  }

  saveVmware(): void {
    this.vmware.saving = true;
    this.svc.patchVmware(this.buildVmwarePatchDto()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.vmwareForm.patchValue(d);
        this.vmware.saving            = false;
        this.vmware.updatedAt         = d.updatedAt;
        this.vmware.updatedBy         = d.updatedBy;
        this.snackBar.open('Configuración de VMware guardada', '', { duration: 3000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.vmware.saving = false;
        this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración de VMware', '', { duration: 4000 });
      },
    });
  }

  testVmware(): void {
    this.vmware.testing = true;
    this.svc.testVmware().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.vmware.testing           = false;
        this.vmware.connectionStatus  = r.ok ? 'ok' : 'error';
        this.vmware.connectionMessage = r.message;
        this.snackBar.open(r.message, '', { duration: 3000 });
      },
      error: () => {
        this.vmware.testing          = false;
        this.vmware.connectionStatus = 'error';
        this.snackBar.open('Error al probar VMware', '', { duration: 5000 });
      },
    });
  }

  buildVeeamPatchDto(): Partial<VeeamIntegrationConfigDto> {
    const v = this.veeamForm.value as { username: string; password: string };
    const dto: Partial<VeeamIntegrationConfigDto> = { username: v.username };
    if (v.password && v.password !== MASK) dto.password = v.password;
    return dto;
  }

  saveVeeam(): void {
    this.veeam.saving = true;
    this.svc.patchVeeam(this.buildVeeamPatchDto()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.veeamForm.patchValue(d);
        this.veeam.saving    = false;
        this.veeam.updatedAt = d.updatedAt;
        this.veeam.updatedBy = d.updatedBy;
        this.snackBar.open('Configuración de Veeam guardada', '', { duration: 3000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.veeam.saving = false;
        this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración de Veeam', '', { duration: 4000 });
      },
    });
  }

  testVeeam(): void {
    this.veeam.testing = true;
    this.svc.testVeeam().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.veeam.testing           = false;
        this.veeam.connectionStatus  = r.ok ? 'ok' : 'error';
        this.veeam.connectionMessage = r.message;
        this.snackBar.open(r.message, '', { duration: r.ok ? 3000 : 5000 });
      },
      error: () => {
        this.veeam.testing          = false;
        this.veeam.connectionStatus = 'error';
        this.snackBar.open('Error al probar Veeam', '', { duration: 5000 });
      },
    });
  }

  buildJetbackupPatchDto(): Partial<JetbackupIntegrationConfigDto> {
    const v = this.jetbackupForm.value as { url: string; username: string; apiKey: string };
    const dto: Partial<JetbackupIntegrationConfigDto> = { url: v.url, username: v.username };
    if (v.apiKey && v.apiKey !== MASK) dto.apiKey = v.apiKey;
    return dto;
  }

  saveJetbackup(): void {
    this.jetbackup.saving = true;
    this.svc.patchJetbackup(this.buildJetbackupPatchDto()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.jetbackupForm.patchValue(d);
        this.jetbackup.saving    = false;
        this.jetbackup.updatedAt = d.updatedAt;
        this.jetbackup.updatedBy = d.updatedBy;
        this.snackBar.open('Configuración de JetBackup guardada', '', { duration: 3000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.jetbackup.saving = false;
        this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración de JetBackup', '', { duration: 4000 });
      },
    });
  }

  testJetbackup(): void {
    this.jetbackup.testing = true;
    this.svc.testJetbackup().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.jetbackup.testing           = false;
        this.jetbackup.connectionStatus  = r.ok ? 'ok' : 'error';
        this.jetbackup.connectionMessage = r.message;
        this.snackBar.open(r.message, '', { duration: r.ok ? 3000 : 5000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.jetbackup.testing           = false;
        this.jetbackup.connectionStatus  = 'error';
        this.jetbackup.connectionMessage = e?.error?.message ?? 'Error de conexión';
        this.snackBar.open(this.jetbackup.connectionMessage, '', { duration: 5000 });
      },
    });
  }

  buildAcronisPatchDto(): Partial<AcronisIntegrationConfigDto> {
    const v = this.acronisForm.value as { baseUrl: string; clientId: string; clientSecret: string };
    const dto: Partial<AcronisIntegrationConfigDto> = { baseUrl: v.baseUrl };
    if (v.clientId && v.clientId !== MASK) dto.clientId = v.clientId;
    if (v.clientSecret && v.clientSecret !== MASK) dto.clientSecret = v.clientSecret;
    return dto;
  }

  saveAcronis(): void {
    this.acronis.saving = true;
    this.svc.patchAcronis(this.buildAcronisPatchDto()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => {
        this.acronisForm.patchValue(d);
        this.acronis.saving    = false;
        this.acronis.updatedAt = d.updatedAt;
        this.acronis.updatedBy = d.updatedBy;
        this.snackBar.open('Configuración de Acronis guardada', '', { duration: 3000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.acronis.saving = false;
        this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración de Acronis', '', { duration: 4000 });
      },
    });
  }

  testAcronis(): void {
    this.acronis.testing = true;
    this.svc.testAcronis().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.acronis.testing           = false;
        this.acronis.connectionStatus  = r.ok ? 'ok' : 'error';
        this.acronis.connectionMessage = r.message;
        this.snackBar.open(r.message, '', { duration: r.ok ? 3000 : 5000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.acronis.testing           = false;
        this.acronis.connectionStatus  = 'error';
        this.acronis.connectionMessage = e?.error?.message ?? 'Error de conexión';
        this.snackBar.open(this.acronis.connectionMessage, '', { duration: 5000 });
      },
    });
  }

  buildUnifiPatchDto(): Partial<UnifiIntegrationConfigDto> {
    const v = this.unifiForm.value as { apiKey: string };
    const dto: Partial<UnifiIntegrationConfigDto> = {};
    if (v.apiKey && v.apiKey !== MASK) dto.apiKey = v.apiKey;
    return dto;
  }

  saveUnifi(): void {
    this.unifi.saving = true;
    this.svc.patchUnifi(this.buildUnifiPatchDto()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d: UnifiIntegrationConfigDto) => {
        this.unifiForm.patchValue(d);
        this.unifi.saving    = false;
        this.unifi.updatedAt = d.updatedAt;
        this.unifi.updatedBy = d.updatedBy;
        this.snackBar.open('Configuración de UniFi guardada', '', { duration: 3000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.unifi.saving = false;
        this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración de UniFi', '', { duration: 4000 });
      },
    });
  }

  testUnifi(): void {
    this.unifi.testing = true;
    this.svc.testUnifi().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.unifi.testing           = false;
        this.unifi.connectionStatus  = r.ok ? 'ok' : 'error';
        this.unifi.connectionMessage = r.message;
        this.snackBar.open(r.message, '', { duration: r.ok ? 3000 : 5000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.unifi.testing           = false;
        this.unifi.connectionStatus  = 'error';
        this.unifi.connectionMessage = e?.error?.message ?? 'Error de conexión';
        this.snackBar.open(this.unifi.connectionMessage, '', { duration: 5000 });
      },
    });
  }

  buildUnifiLocalPatchDto(): Partial<UnifiLocalIntegrationConfigDto> {
    const v = this.unifiLocalForm.value as { url: string; apiKey: string };
    const dto: Partial<UnifiLocalIntegrationConfigDto> = { url: v.url };
    if (v.apiKey && v.apiKey !== MASK) dto.apiKey = v.apiKey;
    return dto;
  }

  saveUnifiLocal(): void {
    this.unifiLocal.saving = true;
    this.svc.patchUnifiLocal(this.buildUnifiLocalPatchDto()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d: UnifiLocalIntegrationConfigDto) => {
        this.unifiLocalForm.patchValue(d);
        this.unifiLocal.saving    = false;
        this.unifiLocal.updatedAt = d.updatedAt;
        this.unifiLocal.updatedBy = d.updatedBy;
        this.snackBar.open('Configuración de servidor UniFi local guardada', '', { duration: 3000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.unifiLocal.saving = false;
        this.snackBar.open(e?.error?.message ?? 'Error al guardar configuración del servidor UniFi local', '', { duration: 4000 });
      },
    });
  }

  testUnifiLocal(): void {
    this.unifiLocal.testing = true;
    this.svc.testUnifiLocal().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.unifiLocal.testing           = false;
        this.unifiLocal.connectionStatus  = r.ok ? 'ok' : 'error';
        this.unifiLocal.connectionMessage = r.message;
        this.snackBar.open(r.message, '', { duration: r.ok ? 3000 : 5000 });
      },
      error: (e: { error?: { message?: string } }) => {
        this.unifiLocal.testing           = false;
        this.unifiLocal.connectionStatus  = 'error';
        this.unifiLocal.connectionMessage = e?.error?.message ?? 'Error de conexión';
        this.snackBar.open(this.unifiLocal.connectionMessage, '', { duration: 5000 });
      },
    });
  }
}
