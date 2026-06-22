import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { Client } from '../../../../core/models/client.models';
import { Technician } from '../../../../core/models/technician.models';
import { TaskType } from '../../../../core/models/task.models';
import { ClientsService } from '../../../../core/services/clients.service';
import { TechniciansService } from '../../../../core/services/technicians.service';
import { TasksService } from '../../../../core/services/tasks.service';

@Component({
  selector: 'app-task-create-dialog',
  templateUrl: './task-create-dialog.component.html',
  styleUrls: ['./task-create-dialog.component.scss'],
})
export class TaskCreateDialogComponent implements OnInit {
  form!: FormGroup;
  clients: Client[] = [];
  technicians: Technician[] = [];
  loading = false;
  saving = false;
  error = '';

  readonly taskTypes: { value: TaskType; label: string }[] = [
    { value: 'SERVER_MAINTENANCE',   label: 'Mantenimiento de servidores' },
    { value: 'QNAP_MAINTENANCE',     label: 'Mantenimiento QNAP/NAS'      },
    { value: 'TERMINAL_MAINTENANCE', label: 'Visita de terminales'         },
    { value: 'SITE_VISIT',           label: 'Visita presencial'            },
    { value: 'AV_CONTROL',           label: 'Control antivirus'            },
    { value: 'UPS_CONTROL',          label: 'Control UPS'                  },
    { value: 'ENDPOINT_INVENTORY',   label: 'Inventario de endpoints'      },
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TaskCreateDialogComponent>,
    private clientsService: ClientsService,
    private techniciansService: TechniciansService,
    private tasksService: TasksService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      clientId:      ['', Validators.required],
      technicianId:  ['', Validators.required],
      type:          ['SERVER_MAINTENANCE', Validators.required],
      scheduledDate: ['', Validators.required],
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

  confirm(): void {
    if (this.form.invalid || this.saving) return;
    this.saving = true;
    this.error = '';

    const { clientId, technicianId, type, scheduledDate } = this.form.value;
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
