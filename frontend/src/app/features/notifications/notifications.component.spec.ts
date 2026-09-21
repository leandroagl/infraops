import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { NotificationsComponent } from './notifications.component';
import { NotificationsService } from '../../core/services/notifications.service';
import { ExpirationItem, ExpirationType } from '../../core/models/notification.models';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { IntegrationConfigService } from '../../core/services/integration-config.service';

function makeItem(overrides: Partial<ExpirationItem> = {}): ExpirationItem {
  return {
    sourceId: 'd1', type: 'domain', clientId: 1, clientName: 'Acme', itemName: 'acme.com',
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

  let mockRouter: jasmine.SpyObj<Router>;
  let mockAuth: jasmine.SpyObj<AuthService>;
  let mockIntegrationConfig: jasmine.SpyObj<IntegrationConfigService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('NotificationsService', ['getExpirations']);
    serviceSpy.getExpirations.and.returnValue(of(DATASET));

    mockRouter            = jasmine.createSpyObj('Router', ['navigate']);
    mockAuth              = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    mockIntegrationConfig = jasmine.createSpyObj('IntegrationConfigService', ['getOdoo']);
    mockAuth.getCurrentUser.and.returnValue({ id: '1', name: 'Admin', email: 'a@a.com', role: 'ADMIN', avatarUrl: null });
    mockIntegrationConfig.getOdoo.and.returnValue(of({
      expirationsTicketDaysAhead: 20, expirationsTagIds: [],
      helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
      expirationsTypeConfigs: null,
      url: '', db: '', username: '', apiKey: '',
      stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
      updatedAt: null, updatedBy: null,
    }));

    await TestBed.configureTestingModule({
      declarations: [NotificationsComponent],
      imports: [NoopAnimationsModule, MatSelectModule, MatFormFieldModule, MatInputModule, MatMenuModule, FormsModule],
      providers: [
        { provide: NotificationsService, useValue: serviceSpy },
        { provide: Router, useValue: mockRouter },
        { provide: AuthService, useValue: mockAuth },
        { provide: IntegrationConfigService, useValue: mockIntegrationConfig },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga items al iniciar sin límite de días — siempre trae todo, los filtros acotan la vista', () => {
    expect(serviceSpy.getExpirations).toHaveBeenCalledWith(undefined);
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

  it('attentionCount cuenta items con 21 ≤ daysUntil ≤ 45', () => {
    expect(component.attentionCount).toBe(1);
  });

  it('totalShown refleja la longitud de filteredItems', () => {
    expect(component.totalShown).toBe(5);
  });

  it('zonePct calcula el porcentaje sobre el total de items', () => {
    expect(component.zonePct(1)).toBe(20);
  });

  it('zonePct devuelve 0 cuando no hay items', () => {
    component.items = [];
    expect(component.zonePct(1)).toBe(0);
  });

  it('filterType reduce filteredItems al tipo indicado', () => {
    component.filterType = 'certificate';
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].itemName).toBe('Esta semana');
  });

  it('toggleUrgency("expired") muestra solo items con daysUntil < 0', () => {
    component.toggleUrgency('expired');
    expect(component.selectedUrgency).toBe('expired');
    expect(component.filteredItems.length).toBe(1);
    expect(component.filteredItems[0].daysUntil).toBeLessThan(0);
  });

  it('toggleUrgency("week") muestra solo items con 0 ≤ daysUntil ≤ 7', () => {
    component.toggleUrgency('week');
    const result = component.filteredItems;
    expect(result.every((i: ExpirationItem) => i.daysUntil >= 0 && i.daysUntil <= 7)).toBeTrue();
  });

  it('toggleUrgency("soon") muestra solo items con 8 ≤ daysUntil ≤ 20', () => {
    component.toggleUrgency('soon');
    const result = component.filteredItems;
    expect(result.every((i: ExpirationItem) => i.daysUntil >= 8 && i.daysUntil <= 20)).toBeTrue();
  });

  it('toggleUrgency("attention") muestra solo items con 21 ≤ daysUntil ≤ 45', () => {
    component.toggleUrgency('attention');
    const result = component.filteredItems;
    expect(result.every((i: ExpirationItem) => i.daysUntil >= 21 && i.daysUntil <= 45)).toBeTrue();
  });

  it('toggleUrgency con la misma zona activa la desactiva (toggle off)', () => {
    component.toggleUrgency('week');
    component.toggleUrgency('week');
    expect(component.selectedUrgency).toBeNull();
    expect(component.filteredItems.length).toBe(5);
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

  it('urgencyLabel devuelve "Vencido hace N días" para daysUntil < 0', () => {
    expect(component.urgencyLabel(makeItem({ daysUntil: -3 }))).toBe('Vencido hace 3 días');
  });

  it('urgencyLabel devuelve "Vence en N días" para daysUntil ≥ 0', () => {
    expect(component.urgencyLabel(makeItem({ daysUntil: 15 }))).toBe('Vence en 15 días');
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

  it('itemMeta combina marca, modelo y serie', () => {
    const item = makeItem({ make: 'Dell', model: 'PowerEdge R640', serial: 'AB12CD34' });
    expect(component.itemMeta(item)).toBe('Dell · PowerEdge R640 · SN AB12CD34');
  });

  it('itemMeta omite los campos ausentes', () => {
    const item = makeItem({ make: undefined, model: undefined, serial: undefined });
    expect(component.itemMeta(item)).toBe('');
  });

  it('ticketLabel devuelve el id formateado cuando hay odooTicketId', () => {
    expect(component.ticketLabel(makeItem({ odooTicketId: 142 }))).toBe('#00142');
  });

  it('ticketLabel devuelve null sin odooTicketId', () => {
    expect(component.ticketLabel(makeItem({ odooTicketId: undefined }))).toBeNull();
  });

  it('ticketLink devuelve null sin odooTicketId', () => {
    expect(component.ticketLink(makeItem({ odooTicketId: undefined }))).toBeNull();
  });

  it('ticketPending es true sin ticket y dentro de la ventana de 30 días', () => {
    expect(component.ticketPending(makeItem({ odooTicketId: undefined, daysUntil: 10 }))).toBeTrue();
  });

  it('ticketPending es true para items ya vencidos sin ticket', () => {
    expect(component.ticketPending(makeItem({ odooTicketId: undefined, daysUntil: -2 }))).toBeTrue();
  });

  it('ticketPending es false fuera de la ventana de 30 días', () => {
    expect(component.ticketPending(makeItem({ odooTicketId: undefined, daysUntil: 45 }))).toBeFalse();
  });

  it('ticketPending es false cuando ya tiene ticket', () => {
    expect(component.ticketPending(makeItem({ odooTicketId: 142, daysUntil: 10 }))).toBeFalse();
  });

  it('setSort("client") invierte la dirección si ya estaba activa esa columna', () => {
    expect(component.sortCol).toBe('client');
    expect(component.sortDir).toBe('asc');
    component.setSort('client');
    expect(component.sortDir).toBe('desc');
  });

  it('setSort a una columna distinta la activa en orden asc', () => {
    component.setSort('client');
    expect(component.sortDir).toBe('desc');
    component.setSort('expireDate');
    expect(component.sortCol).toBe('expireDate');
    expect(component.sortDir).toBe('asc');
  });

  it('filteredItems ordena por nombre de cliente por defecto', () => {
    component.items = [
      makeItem({ clientName: 'Zeta' }),
      makeItem({ clientName: 'Acme' }),
    ];
    expect(component.filteredItems.map(i => i.clientName)).toEqual(['Acme', 'Zeta']);
    component.setSort('client');
    expect(component.filteredItems.map(i => i.clientName)).toEqual(['Zeta', 'Acme']);
  });

  it('setSort("expireDate") ordena por días hasta el vencimiento', () => {
    component.items = [
      makeItem({ clientName: 'A', daysUntil: 30 }),
      makeItem({ clientName: 'B', daysUntil: -5 }),
      makeItem({ clientName: 'C', daysUntil: 10 }),
    ];
    component.setSort('expireDate');
    expect(component.filteredItems.map(i => i.clientName)).toEqual(['B', 'C', 'A']);
    component.setSort('expireDate');
    expect(component.filteredItems.map(i => i.clientName)).toEqual(['A', 'C', 'B']);
  });

  it('setClientFilter filtra items por clientId', () => {
    component.items = [
      makeItem({ clientId: 1, clientName: 'Acme' }),
      makeItem({ clientId: 2, clientName: 'Beta' }),
      makeItem({ clientId: 2, clientName: 'Beta' }),
    ];
    component.setClientFilter(2);
    expect(component.filteredItems.length).toBe(2);
    expect(component.filteredItems.every(i => i.clientId === 2)).toBeTrue();
  });

  it('setClientFilter(null) muestra todos los clientes', () => {
    component.items = [
      makeItem({ clientId: 1, clientName: 'Acme' }),
      makeItem({ clientId: 2, clientName: 'Beta' }),
    ];
    component.setClientFilter(1);
    component.setClientFilter(null);
    expect(component.filteredItems.length).toBe(2);
  });

  it('uniqueClients retorna clientes únicos ordenados alfabéticamente', () => {
    component.items = [
      makeItem({ clientId: 2, clientName: 'Zeta' }),
      makeItem({ clientId: 1, clientName: 'Acme' }),
      makeItem({ clientId: 2, clientName: 'Zeta' }),
    ];
    const unique = component.uniqueClients;
    expect(unique.length).toBe(2);
    expect(unique[0].name).toBe('Acme');
    expect(unique[1].name).toBe('Zeta');
  });

  it('muestra error cuando el servicio falla', () => {
    serviceSpy.getExpirations.and.returnValue(throwError(() => new Error('Network')));
    component.load();
    expect(component.error).toBe('No se pudo cargar los vencimientos');
    expect(component.loading).toBeFalse();
  });

  it('isAdmin es true cuando el usuario tiene role ADMIN', () => {
    expect(component.isAdmin).toBe(true);
  });

  it('isAdmin es false cuando el usuario tiene role TECHNICIAN', () => {
    mockAuth.getCurrentUser.and.returnValue({ id: '2', name: 'Tec', email: 't@t.com', role: 'TECHNICIAN', avatarUrl: null });
    const f = TestBed.createComponent(NotificationsComponent);
    f.detectChanges();
    expect(f.componentInstance.isAdmin).toBe(false);
  });

  it('carga typeConfigs desde la config al inicializar (null → mapa vacío)', () => {
    expect(component.typeConfigs).toEqual({});
  });

  it('openConfig() navega a /admin/vencimientos', () => {
    component.openConfig();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/vencimientos']);
  });

  it('ticketPending usa daysAhead del tipo cuando typeConfigs tiene ese tipo', () => {
    component.typeConfigs = {
      domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 7, tagIds: [] },
    };
    // daysUntil 10 > daysAhead 7 → false
    expect(component.ticketPending(makeItem({ type: 'domain', daysUntil: 10, odooTicketId: undefined }))).toBeFalse();
    // daysUntil 5 <= daysAhead 7 → true
    expect(component.ticketPending(makeItem({ type: 'domain', daysUntil: 5, odooTicketId: undefined }))).toBeTrue();
  });

  it('ticketPending usa 30 días como fallback cuando el tipo no está en typeConfigs', () => {
    component.typeConfigs = {};
    expect(component.ticketPending(makeItem({ type: 'software', daysUntil: 25, odooTicketId: undefined }))).toBeTrue();
    expect(component.ticketPending(makeItem({ type: 'software', daysUntil: 35, odooTicketId: undefined }))).toBeFalse();
  });
});
