import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { TaskDrawerComponent } from './task-drawer.component';
import { TimeSpentDialogComponent } from './time-spent-dialog/time-spent-dialog.component';
import { ConfirmMaintenanceDialogComponent } from './confirm-maintenance-dialog/confirm-maintenance-dialog.component';
import { InfradocService } from '../../../core/services/infradoc.service';
import { MaintenanceLogsService } from '../../../core/services/maintenance-logs.service';
import { TasksService } from '../../../core/services/tasks.service';
import { Task, TaskType, TaskStatus } from '../../../core/models/task.models';
import {
  ServerHostPayload,
  TerminalPayload,
  MaintenancePayload,
  WindowsDomainPayload,
} from '../../../core/models/maintenance-log.models';

// ── Test helpers ────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    clientId: 'client-1',
    technicianId: 'tech-1',
    type: 'WINDOWS_DOMAIN_MAINTENANCE',
    status: 'PENDING',
    scheduledDate: '2099-01-01',
    completedDate: null,
    odooTicketId: null,
    createdAt: '2026-01-01T00:00:00Z',
    client: { id: 'client-1', name: 'Acme Corp' },
    ...overrides,
  };
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function futureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

function makeWindowsDomainPayload(overrides: Partial<WindowsDomainPayload> = {}): WindowsDomainPayload {
  return {
    type: 'WINDOWS_DOMAIN_MAINTENANCE',
    windows: { servers: [], domainControllers: [] },
    ...overrides,
  };
}

function makeTerminalPayload(overrides: Partial<TerminalPayload> = {}): TerminalPayload {
  return {
    type: 'TERMINAL_MAINTENANCE',
    checks: { cleanedTemp: true, windowsUpdates: true, antivirusOk: true, diskSpace: true, licenses: true },
    network: { connectivity: true, switches: true },
    ...overrides,
  };
}

const mockDialog = {
  open: () => ({ afterClosed: () => of(null) }),
} as unknown as MatDialog;

function makeDialogThatConfirms(timeMinutes = 90): MatDialog {
  return {
    open: (component: unknown) => ({
      afterClosed: () =>
        component === TimeSpentDialogComponent ? of(timeMinutes) : of(true),
    }),
  } as unknown as MatDialog;
}

const mockDialogThatConfirms = makeDialogThatConfirms();

// ── Pure unit tests (no TestBed) ─────────────────────────────────────────────

