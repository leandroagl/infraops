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
import { throwError } from 'rxjs';
import { TaskCreateDialogComponent } from './task-create-dialog.component';
import { ClientsService } from '../../../../core/services/clients.service';
import { TechniciansService } from '../../../../core/services/technicians.service';
import { TasksService } from '../../../../core/services/tasks.service';
import { InfradocService } from '../../../../core/services/infradoc.service';
import { TaskConfigService } from '../../../../core/services/task-config.service';
import { ClientInfrastructure } from '../../../../core/models/infradoc.models';
import { TaskType, TaskTypeConfigDto } from '../../../../core/models/task.models';
import { SharedModule } from '../../../../shared/shared.module';

const mockClients = [{ id: 'c1', name: 'Cliente A', isActive: true }];
const mockTechnicians = [{ id: 'tech1', user: { id: 'u1', name: 'Valen', email: 'v@ondra.com', isActive: true } }];

const ALL_TASK_TYPES: TaskType[] = [
  'WINDOWS_DOMAIN_MAINTENANCE', 'SERVER_HOST_MAINTENANCE', 'ROUTER_MAINTENANCE',
  'QNAP_MAINTENANCE', 'VEEAM_BACKUP', 'TERMINAL_MAINTENANCE', 'SITE_VISIT',
  'AV_CONTROL', 'UPS_CONTROL', 'ENDPOINT_INVENTORY',
];

const fullyTaggedConfigs: TaskTypeConfigDto[] = ALL_TASK_TYPES.map(taskType => ({
  taskType,
  defaultTimeMinutes: 60,
  odooTagIds: [1],
  odooTagNames: ['Tag'],
  ticketDescription: null,
  timesheetDescription: null,
  updatedAt: '2026-01-01T00:00:00Z',
}));

const emptyInfra: ClientInfrastructure = {
  esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
};

const infraRoutersOnly: ClientInfrastructure = {
  ...emptyInfra,
  routers: [{ assetId: 1, name: 'FW-01', ip: '10.0.0.1', bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: null, uri2: null }],
};

const infraNasOnly: ClientInfrastructure = {
  ...emptyInfra,
  nas: [{ assetId: 2, name: 'NAS-01', ip: '192.168.1.50', bmcIp: null, bmcType: null, os: null, make: null, model: null, uri1: null, uri2: null }],
};

