import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { forkJoin, Subscription } from 'rxjs';
import { Client } from '../../../../core/models/client.models';
import { Technician } from '../../../../core/models/technician.models';
import { TaskType } from '../../../../core/models/task.models';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import { ClientsService } from '../../../../core/services/clients.service';
import { TechniciansService } from '../../../../core/services/technicians.service';
import { TasksService } from '../../../../core/services/tasks.service';
import { InfradocService } from '../../../../core/services/infradoc.service';

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

  get availableTaskTypes(): { value: TaskType; label: string }[] {
    if (!this.infra) return this.taskTypes;
    return this.taskTypes.filter(({ value }) => {
      const predicate = this.REQUIRES_INFRA[value];
      return !predicate || predicate(this.infra!);
    });
  }

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TaskCreateDialogComponent>,
    private clientsService: ClientsService,
    private techniciansService: TechniciansService,
    private tasksService: TasksService,
    private infradocService: InfradocService,
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
    }).subscribe({
      next: ({ clients, technicians }) => {
        this.clients     = clients.filter(c => c.isActive);
        this.technicians = technicians.filter(t => t.user.isActive);
        this.loading = false;
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
      error: () => { this.error = 'No se pudo crear la tarea.'; this.saving = false; },
    });
  }

  cancel(): void { this.dialogRef.close(null); }
}
