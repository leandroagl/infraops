import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { TasksUnifiedComponent } from './tasks-unified.component';
import { TasksService } from '../../core/services/tasks.service';
import { AuthService } from '../../core/services/auth.service';
import { ClientsService } from '../../core/services/clients.service';
import { TechniciansService } from '../../core/services/technicians.service';
import { Task } from '../../core/models/task.models';
import { environment } from '../../../environments/environment';

function makeTask(id: string, clientId: string, clientName: string, status: Task['status'] = 'PENDING'): Task {
  return {
    id, clientId, technicianId: 'tech-1',
    type: 'SERVER_HOST_MAINTENANCE', status,
    scheduledDate: '2026-08-01', completedDate: null,
    odooTicketId: null, createdAt: '2026-08-01T00:00:00Z',
    client: { id: clientId, name: clientName },
    technician: { id: 'tech-1', user: { id: 'u1', name: 'Valen', email: 'v@ondra', avatarUrl: null } },
  };
}

describe('TasksUnifiedComponent', () => {
  let component: TasksUnifiedComponent;
  let fixture: ComponentFixture<TasksUnifiedComponent>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let techniciansServiceSpy: jasmine.SpyObj<TechniciansService>;
  const now = new Date();

  beforeEach(async () => {
    tasksServiceSpy      = jasmine.createSpyObj('TasksService', ['getAll']);
    authServiceSpy       = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    clientsServiceSpy    = jasmine.createSpyObj('ClientsService', ['getAll']);
    techniciansServiceSpy = jasmine.createSpyObj('TechniciansService', ['getAll']);

    tasksServiceSpy.getAll.and.returnValue(of([
      makeTask('t1', 'c1', 'ACME S.A.', 'DONE'),
      makeTask('t2', 'c1', 'ACME S.A.', 'PENDING'),
      makeTask('t3', 'c2', 'Distribuidora', 'IN_PROGRESS'),
    ]));
    clientsServiceSpy.getAll.and.returnValue(of([]));
    techniciansServiceSpy.getAll.and.returnValue(of([]));
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'u1', name: 'Omar Admin', email: 'omar@ondra', role: 'ADMIN', technicianId: null, avatarUrl: null,
    });

    await TestBed.configureTestingModule({
      declarations: [TasksUnifiedComponent],
      imports: [NoopAnimationsModule, ReactiveFormsModule, MatButtonModule, MatIconModule, MatDialogModule, MatSnackBarModule],
      providers: [
        { provide: TasksService,       useValue: tasksServiceSpy       },
        { provide: AuthService,        useValue: authServiceSpy        },
        { provide: ClientsService,     useValue: clientsServiceSpy     },
        { provide: TechniciansService, useValue: techniciansServiceSpy },
        { provide: MatDialog,      useValue: jasmine.createSpyObj('MatDialog', ['open']) },
        { provide: MatSnackBar,    useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksUnifiedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga las tareas del mes y año actuales al iniciar', () => {
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ month: now.getMonth() + 1, year: now.getFullYear() })
    );
  });

  it('carga la lista de clientes al iniciar', () => {
    expect(clientsServiceSpy.getAll).toHaveBeenCalled();
  });

  it('carga la lista de técnicos al iniciar', () => {
    expect(techniciansServiceSpy.getAll).toHaveBeenCalled();
  });

  it('agrupa las tareas por cliente', () => {
    expect(component.groups.length).toBe(2);
    expect(component.groups[0].clientId).toBe('c1');
    expect(component.groups[0].tasks.length).toBe(2);
    expect(component.groups[1].clientId).toBe('c2');
  });

  it('calcula stats correctamente', () => {
    expect(component.stats.assigned).toBe(3);
    expect(component.stats.done).toBe(1);
    expect(component.stats.pending).toBe(1);
    expect(component.stats.inprogress).toBe(1);
  });

  it('navegar al mes anterior recarga con el mes correcto', () => {
    const prevMonth = component.currentMonth === 1 ? 12 : component.currentMonth - 1;
    const prevYear  = component.currentMonth === 1 ? component.currentYear - 1 : component.currentYear;
    component.prevMonth();
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ month: prevMonth, year: prevYear })
    );
  });

  it('TECHNICIAN ve todas las tareas por defecto (sin filtro de técnico automático)', () => {
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'u2', name: 'Valentina', email: 'valen@ondra', role: 'TECHNICIAN', technicianId: 'tech-1', avatarUrl: null,
    });
    tasksServiceSpy.getAll.and.returnValue(of([]));
    component.ngOnInit();
    const lastCall = tasksServiceSpy.getAll.calls.mostRecent().args[0] as Record<string, unknown>;
    expect(lastCall['technicianId']).toBeUndefined();
  });

  it('onFilterChange pasa techFilter (technicianId) a la API', () => {
    component.techFilter = 'tech-1';
    component.onFilterChange();
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ technicianId: 'tech-1' })
    );
  });

  it('onFilterChange pasa clientFilter a la API', () => {
    component.clientFilter = 'c1';
    component.onFilterChange();
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ clientId: 'c1' })
    );
  });

  it('onFilterChange pasa typeFilter a la API', () => {
    component.typeFilter = 'VEEAM_BACKUP';
    component.onFilterChange();
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ type: 'VEEAM_BACKUP' })
    );
  });

  it('onFilterChange pasa statusFilter a la API', () => {
    component.statusFilter = 'DONE';
    component.onFilterChange();
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith(
      jasmine.objectContaining({ status: 'DONE' })
    );
  });

  it('clearFilters resetea todos los filtros y recarga', () => {
    component.clientFilter = 'c1';
    component.typeFilter   = 'AV_CONTROL';
    component.statusFilter = 'PENDING';
    component.techFilter   = 'tech-1';
    component.clearFilters();
    expect(component.clientFilter).toBeNull();
    expect(component.typeFilter).toBeNull();
    expect(component.statusFilter).toBeNull();
    expect(component.techFilter).toBeNull();
    expect(tasksServiceSpy.getAll).toHaveBeenCalled();
  });

  it('hasActiveFilters es true cuando hay algún filtro activo', () => {
    component.clientFilter = 'c1';
    expect(component.hasActiveFilters).toBeTrue();
  });

  it('hasActiveFilters es false cuando no hay filtros activos', () => {
    component.clientFilter = null;
    component.typeFilter   = null;
    component.statusFilter = null;
    component.techFilter   = null;
    expect(component.hasActiveFilters).toBeFalse();
  });

  it('cycleClosed es true cuando el mes seleccionado es anterior al actual', () => {
    component.currentYear  = now.getFullYear();
    component.currentMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    if (component.currentMonth === 12) component.currentYear = now.getFullYear() - 1;
    expect(component.cycleClosed).toBeTrue();
  });

  it('cycleClosed es false para el mes actual', () => {
    component.currentMonth = now.getMonth() + 1;
    component.currentYear  = now.getFullYear();
    expect(component.cycleClosed).toBeFalse();
  });

  it('muestra error si la carga falla', () => {
    tasksServiceSpy.getAll.and.returnValue(throwError(() => new Error('red')));
    component.load();
    expect(component.error).toBeTruthy();
  });

  describe('canCreateTask', () => {
    it('es true para ADMIN cuando allowManualTaskCreation está habilitado', () => {
      environment.allowManualTaskCreation = true;
      authServiceSpy.getCurrentUser.and.returnValue({ id: 'u1', name: 'Admin User', email: 'a@ondra', role: 'ADMIN', technicianId: null, avatarUrl: null });
      expect(component.canCreateTask).toBeTrue();
      environment.allowManualTaskCreation = false;
    });

    it('es false para ADMIN cuando allowManualTaskCreation está deshabilitado', () => {
      environment.allowManualTaskCreation = false;
      authServiceSpy.getCurrentUser.and.returnValue({ id: 'u1', name: 'Admin User', email: 'a@ondra', role: 'ADMIN', technicianId: null, avatarUrl: null });
      expect(component.canCreateTask).toBeFalse();
    });

    it('es false para TL aunque allowManualTaskCreation esté habilitado', () => {
      environment.allowManualTaskCreation = true;
      authServiceSpy.getCurrentUser.and.returnValue({ id: 'u3', name: 'TL User', email: 'tl@ondra', role: 'TL', technicianId: 'tl-1', avatarUrl: null });
      expect(component.canCreateTask).toBeFalse();
      environment.allowManualTaskCreation = false;
    });

    it('es false para COORDINATOR aunque allowManualTaskCreation esté habilitado', () => {
      environment.allowManualTaskCreation = true;
      authServiceSpy.getCurrentUser.and.returnValue({ id: 'u4', name: 'Coordinator User', email: 'lau@ondra', role: 'COORDINATOR', technicianId: null, avatarUrl: null });
      expect(component.canCreateTask).toBeFalse();
      environment.allowManualTaskCreation = false;
    });
  });

  it('botón Nueva tarea no se muestra cuando allowManualTaskCreation es false', () => {
    environment.allowManualTaskCreation = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[color="primary"]')).toBeNull();
  });
});
