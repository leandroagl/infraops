import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CycleTableComponent } from './cycle-table.component';
import { Task, TaskGroup } from '../../../core/models/task.models';
import { Technician } from '../../../core/models/technician.models';
import { SharedModule } from '../../../shared/shared.module';

const makeTechnicianUser = (id: string, name: string, email: string) => ({
  id, name, email, avatarUrl: null,
  role: 'TECHNICIAN' as const, isActive: true, mustChangePassword: false, createdAt: '2026-01-01',
});

const TECHNICIANS: Technician[] = [
  { id: 'tech1', createdAt: '2026-01-01', user: makeTechnicianUser('u1', 'Valen', 'v@ondra') },
  { id: 'tech2', createdAt: '2026-01-01', user: makeTechnicianUser('u2', 'Enzo', 'e@ondra') },
];

const TASK_TYPES = [
  { value: 'SERVER_HOST_MAINTENANCE', label: 'Servidores' },
  { value: 'VEEAM_BACKUP', label: 'Veeam Backup' },
];

const TASK_STATUSES = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'DONE', label: 'Hecho' },
];

function makeTask(id: string, clientId: string, techId: string, status: Task['status'] = 'PENDING'): Task {
  return {
    id, clientId, technicianId: techId,
    type: 'SERVER_HOST_MAINTENANCE', status,
    scheduledDate: '2026-08-01', completedDate: null,
    odooTicketId: 3810, createdAt: '2026-08-01T00:00:00Z',
    client: { id: clientId, name: 'ACME S.A.' },
    technician: { id: techId, user: { id: 'u1', name: 'Valen', email: 'v@ondra', avatarUrl: null } },
  };
}

const GROUPS: TaskGroup[] = [
  {
    clientId: 'c1', clientName: 'ACME S.A.',
    tasks: [makeTask('t1', 'c1', 'tech1', 'DONE'), makeTask('t2', 'c1', 'tech1', 'PENDING')],
  },
  {
    clientId: 'c2', clientName: 'Distribuidora Norte',
    tasks: [makeTask('t3', 'c2', 'tech2', 'IN_PROGRESS')],
  },
];

describe('CycleTableComponent', () => {
  let component: CycleTableComponent;
  let fixture: ComponentFixture<CycleTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CycleTableComponent],
      imports: [NoopAnimationsModule, CommonModule, SharedModule, MatFormFieldModule, MatSelectModule],
    }).compileComponents();
    fixture = TestBed.createComponent(CycleTableComponent);
    component = fixture.componentInstance;
    component.groups = GROUPS;
    component.selectedTaskId = null;
    component.taskTypes = TASK_TYPES;
    component.technicians = TECHNICIANS;
    component.taskStatuses = TASK_STATUSES;
    fixture.detectChanges();
  });

  it('renderiza un group-header por cada grupo', () => {
    const headers = fixture.nativeElement.querySelectorAll('.group-header');
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toContain('ACME S.A.');
    expect(headers[1].textContent).toContain('Distribuidora Norte');
  });

  it('renderiza una fila por cada tarea', () => {
    const rows = fixture.nativeElement.querySelectorAll('.task-row');
    expect(rows.length).toBe(3);
  });

  it('emite taskSelected al hacer click en una fila', () => {
    const emitted: Task[] = [];
    component.taskSelected.subscribe((t: Task) => emitted.push(t));
    const row: HTMLElement = fixture.nativeElement.querySelector('.task-row');
    row.click();
    expect(emitted.length).toBe(1);
    expect(emitted[0].id).toBe('t1');
  });

  it('aplica clase selected a la fila cuyo id coincide con selectedTaskId', () => {
    component.selectedTaskId = 't2';
    fixture.detectChanges();
    const rows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.task-row');
    expect(rows[1].classList).toContain('selected');
    expect(rows[0].classList).not.toContain('selected');
  });

  it('muestra el progreso por grupo (done/total)', () => {
    const headers = fixture.nativeElement.querySelectorAll('.group-header');
    expect(headers[0].textContent).toContain('1/2');
  });

  it('muestra el número de ticket Odoo', () => {
    const firstRow: HTMLElement = fixture.nativeElement.querySelector('.task-row');
    expect(firstRow.textContent).toContain('3810');
  });

  describe('filtros en el header de columna', () => {
    it('renderiza un mat-select de Tipo con las opciones de taskTypes', () => {
      const select: HTMLElement = fixture.nativeElement.querySelector('.col-type-filter mat-select');
      expect(select).toBeTruthy();
    });

    it('emite typeFilterChange al elegir un tipo', () => {
      const emitted: (string | null)[] = [];
      component.typeFilterChange.subscribe((v: string | null) => emitted.push(v));

      component.onTypeFilterChange('VEEAM_BACKUP');

      expect(emitted).toEqual(['VEEAM_BACKUP']);
    });

    it('renderiza un mat-select de Técnico con las opciones de technicians', () => {
      const select: HTMLElement = fixture.nativeElement.querySelector('.col-tech-filter mat-select');
      expect(select).toBeTruthy();
    });

    it('emite techFilterChange al elegir un técnico', () => {
      const emitted: (string | null)[] = [];
      component.techFilterChange.subscribe((v: string | null) => emitted.push(v));

      component.onTechFilterChange('tech2');

      expect(emitted).toEqual(['tech2']);
    });

    it('selectedTechnicianObj resuelve el técnico según techFilter', () => {
      component.techFilter = 'tech2';
      expect(component.selectedTechnicianObj?.user.name).toBe('Enzo');
    });

    it('selectedTechnicianObj es null cuando no hay techFilter', () => {
      component.techFilter = null;
      expect(component.selectedTechnicianObj).toBeNull();
    });

    it('no renderiza ningún filtro para la columna Cliente (no existe esa columna)', () => {
      const headers: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('thead th');
      const headerText = Array.from(headers).map(h => h.textContent?.trim());
      expect(headerText.some(t => t?.includes('Cliente'))).toBeFalse();
    });

    it('renderiza un mat-select de Estado con las opciones de taskStatuses', () => {
      const select: HTMLElement = fixture.nativeElement.querySelector('.col-status-filter mat-select');
      expect(select).toBeTruthy();
    });

    it('emite statusFilterChange al elegir un estado', () => {
      const emitted: (string | null)[] = [];
      component.statusFilterChange.subscribe((v: string | null) => emitted.push(v));

      component.onStatusFilterChange('DONE');

      expect(emitted).toEqual(['DONE']);
    });

    it('el trigger de Técnico agrupa avatar y nombre en un contenedor con clase tech-trigger', () => {
      component.techFilter = 'tech1';
      fixture.detectChanges();
      const trigger: HTMLElement = fixture.nativeElement.querySelector('.col-tech-filter .tech-trigger');
      expect(trigger).toBeTruthy();
      expect(trigger.textContent).toContain('Valen');
    });
  });
});
