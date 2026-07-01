import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import {
  EsxiHostEntry,
  MaintenancePayload,
  ServerHostPayload,
  VmwareHealthResult,
} from '../../../../core/models/maintenance-log.models';
import { VmwareApiService } from '../../services/vmware-api.service';

@Component({
  selector: 'app-server-host-form',
  templateUrl: './server-host-form.component.html',
  styleUrl: './server-host-form.component.scss',
})
export class ServerHostFormComponent implements OnChanges {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Input() savedPayload: MaintenancePayload | null = null;
  @Input() readOnly = false;

  @Output() requestComplete = new EventEmitter<ServerHostPayload>();
  @Output() requestSave     = new EventEmitter<ServerHostPayload>();
  @Output() requestNotDone  = new EventEmitter<void>();

  vmwareResults = new Map<number, VmwareHealthResult>();
  loadingHosts  = new Set<number>();
  hostErrors    = new Map<number, string>();
  notesControl  = new FormControl('');

  constructor(private readonly vmwareApiService: VmwareApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['savedPayload'] && this.savedPayload) {
      this.restoreFromPayload(this.savedPayload);
    }
    if (changes['readOnly']) {
      if (this.readOnly) {
        this.notesControl.disable({ emitEvent: false });
      } else {
        this.notesControl.enable({ emitEvent: false });
      }
    }
  }

  onRunCheck(uri: string, assetId: number): void {
    this.loadingHosts.add(assetId);
    this.hostErrors.delete(assetId);
    this.vmwareApiService.healthCheck(uri).subscribe({
      next: (result) => {
        this.vmwareResults.set(assetId, result);
        this.loadingHosts.delete(assetId);
      },
      error: (err) => {
        this.hostErrors.set(assetId, err?.error?.message ?? 'Error al ejecutar el control');
        this.loadingHosts.delete(assetId);
      },
    });
  }

  submit(): void {
    this.requestComplete.emit(this.buildPayload());
  }

  save(): void {
    this.requestSave.emit(this.buildPayload());
  }

  submitNotDone(): void {
    this.requestNotDone.emit();
  }

  buildPayload(): ServerHostPayload {
    return {
      type: 'SERVER_HOST_MAINTENANCE',
      esxiHosts: this.infrastructure.esxiHosts.map((host): EsxiHostEntry => ({
        assetId: host.assetId,
        vmwareCheck: this.vmwareResults.get(host.assetId) ?? null,
      })),
      notes: this.notesControl.value || undefined,
    };
  }

  private restoreFromPayload(payload: MaintenancePayload): void {
    if (payload.type !== 'SERVER_HOST_MAINTENANCE') return;
    const srv = payload as ServerHostPayload;
    this.notesControl.setValue(srv.notes ?? '', { emitEvent: false });
    for (const entry of (srv.esxiHosts ?? [])) {
      if (entry.vmwareCheck) {
        this.vmwareResults.set(entry.assetId, entry.vmwareCheck);
      }
    }
  }
}
