import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import {
  DcHealthSnapshot,
  MaintenancePayload,
  TerminalPayload,
  WindowsDomainPayload,
} from '../../../../core/models/maintenance-log.models';

type ServerRowState = 'ok' | 'warn' | 'crit';

@Component({
  selector: 'app-maintenance-form',
  templateUrl: './maintenance-form.component.html',
  styleUrl: './maintenance-form.component.scss',
})
export class MaintenanceFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<WindowsDomainPayload | TerminalPayload>();
  @Output() requestSave     = new EventEmitter<WindowsDomainPayload | TerminalPayload>();
  @Output() requestNotDone  = new EventEmitter<void>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['infrastructure'] && this.infrastructure) {
      this.buildForm();
      if (this.savedPayload) {
        this.patchFormFromPayload(this.savedPayload);
      }
      this.applyReadOnlyState();
    } else if (changes['savedPayload'] && this.savedPayload && this.form) {
      this.patchFormFromPayload(this.savedPayload);
      this.applyReadOnlyState();
    } else if (changes['readOnly'] && this.form) {
      this.applyReadOnlyState();
    }
  }

  // ── Getters condicionales ────────────────────────────────────────────────────

  get hasServers(): boolean { return this.infrastructure?.windowsVMs?.length > 0; }

  get allVMs() {
    return [
      ...(this.infrastructure?.windowsVMs ?? []),
      ...(this.infrastructure?.domainControllers ?? []),
      ...(this.infrastructure?.linuxVMs ?? []),
    ];
  }

  get serverControls(): FormArray {
    return this.form.get('servers') as FormArray;
  }

  get dcControls(): FormArray {
    return this.form.get('domainControllers') as FormArray;
  }

  get hasDomainControllers(): boolean {
    return (this.infrastructure?.domainControllers?.length ?? 0) > 0;
  }

  get isTerminalType(): boolean {
    return this.task?.type === 'TERMINAL_MAINTENANCE' || this.task?.type === 'SITE_VISIT';
  }

  get isServerType(): boolean {
    return this.task?.type === 'WINDOWS_DOMAIN_MAINTENANCE';
  }

  get isUnsupported(): boolean {
    return this.task?.type === 'AV_CONTROL'
      || this.task?.type === 'UPS_CONTROL'
      || this.task?.type === 'ENDPOINT_INVENTORY';
  }

  // ── Summary getters ──────────────────────────────────────────────────────────

  get summaryOk(): number {
    return this.infrastructure?.windowsVMs?.reduce((n, _, i) =>
      n + (this.serverRowState(i) === 'ok' ? 1 : 0), 0) ?? 0;
  }

  get summaryWarn(): number {
    return this.infrastructure?.windowsVMs?.reduce((n, _, i) =>
      n + (this.serverRowState(i) === 'warn' ? 1 : 0), 0) ?? 0;
  }

  get summaryCrit(): number {
    return this.infrastructure?.windowsVMs?.reduce((n, _, i) =>
      n + (this.serverRowState(i) === 'crit' ? 1 : 0), 0) ?? 0;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  selectClass(value: string): string {
    if (!value) return 'mf-sel--na';
    if (value === 'ok' || value === 'OK') return 'mf-sel--ok';
    if (value === 'pending' || value === 'degraded' || value === 'falta_configurar'
        || value === 'ERROR Systemlog' || value === 'no_task') return 'mf-sel--warn';
    if (value === 'error' || value === 'failed' || value === 'ERROR' || value === 'alerta') return 'mf-sel--crit';
    return 'mf-sel--na';
  }

  serverRowState(i: number): ServerRowState {
    const group = this.getServerGroup(i);
    const updates      = group.get('updates')?.value      ?? 'ok';
    const restartScript = group.get('restartScript')?.value ?? 'ok';
    const isCrit = updates === 'failed' || restartScript === 'error';
    const isWarn = updates === 'pending' || restartScript === 'no_task';
    if (isCrit) return 'crit';
    if (isWarn) return 'warn';
    return 'ok';
  }

  getServerGroup(index: number): FormGroup {
    return this.serverControls.at(index) as FormGroup;
  }

  // ── Read-only state ─────────────────────────────────────────────────────────

  private applyReadOnlyState(): void {
    if (!this.form) return;
    if (this.readOnly) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  // ── Form construction ───────────────────────────────────────────────────────

  private buildForm(): void {
    this.form = this.fb.group({
      servers: this.fb.array(
        this.infrastructure.windowsVMs.map(() => this.fb.group({
          updates:       ['ok'],
          restartScript: ['ok'],
        }))
      ),
      domainControllers: this.fb.array(
        (this.infrastructure.domainControllers ?? []).map(() =>
          this.fb.group({ rawJson: [''] })
        )
      ),
      cleanedTemp:    [false],
      windowsUpdates: [false],
      antivirusOk:    [false],
      diskSpace:      [false],
      licenses:       [false],
      connectivity: [false],
      switches:     [false],
      observations: [''],
      notes: [''],
    });
  }

  // ── Payload construction ────────────────────────────────────────────────────

  buildPayload(): WindowsDomainPayload | TerminalPayload {
    const v = this.form.value;

    if (this.isTerminalType) {
      const payload: TerminalPayload = {
        type: 'TERMINAL_MAINTENANCE',
        checks: {
          cleanedTemp:    v.cleanedTemp,
          windowsUpdates: v.windowsUpdates,
          antivirusOk:    v.antivirusOk,
          diskSpace:      v.diskSpace,
          licenses:       v.licenses,
        },
        network: {
          connectivity: v.connectivity,
          switches:     v.switches,
        },
        observations: v.observations || undefined,
        notes:        v.notes || undefined,
      };
      return payload;
    }

    const servers = this.infrastructure.windowsVMs.map((vm, i) => ({
      serverId:      vm.assetId,
      serverName:    vm.name,
      updates:       v.servers[i]?.updates       ?? 'ok',
      restartScript: v.servers[i]?.restartScript ?? 'ok',
    }));

    const payload: WindowsDomainPayload = {
      type: 'WINDOWS_DOMAIN_MAINTENANCE',
      windows: {
        servers,
        domainControllers: (this.infrastructure.domainControllers ?? [])
          .map((_, i) => {
            const raw = this.dcControls.at(i).get('rawJson')?.value ?? '';
            try { return JSON.parse(raw) as DcHealthSnapshot; }
            catch { return null; }
          })
          .filter((s): s is DcHealthSnapshot => s !== null),
      },
      notes: v.notes || undefined,
    };

    return payload;
  }

  private patchFormFromPayload(payload: MaintenancePayload): void {
    if (payload.type === 'WINDOWS_DOMAIN_MAINTENANCE') {
      const srv = payload as WindowsDomainPayload;

      this.form.patchValue({ notes: srv.notes ?? '' });

      if (srv.windows.servers?.length) {
        this.infrastructure.windowsVMs.forEach((vm, i) => {
          const saved = srv.windows.servers.find(s => s.serverId === vm.assetId);
          if (saved) {
            this.serverControls.at(i).patchValue({
              updates:       saved.updates,
              restartScript: saved.restartScript ?? 'ok',
            });
          }
        });
      }

      if (srv.windows.domainControllers?.length) {
        srv.windows.domainControllers.forEach((snapshot, i) => {
          this.dcControls.at(i)?.patchValue({
            rawJson: JSON.stringify(snapshot, null, 2),
          });
        });
      }
    } else if (payload.type === 'TERMINAL_MAINTENANCE') {
      const t = payload as TerminalPayload;
      this.form.patchValue({
        cleanedTemp:    t.checks?.cleanedTemp    ?? false,
        windowsUpdates: t.checks?.windowsUpdates ?? false,
        antivirusOk:    t.checks?.antivirusOk    ?? false,
        diskSpace:      t.checks?.diskSpace      ?? false,
        licenses:       t.checks?.licenses       ?? false,
        connectivity:   t.network?.connectivity  ?? false,
        switches:       t.network?.switches      ?? false,
        observations:   t.observations ?? '',
        notes:          t.notes ?? '',
      });
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  save(): void {
    this.requestSave.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }
}
