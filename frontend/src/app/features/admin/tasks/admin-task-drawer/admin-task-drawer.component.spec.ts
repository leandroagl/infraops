import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { AdminTaskDrawerComponent } from './admin-task-drawer.component';
import { LocalDatePipe } from '../../../../shared/pipes/local-date.pipe';
import { Task } from '../../../../core/models/task.models';

function mockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', clientId: 'client-1', technicianId: 'tech-1',
    type: 'WINDOWS_DOMAIN_MAINTENANCE', status: 'PENDING',
    scheduledDate: '2026-06-15', completedDate: null,
    odooTicketId: null, createdAt: '2026-01-01T00:00:00.000Z',
    client: { id: 'client-1', name: 'Acme Corp' },
    technician: { id: 'tech-1', user: { id: 'u1', name: 'Valentina López', email: 'valen@ondra.com.ar' } },
    ...overrides,
  };
}

describe('AdminTaskDrawerComponent', () => {
  let component: AdminTaskDrawerComponent;
  let fixture: ComponentFixture<AdminTaskDrawerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminTaskDrawerComponent, LocalDatePipe],
      imports: [CommonModule, NoopAnimationsModule, MatButtonModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminTaskDrawerComponent);
    component = fixture.componentInstance;
    component.task = mockTask();
    fixture.detectChanges();
  });

  it('renderiza el nombre del cliente', () => {
    expect(fixture.nativeElement.textContent).toContain('Acme Corp');
  });

  it('renderiza el nombre del técnico asignado', () => {
    expect(fixture.nativeElement.textContent).toContain('Valentina López');
  });

  it('renderiza "—" cuando no hay técnico asignado', () => {
    component.task = mockTask({ technician: undefined });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  it('renderiza el link del ticket Odoo cuando existe', () => {
    component.task = mockTask({ odooTicketId: 5137 });
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a');
    expect(link).toBeTruthy();
    expect(link.textContent.trim()).toBe('#05137');
  });

  it('no renderiza link cuando odooTicketId es null', () => {
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  it('drawerClosed emite al hacer click en el botón cerrar', () => {
    let callCount = 0;
    component.drawerClosed.subscribe(() => { callCount++; });
    fixture.nativeElement.querySelector('.adr-close').click();
    expect(callCount).toBe(1);
  });
});
