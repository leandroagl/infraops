import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';

import { TaskDrawerComponent } from './task-drawer.component';
import { InfradocService } from '../../../core/services/infradoc.service';
import { MaintenanceLogsService } from '../../../core/services/maintenance-logs.service';
import { TasksService } from '../../../core/services/tasks.service';
import { Task, TaskType, TaskStatus } from '../../../core/models/task.models';
import {
  ServerMaintenancePayload,
  TerminalPayload,
  MaintenancePayload,
} from '../../../core/models/maintenance-log.models';

// ── Test helpers ────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    clientId: 'client-1',
    technicianId: 'tech-1',
    type: 'SERVER_MAINTENANCE',
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

function makeServerPayload(overrides: Partial<ServerMaintenancePayload> = {}): ServerMaintenancePayload {
  return {
    type: 'SERVER_MAINTENANCE',
    windows: { servers: [], dcdiag: 'OK' },
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

// ── Pure unit tests (no TestBed) ─────────────────────────────────────────────

describe('TaskDrawerComponent — pure unit tests', () => {
  let component: TaskDrawerComponent;

  const mockInfradoc = { getClientInfrastructure: () => of(null) } as any;
  const mockLogs = { create: () => of({}) } as any;
  const mockTasks = { updateStatus: () => of({}) } as any;

  beforeEach(() => {
    component = new TaskDrawerComponent(mockInfradoc, mockLogs, mockTasks);
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

    it('should return srv colors for SERVER_MAINTENANCE not overdue', () => {
      component.task = makeTask({ type: 'SERVER_MAINTENANCE', scheduledDate: futureDate(10) });
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
    it('should return dcdiag error when payload.windows.dcdiag starts with ERROR', () => {
      const payload = makeServerPayload({ windows: { servers: [], dcdiag: 'ERROR: LDAP timeout' } });
      const issues = component.detectIssues(payload);
      expect(issues.dcdiagErrors.length).toBe(1);
      expect(issues.dcdiagErrors[0]).toBe('ERROR: LDAP timeout');
    });

    it('should not flag dcdiag when value is OK', () => {
      const payload = makeServerPayload({ windows: { servers: [], dcdiag: 'OK' } });
      const issues = component.detectIssues(payload);
      expect(issues.dcdiagErrors.length).toBe(0);
    });

    it('should return veeam missing error when payload.veeam.status === "missing"', () => {
      const payload = makeServerPayload({ veeam: { status: 'missing' } });
      const issues = component.detectIssues(payload);
      expect(issues.veeamMissing).toBe(true);
    });

    it('should not flag veeam when status is ok', () => {
      const payload = makeServerPayload({ veeam: { status: 'ok' } });
      const issues = component.detectIssues(payload);
      expect(issues.veeamMissing).toBe(false);
    });

    it('should not flag veeam when veeam section is absent', () => {
      const payload = makeServerPayload();
      const issues = component.detectIssues(payload);
      expect(issues.veeamMissing).toBe(false);
    });

    it('should flag emptyFields when vmware cpuUsage is NaN', () => {
      const payload = makeServerPayload({
        vmware: { cpuUsage: NaN, memUsage: 50, storageUsage: 40, snapshotsOk: true },
      });
      const issues = component.detectIssues(payload);
      expect(issues.emptyFields.length).toBeGreaterThan(0);
    });

    it('should flag emptyFields when vmware memUsage is NaN', () => {
      const payload = makeServerPayload({
        vmware: { cpuUsage: 40, memUsage: NaN, storageUsage: 40, snapshotsOk: true },
      });
      const issues = component.detectIssues(payload);
      expect(issues.emptyFields.length).toBeGreaterThan(0);
    });

    it('should return empty issues when all fields are complete and OK', () => {
      const payload = makeServerPayload({
        windows: { servers: [], dcdiag: 'OK' },
        vmware: { cpuUsage: 40, memUsage: 50, storageUsage: 30, snapshotsOk: true },
        veeam: { status: 'ok' },
      });
      const issues = component.detectIssues(payload);
      expect(issues.dcdiagErrors.length).toBe(0);
      expect(issues.veeamMissing).toBe(false);
      expect(issues.emptyFields.length).toBe(0);
    });

    it('should return all empty for TerminalPayload', () => {
      const payload = makeTerminalPayload();
      const issues = component.detectIssues(payload);
      expect(issues.dcdiagErrors.length).toBe(0);
      expect(issues.veeamMissing).toBe(false);
      expect(issues.emptyFields.length).toBe(0);
    });
  });

  // ── Modal state ────────────────────────────────────────────────────────────

  describe('modal state', () => {
    it('showConfirmModal should be false initially', () => {
      expect(component.showConfirmModal).toBe(false);
    });

    it('onRequestComplete should set showConfirmModal to true', () => {
      const payload = makeServerPayload();
      component.onRequestComplete(payload);
      expect(component.showConfirmModal).toBe(true);
    });

    it('onRequestComplete should store pendingPayload', () => {
      const payload = makeServerPayload();
      component.onRequestComplete(payload);
      expect(component.pendingPayload).toBe(payload);
    });

    it('onRequestComplete should compute issuesSummary', () => {
      const payload = makeServerPayload();
      component.onRequestComplete(payload);
      expect(component.issuesSummary).not.toBeNull();
    });

    it('onCancelModal should set showConfirmModal to false', () => {
      component.showConfirmModal = true;
      component.onCancelModal();
      expect(component.showConfirmModal).toBe(false);
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
        { provide: MaintenanceLogsService, useValue: { create: () => of({}) } },
        { provide: TasksService, useValue: { updateStatus: () => of({}) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDrawerComponent);
    component = fixture.componentInstance;
  });

  function setupWithType(type: TaskType, status: TaskStatus = 'PENDING'): void {
    component.task = makeTask({ type, status, scheduledDate: futureDate(10) });
    fixture.detectChanges();
  }

  // ── Footer buttons ─────────────────────────────────────────────────────────

  describe('footer buttons', () => {
    it('should render "Completar mantenimiento" button for SERVER_MAINTENANCE', () => {
      setupWithType('SERVER_MAINTENANCE');
      const btn = fixture.nativeElement.querySelector('.d-footer .btn--primary');
      expect(btn).toBeTruthy();
      expect(btn.textContent.trim()).toContain('Completar mantenimiento');
    });

    it('should render "Marcar visita como realizada" for TERMINAL_MAINTENANCE', () => {
      setupWithType('TERMINAL_MAINTENANCE');
      const btn = fixture.nativeElement.querySelector('.d-footer .btn--primary');
      expect(btn).toBeTruthy();
      expect(btn.textContent.trim()).toContain('Marcar visita como realizada');
    });

    it('should render "Marcar visita como realizada" for SITE_VISIT', () => {
      setupWithType('SITE_VISIT');
      const btn = fixture.nativeElement.querySelector('.d-footer .btn--primary');
      expect(btn).toBeTruthy();
      expect(btn.textContent.trim()).toContain('Marcar visita como realizada');
    });

    it('should render "No concretada" button for SITE_VISIT', () => {
      setupWithType('SITE_VISIT');
      const btn = fixture.nativeElement.querySelector('.d-footer .btn--danger');
      expect(btn).toBeTruthy();
      expect(btn.textContent.trim()).toContain('No concretada');
    });

    it('should render disabled "Completar" for AV_CONTROL', () => {
      setupWithType('AV_CONTROL');
      const btn = fixture.nativeElement.querySelector('.d-footer .btn--primary');
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
      expect(btn.textContent.trim()).toContain('Completar');
    });

    it('should render disabled "Completar" for UPS_CONTROL', () => {
      setupWithType('UPS_CONTROL');
      const btn = fixture.nativeElement.querySelector('.d-footer .btn--primary');
      expect(btn).toBeTruthy();
      expect(btn.disabled).toBe(true);
    });

    it('should NOT render footer when task is DONE', () => {
      setupWithType('SERVER_MAINTENANCE', 'DONE');
      const footer = fixture.nativeElement.querySelector('.d-footer');
      expect(footer).toBeFalsy();
    });
  });

  // ── Header ─────────────────────────────────────────────────────────────────

  describe('header', () => {
    it('should render client name in .d-client', () => {
      setupWithType('SERVER_MAINTENANCE');
      const el = fixture.nativeElement.querySelector('.d-client');
      expect(el).toBeTruthy();
      expect(el.textContent).toContain('Acme Corp');
    });

    it('should render type label in .d-sub', () => {
      setupWithType('SERVER_MAINTENANCE');
      const el = fixture.nativeElement.querySelector('.d-sub');
      expect(el).toBeTruthy();
      expect(el.textContent).toContain('Mantenimiento de servidores');
    });

    it('should render .d-icon element', () => {
      setupWithType('SERVER_MAINTENANCE');
      const el = fixture.nativeElement.querySelector('.d-icon');
      expect(el).toBeTruthy();
    });
  });

  // ── Modal ──────────────────────────────────────────────────────────────────

  describe('modal', () => {
    it('should not show modal-ov with class "open" initially', () => {
      setupWithType('SERVER_MAINTENANCE');
      const modal = fixture.nativeElement.querySelector('.modal-ov');
      expect(modal.classList.contains('open')).toBe(false);
    });

    it('should add "open" class to modal-ov when showConfirmModal is true', () => {
      setupWithType('SERVER_MAINTENANCE');
      component.showConfirmModal = true;
      fixture.detectChanges();
      const modal = fixture.nativeElement.querySelector('.modal-ov');
      expect(modal.classList.contains('open')).toBe(true);
    });
  });
});
