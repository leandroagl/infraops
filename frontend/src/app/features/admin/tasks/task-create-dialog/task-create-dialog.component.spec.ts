import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { of } from 'rxjs';
import { TaskCreateDialogComponent } from './task-create-dialog.component';
import { ClientsService } from '../../../../core/services/clients.service';
import { TechniciansService } from '../../../../core/services/technicians.service';
import { TasksService } from '../../../../core/services/tasks.service';

const mockClients = [{ id: 'c1', name: 'Cliente A', isActive: true }];
const mockTechnicians = [{ id: 'tech1', user: { id: 'u1', name: 'Valen', email: 'v@ondra.com', isActive: true } }];

describe('TaskCreateDialogComponent', () => {
  let fixture: ComponentFixture<TaskCreateDialogComponent>;
  let component: TaskCreateDialogComponent;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let techniciansServiceSpy: jasmine.SpyObj<TechniciansService>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<TaskCreateDialogComponent>>;

  beforeEach(async () => {
    clientsServiceSpy = jasmine.createSpyObj('ClientsService', ['getAll']);
    techniciansServiceSpy = jasmine.createSpyObj('TechniciansService', ['getAll']);
    tasksServiceSpy = jasmine.createSpyObj('TasksService', ['create']);
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    clientsServiceSpy.getAll.and.returnValue(of(mockClients as any));
    techniciansServiceSpy.getAll.and.returnValue(of(mockTechnicians as any));

    await TestBed.configureTestingModule({
      declarations: [TaskCreateDialogComponent],
      imports: [
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatDatepickerModule,
        MatNativeDateModule,
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: ClientsService, useValue: clientsServiceSpy },
        { provide: TechniciansService, useValue: techniciansServiceSpy },
        { provide: TasksService, useValue: tasksServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskCreateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('crea el componente correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('el tipo de tarea por defecto es WINDOWS_DOMAIN_MAINTENANCE', () => {
    expect(component.form.get('type')?.value).toBe('WINDOWS_DOMAIN_MAINTENANCE');
  });

  it('no contiene SERVER_MAINTENANCE en la lista de tipos', () => {
    const values = component.taskTypes.map(t => t.value);
    expect(values).not.toContain('SERVER_MAINTENANCE' as any);
  });

  it('contiene WINDOWS_DOMAIN_MAINTENANCE y SERVER_HOST_MAINTENANCE en la lista de tipos', () => {
    const values = component.taskTypes.map(t => t.value);
    expect(values).toContain('WINDOWS_DOMAIN_MAINTENANCE');
    expect(values).toContain('SERVER_HOST_MAINTENANCE');
  });

  it('carga clientes y técnicos activos al iniciar', () => {
    expect(component.clients).toEqual(mockClients as any);
    expect(component.technicians).toEqual(mockTechnicians as any);
  });
});