describe('TaskDrawerComponent — pure unit tests', () => {
  let component: TaskDrawerComponent;

  const mockInfradoc = { getClientInfrastructure: () => of(null) } as any;
  const mockLogs = { create: () => of({}), update: () => of({}), get: () => throwError(() => ({ status: 404 })) } as any;
  const mockTasks = { updateStatus: () => of({}) } as any;

  beforeEach(() => {
    component = new TaskDrawerComponent(mockInfradoc, mockLogs, mockTasks, mockDialog);
    component.task = makeTask();
  });

  // ── drawerIconStyle ────────────────────────────────────────────────────────

  describe('drawerIconStyle()', () => {
    it('should return crit colors when task is overdue', () => {
      component.task = makeTask({ scheduledDate: pastDate(3) });
      const style = component.drawerIconStyle();
      expect(style.background).toBe('var(--crit-bg)');
      expect(style.borderColor).toBe('var(--crit-bd)');
      expect(style.color).toBe('var(--crit)');
    });

    it('should return purple colors for SITE_VISIT regardless of urgency', () => {
      component.task = makeTask({ type: 'SITE_VISIT', scheduledDate: futureDate(30) });
      const style = component.drawerIconStyle();
      expect(style.background).toBe('var(--purple-bg)');
      expect(style.borderColor).toBe('var(--purple-bd)');
      expect(style.color).toBe('var(--purple)');
    });

    it('should return purple colors for TERMINAL_MAINTENANCE not overdue', () => {
      component.task = makeTask({ type: 'TERMINAL_MAINTENANCE', scheduledDate: futureDate(10) });
      const style = component.drawerIconStyle();
      expect(style.background).toBe('var(--purple-bg)');
    });

    it('should return srv colors for WINDOWS_DOMAIN_MAINTENANCE not overdue', () => {
      component.task = makeTask({ type: 'WINDOWS_DOMAIN_MAINTENANCE', scheduledDate: futureDate(10) });
      const style = component.drawerIconStyle();
      expect(style.background).toBe('var(--srv-bg)');
      expect(style.borderColor).toBe('var(--srv-bd)');
      expect(style.color).toBe('var(--srv)');
    });

    it('should return crit colors for SITE_VISIT when overdue (overdue takes priority)', () => {
      component.task = makeTask({ type: 'SITE_VISIT', scheduledDate: pastDate(5) });
      const style = component.drawerIconStyle();
      expect(style.background).toBe('var(--crit-bg)');
    });
  });

  // ── detectIssues ──────────────────────────────────────────────────────────

  describe('detectIssues()', () => {
    it('retorna dcdiagError cuando un DC de WINDOWS_DOMAIN_MAINTENANCE tiene warning que empieza con ERROR', () => {
      const payload = makeWindowsDomainPayload({
        windows: {
          servers: [],
          domainControllers: [{
            is_dc: true, dc_name: 'DC01', domain: null, collected_at: '',
            repl_healthy: null, repl_failures: null, repl_partners: null, repl_max_age_hours: null,
            dns_test_pass: null, dns_service_ok: null, dns_srv_ok: null, dns_zone_count: null,
            sysvol_state_ok: null, sysvol_backlog: null, sysvol_replication: null,
            warnings: ['ERROR: LDAP timeout'],
          }],
        },
      });
      const issues = component.detectIssues(payload);
      expect(issues.dcdiagErrors.length).toBe(1);
      expect(issues.dcdiagErrors[0]).toBe('ERROR: LDAP timeout');
    });

    it('no marca dcdiag cuando WINDOWS_DOMAIN_MAINTENANCE no tiene warnings de error', () => {
      const payload = makeWindowsDomainPayload({ windows: { servers: [], domainControllers: [] } });
      const issues = component.detectIssues(payload);
      expect(issues.dcdiagErrors.length).toBe(0);
    });

    it('retorna veeamMissing false para WINDOWS_DOMAIN_MAINTENANCE (no hay sección veeam)', () => {
      const payload = makeWindowsDomainPayload();
      const issues = component.detectIssues(payload);
      expect(issues.veeamMissing).toBe(false);
    });

    it('retorna emptyFields para SERVER_HOST_MAINTENANCE con cpuUsage NaN', () => {
      const payload: ServerHostPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        vmware: [{ hostId: 1, hostName: 'host1', cpuUsage: NaN, memUsage: 50, storageUsage: 40, snapshotsOk: true }],
        bmc: [],
      };
      const issues = component.detectIssues(payload);
      expect(issues.emptyFields.length).toBeGreaterThan(0);
      expect(issues.emptyFields).toContain('CPU%');
    });

    it('retorna emptyFields para SERVER_HOST_MAINTENANCE con memUsage NaN', () => {
      const payload: ServerHostPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        vmware: [{ hostId: 1, hostName: 'host1', cpuUsage: 40, memUsage: NaN, storageUsage: 40, snapshotsOk: true }],
        bmc: [],
      };
      const issues = component.detectIssues(payload);
      expect(issues.emptyFields.length).toBeGreaterThan(0);
      expect(issues.emptyFields).toContain('Memoria%');
    });

    it('retorna emptyFields vacío para SERVER_HOST_MAINTENANCE con todas las métricas completas', () => {
      const payload: ServerHostPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        vmware: [{ hostId: 1, hostName: 'host1', cpuUsage: 40, memUsage: 50, storageUsage: 30, snapshotsOk: true }],
        bmc: [],
      };
      const issues = component.detectIssues(payload);
      expect(issues.dcdiagErrors.length).toBe(0);
      expect(issues.veeamMissing).toBe(false);
      expect(issues.emptyFields.length).toBe(0);
    });

    it('retorna todo vacío para TerminalPayload (tipo no manejado)', () => {
      const payload = makeTerminalPayload();
      const issues = component.detectIssues(payload);
      expect(issues.dcdiagErrors.length).toBe(0);
      expect(issues.veeamMissing).toBe(false);
      expect(issues.emptyFields.length).toBe(0);
    });

    it('retorna todo vacío para SERVER_HOST_MAINTENANCE con un solo host y métricas NaN — emptyFields sin sufijo de host', () => {
      const payload: ServerHostPayload = {
        type: 'SERVER_HOST_MAINTENANCE',
        vmware: [{ hostId: 1, hostName: 'host1', cpuUsage: NaN, memUsage: NaN, storageUsage: NaN, snapshotsOk: true }],
        bmc: [],
      };
      const issues = component.detectIssues(payload);
      // Con un solo host, el label no lleva sufijo de nombre
      expect(issues.emptyFields).toContain('CPU%');
      expect(issues.emptyFields).toContain('Memoria%');
      expect(issues.emptyFields).toContain('Storage%');
      expect(issues.emptyFields.some(f => f.includes('('))).toBe(false);
    });
  });

  // ── isActiveTask ──────────────────────────────────────────────────────────

  describe('isActiveTask', () => {
    it('should return true for PENDING', () => {
      component.task = makeTask({ status: 'PENDING' });
      expect(component.isActiveTask).toBe(true);
    });

    it('should return true for IN_PROGRESS', () => {
      component.task = makeTask({ status: 'IN_PROGRESS' });
      expect(component.isActiveTask).toBe(true);
    });

    it('should return false for DONE', () => {
      component.task = makeTask({ status: 'DONE' });
      expect(component.isActiveTask).toBe(false);
    });

    it('should return false for ESCALATED', () => {
      component.task = makeTask({ status: 'ESCALATED' });
      expect(component.isActiveTask).toBe(false);
    });

    it('should return false for NOT_DONE', () => {
      component.task = makeTask({ status: 'NOT_DONE' });
      expect(component.isActiveTask).toBe(false);
    });
  });

  // ── onRequestSave ─────────────────────────────────────────────────────────

  describe('onRequestSave()', () => {
    let createSpy: jasmine.Spy;
    let updateSpy: jasmine.Spy;
    let updateStatusSpy: jasmine.Spy;
    let saveComponent: TaskDrawerComponent;

    beforeEach(() => {
      createSpy = jasmine.createSpy('create').and.returnValue(of({}));
      updateSpy = jasmine.createSpy('update').and.returnValue(of({}));
      updateStatusSpy = jasmine.createSpy('updateStatus').and.returnValue(of({}));
      saveComponent = new TaskDrawerComponent(
        { getClientInfrastructure: () => of(null) } as any,
        { create: createSpy, update: updateSpy } as any,
        { updateStatus: updateStatusSpy } as any,
        mockDialog,
      );
      saveComponent.task = makeTask({ status: 'PENDING' });
    });

    it('llama a logsService.create con el payload correcto', () => {
      const payload = makeWindowsDomainPayload();

      saveComponent.onRequestSave(payload);

      expect(createSpy).toHaveBeenCalledWith('task-1', { payload });
    });

    it('transiciona a IN_PROGRESS cuando la tarea está en PENDING', () => {
      saveComponent.onRequestSave(makeWindowsDomainPayload());

      expect(updateStatusSpy).toHaveBeenCalledWith('task-1', { status: 'IN_PROGRESS' });
    });

    it('no llama a updateStatus si la tarea ya está en IN_PROGRESS', () => {
      saveComponent.task = makeTask({ status: 'IN_PROGRESS' });

      saveComponent.onRequestSave(makeWindowsDomainPayload());

      expect(updateStatusSpy).not.toHaveBeenCalled();
    });

    it('usa logsService.update cuando create falla con 409', () => {
      createSpy.and.returnValue(throwError(() => ({ status: 409 })));

      saveComponent.onRequestSave(makeWindowsDomainPayload());

      expect(updateSpy).toHaveBeenCalled();
      expect(updateStatusSpy).toHaveBeenCalledWith('task-1', { status: 'IN_PROGRESS' });
    });

    it('establece saveProgressMsg en éxito', () => {
      saveComponent.onRequestSave(makeWindowsDomainPayload());

      expect(saveComponent.saveProgressMsg).toBeTruthy();
      expect(saveComponent.saveProgressError).toBe('');
    });

    it('establece saveProgressError si create falla con error distinto de 409', () => {
      createSpy.and.returnValue(throwError(() => ({ status: 500 })));

      saveComponent.onRequestSave(makeWindowsDomainPayload());

      expect(saveComponent.saveProgressError).toBeTruthy();
      expect(saveComponent.saveProgressMsg).toBe('');
    });
  });

  // ── saveAndComplete — transición PENDING → IN_PROGRESS → DONE ────────────

  describe('saveAndComplete() via onRequestComplete()', () => {
    let createSpy: jasmine.Spy;
    let updateSpy: jasmine.Spy;
    let updateStatusSpy: jasmine.Spy;
    let completeComponent: TaskDrawerComponent;

    beforeEach(() => {
      createSpy = jasmine.createSpy('create').and.returnValue(of({}));
      updateSpy = jasmine.createSpy('update').and.returnValue(of({}));
      updateStatusSpy = jasmine.createSpy('updateStatus').and.returnValue(of({}));
      completeComponent = new TaskDrawerComponent(
        { getClientInfrastructure: () => of(null) } as any,
        { create: createSpy, update: updateSpy } as any,
        { updateStatus: updateStatusSpy } as any,
        mockDialogThatConfirms,
      );
    });

    it('hace doble transición PENDING → IN_PROGRESS → DONE cuando tarea está en PENDING', () => {
      completeComponent.task = makeTask({ status: 'PENDING' });

      completeComponent.onRequestComplete(makeWindowsDomainPayload());

      expect(updateStatusSpy.calls.count()).toBe(2);
      expect(updateStatusSpy.calls.argsFor(0)).toEqual(['task-1', { status: 'IN_PROGRESS' }]);
      expect(updateStatusSpy.calls.argsFor(1)).toEqual(['task-1', { status: 'DONE', timeSpentMinutes: 90 }]);
    });

    it('hace una sola transición IN_PROGRESS → DONE cuando tarea ya está en IN_PROGRESS', () => {
      completeComponent.task = makeTask({ status: 'IN_PROGRESS' });

      completeComponent.onRequestComplete(makeWindowsDomainPayload());

      expect(updateStatusSpy.calls.count()).toBe(1);
      expect(updateStatusSpy).toHaveBeenCalledWith('task-1', { status: 'DONE', timeSpentMinutes: 90 });
    });

    it('usa update() si create() falla con 409 al completar', () => {
      completeComponent.task = makeTask({ status: 'IN_PROGRESS' });
      createSpy.and.returnValue(throwError(() => ({ status: 409 })));

      completeComponent.onRequestComplete(makeWindowsDomainPayload());

      expect(updateSpy).toHaveBeenCalled();
      expect(updateStatusSpy).toHaveBeenCalledWith('task-1', { status: 'DONE', timeSpentMinutes: 90 });
    });

    it('al completar después de guardar progreso, sólo transiciona a DONE sin reintentar IN_PROGRESS', () => {
      completeComponent.task = makeTask({ status: 'PENDING' });

      completeComponent.onRequestSave(makeWindowsDomainPayload());
      updateStatusSpy.calls.reset();

      completeComponent.onRequestComplete(makeWindowsDomainPayload());

      expect(updateStatusSpy.calls.count()).toBe(1);
      expect(updateStatusSpy).toHaveBeenCalledWith('task-1', { status: 'DONE', timeSpentMinutes: 90 });
    });
  });

  // ── onRequestNotDone ─────────────────────────────────────────────────────

  describe('onRequestNotDone()', () => {
    let updateStatusSpy: jasmine.Spy;
    let notDoneComponent: TaskDrawerComponent;

    beforeEach(() => {
      updateStatusSpy = jasmine.createSpy('updateStatus').and.returnValue(of({}));
      notDoneComponent = new TaskDrawerComponent(
        { getClientInfrastructure: () => of(null) } as any,
        { create: () => of({}), update: () => of({}), get: () => throwError(() => ({ status: 404 })) } as any,
        { updateStatus: updateStatusSpy } as any,
        makeDialogThatConfirms(45),
      );
      notDoneComponent.task = makeTask({ status: 'IN_PROGRESS' });
    });

    it('abre TimeSpentDialog y llama updateStatus con NOT_DONE y los minutos', () => {
      notDoneComponent.onRequestNotDone();

      expect(updateStatusSpy).toHaveBeenCalledWith('task-1', { status: 'NOT_DONE', timeSpentMinutes: 45 });
    });

    it('no llama updateStatus si el diálogo de tiempo es cancelado', () => {
      const cancelDialog = {
        open: (component: unknown) => ({
          afterClosed: () => component === TimeSpentDialogComponent ? of(null) : of(true),
        }),
      } as unknown as MatDialog;
      const cancelComponent = new TaskDrawerComponent(
        { getClientInfrastructure: () => of(null) } as any,
        { create: () => of({}), update: () => of({}), get: () => throwError(() => ({ status: 404 })) } as any,
        { updateStatus: updateStatusSpy } as any,
        cancelDialog,
      );
      cancelComponent.task = makeTask({ status: 'IN_PROGRESS' });

      cancelComponent.onRequestNotDone();

      expect(updateStatusSpy).not.toHaveBeenCalled();
    });
  });

  // ── odoo ticket getters ───────────────────────────────────────────────────

  describe('odooLabel / odooLink', () => {
    it('odooLabel retorna el ID formateado cuando odooTicketId está definido', () => {
      component.task = makeTask({ odooTicketId: 5137 });
      expect(component.odooLabel).toBe('#05137');
    });

    it('odooLabel retorna null cuando odooTicketId es null', () => {
      component.task = makeTask({ odooTicketId: null });
      expect(component.odooLabel).toBeNull();
    });

    it('odooLink retorna null cuando odooTicketId es null', () => {
      component.task = makeTask({ odooTicketId: null });
      expect(component.odooLink).toBeNull();
    });

    it('odooLink contiene el id cuando odooTicketId está definido', () => {
      component.task = makeTask({ odooTicketId: 5174 });
      expect(component.odooLink).toContain('5174');
    });
  });

  // ── loadInfrastructure — log loading ────────────────────────────────────────

  describe('loadInfrastructure() — log loading', () => {
    const mockInfra = { esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [] };
    const mockLogPayload: WindowsDomainPayload = {
      type: 'WINDOWS_DOMAIN_MAINTENANCE',
      windows: { servers: [], domainControllers: [] },
    };

    let infradocSpy: jasmine.Spy;
    let getLogSpy: jasmine.Spy;
    let loadComponent: TaskDrawerComponent;

    beforeEach(() => {
      infradocSpy = jasmine.createSpy('getClientInfrastructure').and.returnValue(of(mockInfra));
      getLogSpy   = jasmine.createSpy('get');
      loadComponent = new TaskDrawerComponent(
        { getClientInfrastructure: infradocSpy } as any,
        { create: () => of({}), update: () => of({}), get: getLogSpy } as any,
        { updateStatus: () => of({}) } as any,
        mockDialog,
      );
      loadComponent.task = makeTask();
    });

    it('asigna savedPayload con el payload del log cuando el log existe', () => {
      getLogSpy.and.returnValue(of({ id: 'log-1', taskId: 'task-1', technicianId: 'tech-1', payload: mockLogPayload, registeredAt: '2026-05-31' }));

      loadComponent.loadInfrastructure();

      expect(loadComponent.savedPayload).toBe(mockLogPayload);
    });

    it('asigna savedPayload null cuando el log devuelve 404', () => {
      getLogSpy.and.returnValue(throwError(() => ({ status: 404 })));

      loadComponent.loadInfrastructure();

      expect(loadComponent.savedPayload).toBeNull();
      expect(loadComponent.infraError).toBe('');
    });

    it('muestra infraError y pone loadingInfra en false cuando el log falla con 500', () => {
      getLogSpy.and.returnValue(throwError(() => ({ status: 500 })));

      loadComponent.loadInfrastructure();

      expect(loadComponent.loadingInfra).toBeFalse();
      expect(loadComponent.infraError).toBeTruthy();
    });

    it('pone loadingInfra en false sólo después de que el log también resuelve', () => {
      getLogSpy.and.returnValue(of({ id: 'l1', taskId: 't1', technicianId: 't1', payload: mockLogPayload, registeredAt: '2026' }));

      loadComponent.loadInfrastructure();

      expect(loadComponent.loadingInfra).toBeFalse();
      expect(loadComponent.infrastructure).not.toBeNull();
    });

    it('asigna infrastructure e savedPayload de forma atómica', () => {
      getLogSpy.and.returnValue(of({ id: 'l1', taskId: 't1', technicianId: 't1', payload: mockLogPayload, registeredAt: '2026' }));

      loadComponent.loadInfrastructure();

      expect(loadComponent.infrastructure).not.toBeNull();
      expect(loadComponent.savedPayload).toBe(mockLogPayload);
    });

    it('asigna infraError y pone loadingInfra en false cuando infradoc falla', () => {
      infradocSpy.and.returnValue(throwError(() => ({ status: 503 })));

      loadComponent.loadInfrastructure();

      expect(loadComponent.loadingInfra).toBeFalse();
      expect(loadComponent.infraError).toBeTruthy();
    });
  });
});

