import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { KpiStripComponent } from './kpi-strip.component';
import { CycleStats } from '../../../core/models/task.models';
import { daysUntilCycleClose, urgencyLabel } from '../../../shared/utils/urgency';

const STATS: CycleStats = { assigned: 24, inprogress: 4, pending: 10, done: 8 };

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
    expect(el.textContent).toContain('24');
    expect(el.textContent).toContain('4');
    expect(el.textContent).toContain('10');
    expect(el.textContent).toContain('8');
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
});
