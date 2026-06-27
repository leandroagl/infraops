import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { of, throwError } from 'rxjs';
import { ClientMantenimientosComponent } from './client-mantenimientos.component';
import { TasksService } from '../../../core/services/tasks.service';
import { Task } from '../../../core/models/task.models';

const mockTask: Task = {
  id: 't1',
  clientId: 'c1',
  technicianId: 'tech1',
  type: 'WINDOWS_DOMAIN_MAINTENANCE',
  status: 'PENDING',
  scheduledDate: '2026-06-01T00:00:00.000Z',
  completedDate: null,
  odooTicketId: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  technician: { id: 'tech1', user: { id: 'u1', name: 'Valen', email: 'v@ondra.com' } },
};

const mockRoute = {
  parent: { snapshot: { paramMap: convertToParamMap({ id: 'c1' }) } },
};

describe('ClientMantenimientosComponent', () => {
  let fixture: ComponentFixture<ClientMantenimientosComponent>;
  let component: ClientMantenimientosComponent;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;

  beforeEach(async () => {
    tasksServiceSpy = jasmine.createSpyObj('TasksService', ['getAll']);
    tasksServiceSpy.getAll.and.returnValue(of([mockTask]));

    await TestBed.configureTestingModule({
      declarations: [ClientMantenimientosComponent],
      imports: [NoopAnimationsModule, MatTabsModule, MatTableModule],
      providers: [
        { provide: ActivatedRoute, useValue: mockRoute },
        { provide: TasksService, useValue: tasksServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientMantenimientosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra el tab de Servidores', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Servidores');
  });

  it('carga tareas de tipo servidor del cliente al iniciar', () => {
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith({ clientId: 'c1', type: 'WINDOWS_DOMAIN_MAINTENANCE' });
    expect(tasksServiceSpy.getAll).toHaveBeenCalledWith({ clientId: 'c1', type: 'SERVER_HOST_MAINTENANCE' });
  });

  it('almacena las tareas recibidas', () => {
    expect(component.tasks.length).toBe(2);
    expect(component.tasks[0]).toEqual(mockTask);
  });

  it('muestra error cuando el servicio falla', () => {
    tasksServiceSpy.getAll.and.returnValue(throwError(() => new Error('fail')));
    component.ngOnInit();
    expect(component.error).toBeTruthy();
  });
});
