import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { forkJoin, Subscription } from 'rxjs';
import { Client } from '../../../../core/models/client.models';
import { Technician } from '../../../../core/models/technician.models';
import { TaskType, TaskTypeConfigDto } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import { ClientsService } from '../../../../core/services/clients.service';
import { TechniciansService } from '../../../../core/services/technicians.service';
import { TasksService } from '../../../../core/services/tasks.service';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { TaskConfigService } from '../../../../core/services/task-config.service';

@Component({
  selector: 'app-task-create-dialog',
  templateUrl: './task-create-dialog.component.html',
  styleUrls: ['./task-create-dialog.component.scss'],
})
export class TaskCreateDialogComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  clients: Client[] = [];
  technicians: Technician[] = [];
  loading = false;
  saving = false;
  error = '';

  infra: ClientInfrastructure | null = null;
  loadingInfra = false;
  infraError = '';
  taskConfigs: TaskTypeConfigDto[] = [];

  private clientSub?: Subscription;

  private readonly REQUIRES_INFRA: Partial<Record<TaskType, (i: ClientInfrastructure) => boolean>> = {
    SERVER_HOST_MAINTENANCE:    (i) => i.esxiHosts.length > 0,
    WINDOWS_DOMAIN_MAINTENANCE: (i) => i.windowsVMs.length > 0 || i.domainControllers.length > 0,
    ROUTER_MAINTENANCE:         (i) => i.routers.length > 0,
    QNAP_MAINTENANCE:           (i) => i.nas.length > 0,
    VEEAM_BACKUP:               (i) => i.nas.length > 0,
  };

  readonly taskTypes: { value: TaskType; label: string }[] = [
    { value: 'WINDOWS_DOMAIN_MAINTENANCE', label: 'Windows / Dominio'           },
    { value: 'SERVER_HOST_MAINTENANCE',    label: 'VMware / BMC'                },
    { value: 'ROUTER_MAINTENANCE',         label: 'Router / Firewall'           },
    { value: 'QNAP_MAINTENANCE',           label: 'Mantenimiento QNAP/NAS'      },
    { value: 'VEEAM_BACKUP',              label: 'Mantenimiento Veeam Backup'   },
    { value: 'TERMINAL_MAINTENANCE',       label: 'Visita de terminales'         },
    { value: 'SITE_VISIT',                label: 'Visita presencial'            },
    { value: 'AV_CONTROL',               label: 'Control antivirus'            },
    { value: 'UPS_CONTROL',              label: 'Control UPS'                  },
    { value: 'ENDPOINT_INVENTORY',        label: 'Inventario de endpoints'      },
  ];

  get selectedTechForDialog(): Technician | null {
    const id = this.form.get('technicianId')?.value;
    if (!id) return null;
    return this.technicians?.find(t => t.id === id) ?? null;
  }

  get availableTaskTypes(): { value: TaskType; label: string }[] {
    const withTags = this.taskTypes.filter(({ value }) => this.hasTagConfig(value));
    if (!this.infra) return withTags;
    return withTags.filter(({ value }) => {
      const predicate = this.REQUIRES_INFRA[value];
      return !predicate || predicate(this.infra!);
    });
  }

  private hasTagConfig(type: TaskType): boolean {
    const config = this.taskConfigs.find(c => c.taskType === type);
    return !!config && config.odooTagIds.length > 0;
  }

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TaskCreateDialogComponent>,
    private clientsService: ClientsService,
    private techniciansService: TechniciansService,
    private tasksService: TasksService,
    private infradocService: InfradocService,
    private taskConfigService: TaskConfigService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      clientId:      ['', Validators.required],
      technicianId:  ['', Validators.required],
      type:          ['WINDOWS_DOMAIN_MAINTENANCE', Validators.required],
      scheduledDate: ['', Validators.required],
    });

    this.clientSub = this.form.get('clientId')!.valueChanges.subscribe(clientId => {
      this.infra = null;
      this.infraError = '';
      if (!clientId) return;

      this.loadingInfra = true;
      this.form.get('type')!.disable();
      this.infradocService.getClientInfrastructure(clientId).subscribe({
        next: (infra) => {
          this.infra = infra;
          this.loadingInfra = false;
          this.form.get('type')!.enable();
          const currentType = this.form.get('type')!.value as TaskType;
          if (currentType && !this.availableTaskTypes.find(t => t.value === currentType)) {
            this.form.get('type')!.reset();
          }
        },
        error: () => {
          this.infraError = 'No se pudo verificar la infraestructura. Reintentá.';
          this.loadingInfra = false;
          this.form.get('type')!.enable();
        },
      });
    });

    this.loading = true;
    forkJoin({
      clients:     this.clientsService.getAll(),
      technicians: this.techniciansService.getAll(),
      taskConfigs: this.taskConfigService.getAll(),
    }).subscribe({
      next: ({ clients, technicians, taskConfigs }) => {
        this.clients     = clients.filter(c => c.isActive);
        this.technicians = technicians.filter(t => t.user.isActive);
        this.taskConfigs = taskConfigs;
        this.loading = false;

        const currentType = this.form.get('type')!.value as TaskType;
        if (currentType && !this.availableTaskTypes.find(t => t.value === currentType)) {
          this.form.get('type')!.reset();
        }
      },
      error: () => { this.error = 'No se pudieron cargar los datos.'; this.loading = false; },
    });
  }

  ngOnDestroy(): void {
    this.clientSub?.unsubscribe();
  }

  confirm(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    this.error = '';

    const { clientId, technicianId, type, scheduledDate } = this.form.getRawValue();
    const dateStr = scheduledDate instanceof Date
      ? scheduledDate.toISOString().split('T')[0]
      : scheduledDate;

    this.tasksService.create({ clientId, technicianId, type, scheduledDate: dateStr }).subscribe({
      next: task => this.dialogRef.close(task),
      error: (err: HttpErrorResponse) => {
        this.error = err?.error?.message ?? 'No se pudo crear la tarea.';
        this.saving = false;
      },
    });
  }

  cancel(): void { this.dialogRef.close(null); }
}
