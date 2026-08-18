import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { CycleTableComponent } from './cycle-table.component';
import { Task, TaskGroup } from '../../../core/models/task.models';

function makeTask(id: string, clientId: string, techId: string, status: Task['status'] = 'PENDING'): Task {
  return {
    id, clientId, technicianId: techId,
    type: 'SERVER_HOST_MAINTENANCE', status,
    scheduledDate: '2026-08-01', completedDate: null,
    odooTicketId: 3810, createdAt: '2026-08-01T00:00:00Z',
    client: { id: clientId, name: 'ACME S.A.' },
    technician: { id: techId, user: { id: 'u1', name: 'Valen', email: 'v@ondra' } },
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
      imports: [NoopAnimationsModule, CommonModule],
    }).compileComponents();
    fixture = TestBed.createComponent(CycleTableComponent);
    component = fixture.componentInstance;
    component.groups = GROUPS;
    component.selectedTaskId = null;
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
});
