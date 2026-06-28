import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule } from '@angular/forms';
import { NotificationsComponent } from './notifications.component';
import { NotificationsService } from '../../../core/services/notifications.service';
import { ExpirationItem, ExpirationType } from '../../../core/models/notification.models';

function makeItem(overrides: Partial<ExpirationItem> = {}): ExpirationItem {
  return {
    type: 'domain', clientId: 1, clientName: 'Acme', itemName: 'acme.com',
    expireDate: '2026-07-15', daysUntil: 17, ...overrides,
  };
}

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;
  let serviceSpy: jasmine.SpyObj<NotificationsService>;

  const DATASET: ExpirationItem[] = [
    makeItem({ daysUntil: -5,  expireDate: '2026-06-23', itemName: 'Expirado',    type: 'domain'         }),
    makeItem({ daysUntil: 3,   expireDate: '2026-07-01', itemName: 'Esta semana', type: 'certificate'    }),
    makeItem({ daysUntil: 15,  expireDate: '2026-07-13', itemName: 'Próximo',     type: 'software'       }),
    makeItem({ daysUntil: 40,  expireDate: '2026-08-07', itemName: 'Atención',    type: 'asset_warranty' }),
    makeItem({ daysUntil: 70,  expireDate: '2026-09-06', itemName: 'Neutral',     type: 'domain'         }),
  ];

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('NotificationsService', ['getExpirations']);
    serviceSpy.getExpirations.and.returnValue(of(DATASET));

    await TestBed.configureTestingModule({
      declarations: [NotificationsComponent],
      imports: [NoopAnimationsModule, MatTableModule, MatSelectModule, MatCheckboxModule, FormsModule],
      providers: [{ provide: NotificationsService, useValue: serviceSpy }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga items al iniciar con days=90', () => {
    expect(serviceSpy.getExpirations).toHaveBeenCalledWith(90);
    expect(component.items.length).toBe(5);
  });

  it('expiredCount cuenta items con daysUntil < 0', () => {
    expect(component.expiredCount).toBe(1);
  });

  it('weekCount cuenta items con 0 ≤ daysUntil ≤ 7', () => {
    expect(component.weekCount).toBe(1);
  });

  it('soonCount cuenta items con 8 ≤ daysUntil ≤ 20', () => {
    expect(component.soonCount).toBe(1);
  });

  it('totalShown refleja la longitud de filteredItems', () => {
    expect(component.totalShown).toBe(5);
  });

  it('filterType reduce filteredItems al tipo indicado', () => {
    component.filterType = 'certificate';
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].itemName).toBe('Esta semana');
  });

  it('filterUrgency=expired muestra solo items con daysUntil < 0', () => {
    component.filterUrgency = 'expired';
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].daysUntil).toBeLessThan(0);
  });

  it('filterUrgency=week muestra solo items con 0 ≤ daysUntil ≤ 7', () => {
    component.filterUrgency = 'week';
    const result = component.filteredItems;
    expect(result.every((i: ExpirationItem) => i.daysUntil >= 0 && i.daysUntil <= 7)).toBeTrue();
  });

  it('filterUrgency=soon muestra solo items con 8 ≤ daysUntil ≤ 20', () => {
    component.filterUrgency = 'soon';
    const result = component.filteredItems;
    expect(result.every((i: ExpirationItem) => i.daysUntil >= 8 && i.daysUntil <= 20)).toBeTrue();
  });

  it('urgencyClass devuelve badge--crit para daysUntil < 0', () => {
    expect(component.urgencyClass(makeItem({ daysUntil: -1 }))).toBe('badge--crit');
  });

  it('urgencyClass devuelve badge--crit para daysUntil = 7', () => {
    expect(component.urgencyClass(makeItem({ daysUntil: 7 }))).toBe('badge--crit');
  });

  it('urgencyClass devuelve badge--warn para daysUntil = 8', () => {
    expect(component.urgencyClass(makeItem({ daysUntil: 8 }))).toBe('badge--warn');
  });

  it('urgencyClass devuelve badge--warn para daysUntil = 20', () => {
    expect(component.urgencyClass(makeItem({ daysUntil: 20 }))).toBe('badge--warn');
  });

  it('urgencyClass devuelve badge--accent para daysUntil = 21', () => {
    expect(component.urgencyClass(makeItem({ daysUntil: 21 }))).toBe('badge--accent');
  });

  it('urgencyClass devuelve badge--accent para daysUntil = 45', () => {
    expect(component.urgencyClass(makeItem({ daysUntil: 45 }))).toBe('badge--accent');
  });

  it('urgencyClass devuelve badge--neutral para daysUntil = 46', () => {
    expect(component.urgencyClass(makeItem({ daysUntil: 46 }))).toBe('badge--neutral');
  });

  it('urgencyLabel devuelve "Vencido" para daysUntil < 0', () => {
    expect(component.urgencyLabel(makeItem({ daysUntil: -3 }))).toBe('Vencido');
  });

  it('urgencyLabel devuelve "X días" para daysUntil ≥ 0', () => {
    expect(component.urgencyLabel(makeItem({ daysUntil: 15 }))).toBe('15 días');
  });

  it('typeClass devuelve badge--srv para asset_warranty', () => {
    expect(component.typeClass('asset_warranty')).toBe('badge--srv');
  });

  it('typeClass devuelve badge--bkp para certificate', () => {
    expect(component.typeClass('certificate')).toBe('badge--bkp');
  });

  it('typeClass devuelve badge--accent para domain', () => {
    expect(component.typeClass('domain')).toBe('badge--accent');
  });

  it('typeClass devuelve badge--win para software', () => {
    expect(component.typeClass('software')).toBe('badge--win');
  });

  it('onShowAllChange con showAll=true recarga sin days', () => {
    component.showAll = true;
    component.onShowAllChange();
    expect(serviceSpy.getExpirations).toHaveBeenCalledWith(undefined);
  });

  it('onShowAllChange con showAll=false recarga con days=90', () => {
    component.showAll = false;
    component.onShowAllChange();
    expect(serviceSpy.getExpirations).toHaveBeenCalledWith(90);
  });

  it('muestra error cuando el servicio falla', () => {
    serviceSpy.getExpirations.and.returnValue(throwError(() => new Error('Network')));
    component.load();
    expect(component.error).toBe('No se pudo cargar los vencimientos');
    expect(component.loading).toBeFalse();
  });
});
