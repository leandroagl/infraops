import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { GenerationTabComponent } from './generation-tab.component';
import { MonthlyPreview, SchedulesService } from '../schedules.service';

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

  beforeEach(async () => {
    schedulesService = jasmine.createSpyObj('SchedulesService', ['getMonthlyPreview', 'generateMonth']);
    schedulesService.getMonthlyPreview.and.returnValue(of(basePreview));

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
});