// ── Template tests (TestBed) ─────────────────────────────────────────────────

describe('TaskDrawerComponent — template tests', () => {
  let component: TaskDrawerComponent;
  let fixture: ComponentFixture<TaskDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TaskDrawerComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: InfradocService, useValue: { getClientInfrastructure: () => of(null) } },
        { provide: MaintenanceLogsService, useValue: { create: () => of({}), update: () => of({}), get: () => throwError(() => ({ status: 404 })) } },
        { provide: TasksService, useValue: { updateStatus: () => of({}) } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDrawerComponent);
    component = fixture.componentInstance;
  });

  function setupWithType(type: TaskType, status: TaskStatus = 'PENDING'): void {
    component.task = makeTask({ type, status, scheduledDate: futureDate(10) });
    fixture.detectChanges();
  }

  function findButton(text: string): HTMLButtonElement | null {
    const buttons = fixture.nativeElement.querySelectorAll('.d-footer button');
    return Array.from(buttons).find(
      (b: any) => b.textContent?.trim().includes(text)
    ) as HTMLButtonElement ?? null;
  }

  // ── Footer buttons ─────────────────────────────────────────────────────────

  describe('footer buttons', () => {
    it('should render "Completar mantenimiento" button for WINDOWS_DOMAIN_MAINTENANCE', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE');
      const btn = findButton('Completar mantenimiento');
      expect(btn).toBeTruthy();
    });

    it('should render "Guardar progreso" button for WINDOWS_DOMAIN_MAINTENANCE', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE');
      const btn = findButton('Guardar progreso');
      expect(btn).toBeTruthy();
    });

    it('should render "Completar mantenimiento" button for SERVER_HOST_MAINTENANCE', () => {
      setupWithType('SERVER_HOST_MAINTENANCE');
      const btn = findButton('Completar mantenimiento');
      expect(btn).toBeTruthy();
    });

    it('should render "Guardar progreso" button for SERVER_HOST_MAINTENANCE', () => {
      setupWithType('SERVER_HOST_MAINTENANCE');
      const btn = findButton('Guardar progreso');
      expect(btn).toBeTruthy();
    });

    it('should render "Marcar visita como realizada" for TERMINAL_MAINTENANCE', () => {
      setupWithType('TERMINAL_MAINTENANCE');
      const btn = findButton('Marcar visita como realizada');
      expect(btn).toBeTruthy();
    });

    it('should render "Marcar visita como realizada" for SITE_VISIT', () => {
      setupWithType('SITE_VISIT');
      const btn = findButton('Marcar visita como realizada');
      expect(btn).toBeTruthy();
    });

    it('should render "No concretada" button for SITE_VISIT', () => {
      setupWithType('SITE_VISIT');
      const btn = findButton('No concretada');
      expect(btn).toBeTruthy();
    });

    it('should render disabled "Completar" for AV_CONTROL', () => {
      setupWithType('AV_CONTROL');
      const btn = findButton('Completar');
      expect(btn).toBeTruthy();
      expect(btn!.disabled).toBe(true);
    });

    it('should render disabled "Completar" for UPS_CONTROL', () => {
      setupWithType('UPS_CONTROL');
      const btn = findButton('Completar');
      expect(btn).toBeTruthy();
      expect(btn!.disabled).toBe(true);
    });

    it('should render read-only footer with "Cerrar" only when task is DONE', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE', 'DONE');
      const footer = fixture.nativeElement.querySelector('.d-footer');
      expect(footer).toBeTruthy();
      expect(findButton('Cerrar')).toBeTruthy();
    });

    it('should NOT render edit buttons when task is DONE', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE', 'DONE');
      expect(findButton('Completar mantenimiento')).toBeFalsy();
      expect(findButton('Guardar progreso')).toBeFalsy();
    });
  });

  // ── Read-only mode ─────────────────────────────────────────────────────────

  describe('read-only mode', () => {
    it('should show .d-readonly banner when task is DONE', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE', 'DONE');
      const banner = fixture.nativeElement.querySelector('.d-readonly');
      expect(banner).toBeTruthy();
    });

    it('should show .d-readonly banner when task is ESCALATED', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE', 'ESCALATED');
      const banner = fixture.nativeElement.querySelector('.d-readonly');
      expect(banner).toBeTruthy();
    });

    it('should show .d-readonly banner when task is NOT_DONE', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE', 'NOT_DONE');
      const banner = fixture.nativeElement.querySelector('.d-readonly');
      expect(banner).toBeTruthy();
    });

    it('should NOT show .d-readonly banner for PENDING task', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE', 'PENDING');
      const banner = fixture.nativeElement.querySelector('.d-readonly');
      expect(banner).toBeFalsy();
    });

    it('should NOT show .d-readonly banner for IN_PROGRESS task', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE', 'IN_PROGRESS');
      const banner = fixture.nativeElement.querySelector('.d-readonly');
      expect(banner).toBeFalsy();
    });
  });

  // ── Header ─────────────────────────────────────────────────────────────────

  describe('header', () => {
    it('should render client name in .d-client', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE');
      const el = fixture.nativeElement.querySelector('.d-client');
      expect(el).toBeTruthy();
      expect(el.textContent).toContain('Acme Corp');
    });

    it('should render type label in .d-sub', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE');
      const el = fixture.nativeElement.querySelector('.d-sub');
      expect(el).toBeTruthy();
      // The label for WINDOWS_DOMAIN_MAINTENANCE from task-labels
      expect(el.textContent.trim()).toBeTruthy();
    });

    it('should render .d-icon element', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE');
      const el = fixture.nativeElement.querySelector('.d-icon');
      expect(el).toBeTruthy();
    });

    it('renderiza el link del ticket en el header cuando odooTicketId está definido', () => {
      component.task = makeTask({ odooTicketId: 5137, scheduledDate: futureDate(10) });
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.d-odoo-link');
      expect(link).toBeTruthy();
      expect(link.textContent.trim()).toBe('#05137');
    });

    it('no renderiza el link del ticket cuando odooTicketId es null', () => {
      component.task = makeTask({ odooTicketId: null, scheduledDate: futureDate(10) });
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.d-odoo-link');
      expect(link).toBeNull();
    });
  });

  // ── Progress messages ──────────────────────────────────────────────────────

  describe('progress messages', () => {
    it('should show saveProgressMsg in footer when set', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE');
      component.saveProgressMsg = 'Progreso guardado.';
      fixture.detectChanges();
      const el = fixture.nativeElement.querySelector('.d-footer__ok');
      expect(el).toBeTruthy();
      expect(el.textContent).toContain('Progreso guardado.');
    });

    it('should show saveProgressError in footer when set', () => {
      setupWithType('WINDOWS_DOMAIN_MAINTENANCE');
      component.saveProgressError = 'No se pudo guardar el progreso.';
      fixture.detectChanges();
      const errors = fixture.nativeElement.querySelectorAll('.d-footer__err');
      const msgs = Array.from(errors).map((e: any) => e.textContent?.trim());
      expect(msgs.some(m => m?.includes('No se pudo guardar'))).toBe(true);
    });
  });
});
