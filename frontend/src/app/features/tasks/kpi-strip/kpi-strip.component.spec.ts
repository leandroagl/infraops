import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { KpiStripComponent } from './kpi-strip.component';
import { CycleStats } from '../../../core/models/task.models';
import { daysUntilCycleClose, urgencyLabel } from '../../../shared/utils/urgency';

const STATS: CycleStats = { assigned: 24, inprogress: 4, pending: 10, done: 8, escalated: 2 };

describe('KpiStripComponent', () => {
  let component: KpiStripComponent;
  let fixture: ComponentFixture<KpiStripComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [KpiStripComponent],
      imports: [CommonModule, NoopAnimationsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(KpiStripComponent);
    component = fixture.componentInstance;
    component.stats = STATS;
    component.closed = false;
    fixture.detectChanges();
  });

  it('renderiza los cuatro valores de KPI', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('2');   // no realizados
    expect(el.textContent).toContain('10');  // pending
    expect(el.textContent).toContain('4');   // inprogress
    expect(el.textContent).toContain('8');   // done
  });

  it('muestra el total de tareas asignadas', () => {
    expect(fixture.nativeElement.textContent).toContain('24');
  });

  it('muestra la etiqueta "No realizados" en lugar de "Escal."', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('No realizados');
    expect(el.textContent).not.toContain('Escal.');
  });

  it('muestra el indicador de cierre de ciclo cuando closed=false', () => {
    expect(fixture.nativeElement.textContent).toContain(urgencyLabel(daysUntilCycleClose()));
  });

  it('muestra badge "Ciclo cerrado" cuando closed=true', () => {
    component.closed = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ciclo cerrado');
  });

  it('calcula el porcentaje de avance correctamente', () => {
    // 8/24 = 33%
    expect(fixture.nativeElement.textContent).toContain('33%');
  });

  describe('filtrado por KPI', () => {
    it('emite NOT_DONE al hacer click en la zone de No realizados', () => {
      const emitted: (string | null)[] = [];
      component.statusFilterChange.subscribe(v => emitted.push(v));
      const zone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--crit');
      zone.click();
      expect(emitted).toEqual(['NOT_DONE']);
    });

    it('emite PENDING al hacer click en la zone de Pendientes', () => {
      const emitted: (string | null)[] = [];
      component.statusFilterChange.subscribe(v => emitted.push(v));
      const zone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--warn');
      zone.click();
      expect(emitted).toEqual(['PENDING']);
    });

    it('emite IN_PROGRESS al hacer click en la zone de En curso', () => {
      const emitted: (string | null)[] = [];
      component.statusFilterChange.subscribe(v => emitted.push(v));
      const zone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--low');
      zone.click();
      expect(emitted).toEqual(['IN_PROGRESS']);
    });

    it('emite DONE al hacer click en la zone de Completadas', () => {
      const emitted: (string | null)[] = [];
      component.statusFilterChange.subscribe(v => emitted.push(v));
      const zone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--ok');
      zone.click();
      expect(emitted).toEqual(['DONE']);
    });

    it('emite null al hacer click en la zone activa (toggle off)', () => {
      component.activeStatusFilter = 'DONE';
      fixture.detectChanges();
      const emitted: (string | null)[] = [];
      component.statusFilterChange.subscribe(v => emitted.push(v));
      const zone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--ok');
      zone.click();
      expect(emitted).toEqual([null]);
    });

    it('emite null al hacer click en la zone Total', () => {
      component.activeStatusFilter = 'DONE';
      fixture.detectChanges();
      const emitted: (string | null)[] = [];
      component.statusFilterChange.subscribe(v => emitted.push(v));
      const zone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--total');
      zone.click();
      expect(emitted).toEqual([null]);
    });

    it('aplica clase kpi-zone--active a la zone del filtro activo', () => {
      component.activeStatusFilter = 'PENDING';
      fixture.detectChanges();
      const warnZone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--warn');
      expect(warnZone.classList).toContain('kpi-zone--active');
    });

    it('no aplica kpi-zone--active cuando el filtro no coincide', () => {
      component.activeStatusFilter = 'DONE';
      fixture.detectChanges();
      const warnZone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--warn');
      expect(warnZone.classList).not.toContain('kpi-zone--active');
    });

    it('aplica kpi-zone--active en Total cuando no hay filtro de estado', () => {
      component.activeStatusFilter = null;
      fixture.detectChanges();
      const totalZone: HTMLElement = fixture.nativeElement.querySelector('.kpi-zone--total');
      expect(totalZone.classList).toContain('kpi-zone--active');
    });
  });
});