describe('TaskCreateDialogComponent', () => {
  let fixture: ComponentFixture<TaskCreateDialogComponent>;
  let component: TaskCreateDialogComponent;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let techniciansServiceSpy: jasmine.SpyObj<TechniciansService>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<TaskCreateDialogComponent>>;
  let infradocServiceSpy: jasmine.SpyObj<InfradocService>;
  let taskConfigServiceSpy: jasmine.SpyObj<TaskConfigService>;

  async function setup(configs: TaskTypeConfigDto[] = fullyTaggedConfigs): Promise<void> {
    clientsServiceSpy = jasmine.createSpyObj('ClientsService', ['getAll']);
    techniciansServiceSpy = jasmine.createSpyObj('TechniciansService', ['getAll']);
    tasksServiceSpy = jasmine.createSpyObj('TasksService', ['create']);
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    infradocServiceSpy = jasmine.createSpyObj('InfradocService', ['getClientInfrastructure']);
    taskConfigServiceSpy = jasmine.createSpyObj('TaskConfigService', ['getAll']);

    clientsServiceSpy.getAll.and.returnValue(of(mockClients as any));
    techniciansServiceSpy.getAll.and.returnValue(of(mockTechnicians as any));
    taskConfigServiceSpy.getAll.and.returnValue(of(configs));

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
        SharedModule,
      ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRefSpy },
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: ClientsService, useValue: clientsServiceSpy },
        { provide: TechniciansService, useValue: techniciansServiceSpy },
        { provide: TasksService, useValue: tasksServiceSpy },
        { provide: InfradocService, useValue: infradocServiceSpy },
        { provide: TaskConfigService, useValue: taskConfigServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskCreateDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  beforeEach(async () => setup());

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

  it('contiene WINDOWS_DOMAIN_MAINTENANCE, SERVER_HOST_MAINTENANCE y ROUTER_MAINTENANCE en la lista de tipos', () => {
    const values = component.taskTypes.map(t => t.value);
    expect(values).toContain('WINDOWS_DOMAIN_MAINTENANCE');
    expect(values).toContain('SERVER_HOST_MAINTENANCE');
    expect(values).toContain('ROUTER_MAINTENANCE');
  });

  it('carga clientes y técnicos activos al iniciar', () => {
    expect(component.clients).toEqual(mockClients as any);
    expect(component.technicians).toEqual(mockTechnicians as any);
  });

  describe('filtrado por infraestructura', () => {
    it('muestra todos los tipos cuando no hay cliente seleccionado', () => {
      expect(component.availableTaskTypes.length).toBe(component.taskTypes.length);
    });

    it('filtra tipos cuando el cliente solo tiene routers', async () => {
      infradocServiceSpy.getClientInfrastructure.and.returnValue(of(infraRoutersOnly));

      component.form.get('clientId')!.setValue('c1');
      await fixture.whenStable();

      const available = component.availableTaskTypes.map(t => t.value);
      expect(available).toContain('ROUTER_MAINTENANCE');
      expect(available).not.toContain('SERVER_HOST_MAINTENANCE');
      expect(available).not.toContain('WINDOWS_DOMAIN_MAINTENANCE');
      expect(available).not.toContain('QNAP_MAINTENANCE');
      expect(available).not.toContain('VEEAM_BACKUP');
      expect(available).toContain('SITE_VISIT');
      expect(available).toContain('TERMINAL_MAINTENANCE');
    });

    it('incluye QNAP_MAINTENANCE y VEEAM_BACKUP cuando el cliente tiene NAS', async () => {
      infradocServiceSpy.getClientInfrastructure.and.returnValue(of(infraNasOnly));

      component.form.get('clientId')!.setValue('c1');
      await fixture.whenStable();

      const available = component.availableTaskTypes.map(t => t.value);
      expect(available).toContain('QNAP_MAINTENANCE');
      expect(available).toContain('VEEAM_BACKUP');
    });

    it('resetea el campo type si el tipo actual no está disponible para el cliente', async () => {
      component.form.get('type')!.setValue('SERVER_HOST_MAINTENANCE');
      infradocServiceSpy.getClientInfrastructure.and.returnValue(of(infraRoutersOnly));

      component.form.get('clientId')!.setValue('c1');
      await fixture.whenStable();

      expect(component.form.get('type')!.value).toBeNull();
    });

    it('muestra error y deshabilita el botón cuando InfraDoc falla', async () => {
      infradocServiceSpy.getClientInfrastructure.and.returnValue(
        throwError(() => new Error('Network error')),
      );

      component.form.get('clientId')!.setValue('c1');
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.infraError).toBeTruthy();
      const button = fixture.nativeElement.querySelector('button[color="primary"]');
      expect(button.disabled).toBeTrue();
    });

    it('resetea el error y carga la infra al cambiar de cliente', async () => {
      infradocServiceSpy.getClientInfrastructure.and.returnValue(
        throwError(() => new Error('error')),
      );
      component.form.get('clientId')!.setValue('c1');
      await fixture.whenStable();
      expect(component.infraError).toBeTruthy();

      infradocServiceSpy.getClientInfrastructure.and.returnValue(of(infraRoutersOnly));
      component.form.get('clientId')!.setValue('c2');
      await fixture.whenStable();

      expect(component.infraError).toBe('');
      expect(component.infra).toEqual(infraRoutersOnly);
    });
  });

  describe('filtrado por tags de Odoo configurados', () => {
    it('excluye tipos de tarea sin tags de Odoo configurados', async () => {
      TestBed.resetTestingModule();
      await setup(fullyTaggedConfigs.map(c =>
        c.taskType === 'ROUTER_MAINTENANCE' ? { ...c, odooTagIds: [] } : c,
      ));

      const available = component.availableTaskTypes.map(t => t.value);
      expect(available).not.toContain('ROUTER_MAINTENANCE');
      expect(available).toContain('WINDOWS_DOMAIN_MAINTENANCE');
    });

    it('resetea el campo type si el tipo por defecto no tiene tags configurados', async () => {
      TestBed.resetTestingModule();
      await setup(fullyTaggedConfigs.map(c =>
        c.taskType === 'WINDOWS_DOMAIN_MAINTENANCE' ? { ...c, odooTagIds: [] } : c,
      ));

      expect(component.form.get('type')!.value).toBeNull();
    });

    it('excluye tipos sin fila de configuración (nunca configurados)', async () => {
      TestBed.resetTestingModule();
      await setup(fullyTaggedConfigs.filter(c => c.taskType !== 'SITE_VISIT'));

      const available = component.availableTaskTypes.map(t => t.value);
      expect(available).not.toContain('SITE_VISIT');
    });
  });
});
