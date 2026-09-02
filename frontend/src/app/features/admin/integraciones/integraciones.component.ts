import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  IntegrationConfigService, OdooConfigDto, InfraDocConfigDto, VmwareConfigDto,
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
  readonly MASK = MASK;

  odooForm: FormGroup;
  infradocForm: FormGroup;
  vmwareForm: FormGroup;

  odoo     = initCard();
  infradoc = initCard();
  vmware   = initCard();

  showOdooApiKey     = false;
  showInfradocApiKey = false;
  showVmwarePassword = false;

  toggleOdooApiKey(): void     { this.showOdooApiKey     = !this.showOdooApiKey; }
  toggleInfradocApiKey(): void { this.showInfradocApiKey = !this.showInfradocApiKey; }
  toggleVmwarePassword(): void { this.showVmwarePassword = !this.showVmwarePassword; }

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: IntegrationConfigService,
    private readonly snackBar: MatSnackBar,
  ) {
    this.odooForm     = this.fb.group({
      url: [''], db: [''], username: [''], apiKey: [MASK], helpdeskTeamId: [null],
      stageInProgressName: [''], stageNotDoneName: [''], stageDoneName: [''],
    });
    this.infradocForm = this.fb.group({ url: [''], apiKey: [MASK] });
    this.vmwareForm   = this.fb.group({ username: [''], password: [MASK] });
  }

  ngOnInit(): void {
    this.svc.getOdoo().subscribe({
      next: (d) => {
        this.odooForm.patchValue(d);
        this.odoo.loading           = false;
        this.odoo.updatedAt         = d.updatedAt;
        this.odoo.updatedBy         = d.updatedBy;
      },
    });
    this.svc.getInfraDoc().subscribe({
      next: (d) => {
        this.infradocForm.patchValue(d);
        this.infradoc.loading           = false;
        this.infradoc.updatedAt         = d.updatedAt;
        this.infradoc.updatedBy         = d.updatedBy;
      },
    });
    this.svc.getVmware().subscribe({
      next: (d) => {
        this.vmwareForm.patchValue(d);
        this.vmware.loading           = false;
        this.vmware.updatedAt         = d.updatedAt;
        this.vmware.updatedBy         = d.updatedBy;
      },
    });
  }

  buildOdooPatchDto(): Partial<OdooConfigDto> {
    const v = this.odooForm.value as {
      url: string; db: string; username: string; apiKey: string; helpdeskTeamId: number;
      stageInProgressName: string; stageNotDoneName: string; stageDoneName: string;
    };
    const dto: Partial<OdooConfigDto> = {
      url: v.url, db: v.db, username: v.username, helpdeskTeamId: v.helpdeskTeamId,
      stageInProgressName: v.stageInProgressName,
      stageNotDoneName: v.stageNotDoneName,
      stageDoneName: v.stageDoneName,
    };
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
    this.svc.patchOdoo(this.buildOdooPatchDto()).subscribe({
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
    this.svc.testOdoo().subscribe({
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
    this.svc.patchInfraDoc(this.buildInfraDocPatchDto()).subscribe({
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
    this.svc.testInfraDoc().subscribe({
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
    this.svc.patchVmware(this.buildVmwarePatchDto()).subscribe({
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
    this.svc.testVmware().subscribe({
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
}
