import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Task } from '../../../../core/models/task.models';
import { ClientInfrastructure, InfraAsset } from '../../../../core/models/infradoc.models';
import { LogItem, LogResult, MaintenanceLogsService } from '../../../../core/services/maintenance-logs.service';
import { TasksService } from '../../../../core/services/tasks.service';

@Component({
  selector: 'app-maintenance-form',
  templateUrl: './maintenance-form.component.html',
  styleUrl: './maintenance-form.component.scss',
})
export class MaintenanceFormComponent implements OnInit {
  @Input() task!: Task;
  @Input() infrastructure!: ClientInfrastructure;
  @Output() saved = new EventEmitter<void>();

  form!: FormGroup;
  saving = false;
  error = '';
  success = false;

  readonly resultOptions = [
    { value: 'ok',   label: 'OK'       },
    { value: 'warn', label: 'Atención' },
    { value: 'error', label: 'Error'   },
  ];

  constructor(
    private fb: FormBuilder,
    private logsService: MaintenanceLogsService,
    private tasksService: TasksService,
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  private buildForm(): void {
    this.form = this.fb.group({
      servers: this.fb.array(
        this.infrastructure.servers.map(srv => this.serverGroup(srv)),
      ),
      vms: this.fb.array(
        this.infrastructure.vms.map(vm => this.vmGroup(vm)),
      ),
      notes: [''],
    });
  }

  private serverGroup(srv: InfraAsset): FormGroup {
    return this.fb.group({
      name:        [srv.name],
      dcdiag:      ['ok', Validators.required],
      dcdiagNotes: [''],
      veeam:       ['ok', Validators.required],
      veeamNotes:  [''],
      metrics:     ['ok', Validators.required],
    });
  }

  private vmGroup(vm: InfraAsset): FormGroup {
    return this.fb.group({
      name:   [vm.name],
      status: ['ok', Validators.required],
    });
  }

  get servers(): FormArray { return this.form.get('servers') as FormArray; }
  get vms(): FormArray     { return this.form.get('vms') as FormArray;     }

  serverAt(i: number): FormGroup { return this.servers.at(i) as FormGroup; }
  vmAt(i: number): FormGroup     { return this.vms.at(i) as FormGroup;     }

  resultClass(value: string): string {
    return value === 'ok' ? 'sel--ok' : value === 'warn' ? 'sel--warn' : 'sel--error';
  }

  submit(finalStatus: 'IN_PROGRESS' | 'DONE' | 'ESCALATED'): void {
    if (this.form.invalid || this.saving) return;

    this.saving = true;
    this.error = '';

    const payload = this.buildPayload();
    const notes = this.form.value.notes || undefined;

    this.logsService.create(this.task.id, { payload, notes }).subscribe({
      next: () => {
        if (finalStatus !== 'IN_PROGRESS') {
          this.tasksService.updateStatus(this.task.id, { status: finalStatus }).subscribe({
            next: () => { this.saving = false; this.success = true; this.saved.emit(); },
            error: () => { this.saving = false; this.error = 'Log guardado, pero no se pudo actualizar el estado.'; },
          });
        } else {
          this.saving = false;
          this.success = true;
          this.saved.emit();
        }
      },
      error: () => { this.saving = false; this.error = 'No se pudo guardar el registro.'; },
    });
  }

  private buildPayload(): LogItem[] {
    const items: LogItem[] = [];

    for (const srv of this.servers.value) {
      items.push({ item: `${srv.name} — DCDIAG`,  result: srv.dcdiag  as LogResult, notes: srv.dcdiagNotes || undefined });
      items.push({ item: `${srv.name} — Veeam`,   result: srv.veeam   as LogResult, notes: srv.veeamNotes  || undefined });
      items.push({ item: `${srv.name} — Métricas`, result: srv.metrics as LogResult });
    }

    for (const vm of this.vms.value) {
      items.push({ item: `${vm.name} — Estado VM`, result: vm.status as LogResult });
    }

    return items;
  }
}
