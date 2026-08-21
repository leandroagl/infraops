import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { GenerationTabComponent } from './generation-tab.component';
import { ClientSchedule, MonthlyPreview, SchedulesService } from '../schedules.service';

const basePreview: MonthlyPreview = {
  year: 2026,
  month: 8,
  group: 'BIMONTHLY_EVEN',
  clients: [{ clientId: 'c-1', clientName: 'ACME', technicianId: 't-1', technicianName: 'Enzo' }],
  clientsWithoutTechnician: 0,
  wasGenerated: false,
  taskStats: null,
  taskTypesWithoutTags: [],
};

describe('GenerationTabComponent', () => {
  let component: GenerationTabComponent;
  let fixture: ComponentFixture<GenerationTabComponent>;
  let schedulesService: jasmine.SpyObj<SchedulesService>;
  let scheduleUpdated$: Subject<ClientSchedule>;

  beforeEach(async () => {
    schedulesService = jasmine.createSpyObj('SchedulesService', ['getMonthlyPreview', 'generateMonth']);
    schedulesService.getMonthlyPreview.and.returnValue(of(basePreview));
    scheduleUpdated$ = new Subject<ClientSchedule>();
    (schedulesService as unknown as { scheduleUpdated$: Subject<ClientSchedule> }).scheduleUpdated$ = scheduleUpdated$;

    await TestBed.configureTestingModule({
      declarations: [GenerationTabComponent],
      imports: [
        NoopAnimationsModule,
        RouterTestingModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatTableModule,
        MatSnackBarModule,
      ],
      providers: [{ provide: SchedulesService, useValue: schedulesService }],
    }).compileComponents();

    fixture = TestBed.createComponent(GenerationTabComponent);
    component = fixture.componentInstance;
  });

  it('permite generar cuando no faltan tags de Odoo', () => {
    fixture.detectChanges();
    expect(component.canGenerate).toBe(true);
  });

  it('bloquea la generación cuando algún tipo de tarea no tiene tags de Odoo configurados', () => {
    schedulesService.getMonthlyPreview.and.returnValue(of({
      ...basePreview,
      taskTypesWithoutTags: ['WINDOWS_DOMAIN_MAINTENANCE'],
    }));
    fixture.detectChanges();

    expect(component.canGenerate).toBe(false);
  });

  it('arma el listado legible de tipos sin tags configurados', () => {
    schedulesService.getMonthlyPreview.and.returnValue(of({
      ...basePreview,
      taskTypesWithoutTags: ['WINDOWS_DOMAIN_MAINTENANCE', 'ROUTER_MAINTENANCE'],
    }));
    fixture.detectChanges();

    expect(component.taskTypesWithoutTagsLabel).toBe(
      'Mantenimiento Windows y dominios, Mantenimiento de router y firewall',
    );
  });

  it('muestra el aviso de tags faltantes en el template', () => {
    schedulesService.getMonthlyPreview.and.returnValue(of({
      ...basePreview,
      taskTypesWithoutTags: ['WINDOWS_DOMAIN_MAINTENANCE'],
    }));
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.footer-hint--warn');
    expect(warning).toBeTruthy();
    expect(warning.textContent).toContain('Mantenimiento Windows y dominios');
  });

  describe('reactividad ante cambios guardados en configuración', () => {
    it('agrega al preview un cliente recién asignado al grupo del mes actual, sin recargar', () => {
      fixture.detectChanges();

      scheduleUpdated$.next({
        id: 'cs-2',
        clientId: 'c-2',
        client: { id: 'c-2', name: 'Beta' },
        scheduleGroup: 'BIMONTHLY_EVEN',
        technicianId: 't-2',
        technician: { id: 't-2', user: { name: 'Valen' } },
        isActive: true,
      });

      expect(component.preview?.clients.length).toBe(2);
      expect(component.preview?.clients.find(c => c.clientId === 'c-2')?.technicianName).toBe('Valen');
      expect(component.preview?.clientsWithoutTechnician).toBe(0);
      expect(schedulesService.getMonthlyPreview).toHaveBeenCalledTimes(1);
    });

    it('quita del preview un cliente reasignado a un grupo distinto al del mes actual', () => {
      fixture.detectChanges();

      scheduleUpdated$.next({
        id: 'cs-1',
        clientId: 'c-1',
        client: { id: 'c-1', name: 'ACME' },
        scheduleGroup: 'BIMONTHLY_ODD',
        technicianId: 't-1',
        technician: { id: 't-1', user: { name: 'Enzo' } },
        isActive: true,
      });

      expect(component.preview?.clients.length).toBe(0);
      expect(schedulesService.getMonthlyPreview).toHaveBeenCalledTimes(1);
    });

    it('actualiza el técnico de un cliente ya listado sin duplicarlo', () => {
      fixture.detectChanges();

      scheduleUpdated$.next({
        id: 'cs-1',
        clientId: 'c-1',
        client: { id: 'c-1', name: 'ACME' },
        scheduleGroup: 'BIMONTHLY_EVEN',
        technicianId: 't-2',
        technician: { id: 't-2', user: { name: 'Valen' } },
        isActive: true,
      });

      expect(component.preview?.clients.length).toBe(1);
      expect(component.preview?.clients[0].technicianName).toBe('Valen');
      expect(schedulesService.getMonthlyPreview).toHaveBeenCalledTimes(1);
    });
  });
});
