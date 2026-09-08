import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { of, NEVER } from 'rxjs';
import { ClientsListComponent } from './clients-list.component';
import { ClientsService } from '../../../core/services/clients.service';
import { Client, ClientSubscriptionHours, hoursBarState } from '../../../core/models/client.models';

const makeClient = (override: Partial<Client> = {}): Client => ({
  id: 'c1', name: 'ACME Corp', primaryAddress: null, isActive: true, createdAt: '2026-01-01', ...override,
});

const MATERIAL_IMPORTS = [
  NoopAnimationsModule,
  RouterTestingModule,
  FormsModule,
  MatFormFieldModule,
  MatInputModule,
  MatButtonModule,
];

async function buildFixture(
  getAll: jasmine.Spy,
  getSubscriptionHours: jasmine.Spy,
): Promise<ComponentFixture<ClientsListComponent>> {
  const svc = { getAll, getSubscriptionHours } as unknown as ClientsService;
  await TestBed.configureTestingModule({
    declarations: [ClientsListComponent],
    imports: MATERIAL_IMPORTS,
    providers: [{ provide: ClientsService, useValue: svc }],
  }).compileComponents();
  const f = TestBed.createComponent(ClientsListComponent);
  f.detectChanges();
  return f;
}

describe('hoursBarState', () => {
  it('retorna crit cuando pct < 15 (0%)', () => expect(hoursBarState(0)).toBe('crit'));
  it('retorna crit cuando pct es 14', () => expect(hoursBarState(14)).toBe('crit'));
  it('retorna warn en el límite exacto 15%', () => expect(hoursBarState(15)).toBe('warn'));
  it('retorna warn en el rango 15-49%', () => expect(hoursBarState(40)).toBe('warn'));
  it('retorna ok en el límite 50%', () => expect(hoursBarState(50)).toBe('ok'));
  it('retorna ok en el rango 50-100%', () => expect(hoursBarState(75)).toBe('ok'));
  it('retorna ok en 100%', () => expect(hoursBarState(100)).toBe('ok'));
  it('retorna warn cuando excede 100% (excedente)', () => expect(hoursBarState(112)).toBe('warn'));
});

describe('ClientsListComponent', () => {
  let component: ClientsListComponent;
  let fixture: ComponentFixture<ClientsListComponent>;
  let getAllSpy: jasmine.Spy;
  let getHoursSpy: jasmine.Spy;

  beforeEach(async () => {
    getAllSpy = jasmine.createSpy('getAll').and.returnValue(of([]));
    getHoursSpy = jasmine.createSpy('getSubscriptionHours').and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [ClientsListComponent],
      imports: MATERIAL_IMPORTS,
      providers: [{ provide: ClientsService, useValue: { getAll: getAllSpy, getSubscriptionHours: getHoursSpy } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('lanza getAll y getSubscriptionHours en paralelo al inicializar', () => {
    expect(getAllSpy).toHaveBeenCalledTimes(1);
    expect(getHoursSpy).toHaveBeenCalledTimes(1);
  });

  it('filtra clientes inactivos y popula allClients', async () => {
    TestBed.resetTestingModule();
    const clients = [makeClient({ id: 'c1', isActive: true }), makeClient({ id: 'c2', isActive: false })];
    const spy1 = jasmine.createSpy('getAll').and.returnValue(of(clients));
    const spy2 = jasmine.createSpy('getSubscriptionHours').and.returnValue(NEVER);
    const f = await buildFixture(spy1, spy2);

    expect(f.componentInstance.allClients).toHaveSize(1);
    expect(f.componentInstance.allClients[0].id).toBe('c1');
  });

  it('hours es undefined (skeleton) antes de que lleguen las horas', async () => {
    TestBed.resetTestingModule();
    const spy1 = jasmine.createSpy('getAll').and.returnValue(of([makeClient()]));
    const spy2 = jasmine.createSpy('getSubscriptionHours').and.returnValue(NEVER);
    const f = await buildFixture(spy1, spy2);

    expect(f.componentInstance.allClients[0].hours).toBeUndefined();
  });

  it('mergea horas sin volver a llamar getAll', async () => {
    TestBed.resetTestingModule();
    const hours: ClientSubscriptionHours[] = [
      { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
    ];
    const spy1 = jasmine.createSpy('getAll').and.returnValue(of([makeClient()]));
    const spy2 = jasmine.createSpy('getSubscriptionHours').and.returnValue(of(hours));
    const f = await buildFixture(spy1, spy2);

    expect(f.componentInstance.allClients[0].hours).toEqual(hours[0]);
    expect(spy1).toHaveBeenCalledTimes(1);
  });

  describe('month state', () => {
    it('inicializa selectedMonth y selectedYear con el mes y año actuales', () => {
      const now = new Date();
      expect(component.selectedMonth).toBe(now.getMonth() + 1);
      expect(component.selectedYear).toBe(now.getFullYear());
    });

    it('monthLabel retorna el nombre del mes y el año', () => {
      component.selectedMonth = 9;
      component.selectedYear  = 2026;
      expect(component.monthLabel).toBe('Septiembre 2026');
    });

    it('isPastMonth es false cuando es el mes actual', () => {
      const now = new Date();
      component.selectedMonth = now.getMonth() + 1;
      component.selectedYear  = now.getFullYear();
      expect(component.isPastMonth).toBeFalse();
    });

    it('isPastMonth es true cuando el mes es anterior al actual', () => {
      component.selectedMonth = 1;
      component.selectedYear  = 2026;
      expect(component.isPastMonth).toBeTrue();
    });
  });

  describe('navigateMonth', () => {
    it('navegar -1 decrementa el mes', () => {
      component.selectedMonth = 9;
      component.selectedYear  = 2026;
      component.navigateMonth(-1);
      expect(component.selectedMonth).toBe(8);
      expect(component.selectedYear).toBe(2026);
    });

    it('navegar -1 desde enero pasa a diciembre del año anterior', () => {
      component.selectedMonth = 1;
      component.selectedYear  = 2026;
      component.navigateMonth(-1);
      expect(component.selectedMonth).toBe(12);
      expect(component.selectedYear).toBe(2025);
    });

    it('navegar +1 desde diciembre pasa a enero del año siguiente', () => {
      component.selectedMonth = 12;
      component.selectedYear  = 2025;
      component.navigateMonth(1);
      expect(component.selectedMonth).toBe(1);
      expect(component.selectedYear).toBe(2026);
    });

    it('no navega al futuro (mes siguiente al actual)', () => {
      const now = new Date();
      component.selectedMonth = now.getMonth() + 1;
      component.selectedYear  = now.getFullYear();
      component.navigateMonth(1);
      expect(component.selectedMonth).toBe(now.getMonth() + 1);
    });
  });

  describe('filteredClients', () => {
    beforeEach(() => {
      component.allClients = [
        { id: 'c1', name: 'Acme', isActive: true, primaryAddress: null, createdAt: '',
          hours: { clientId: 'c1', contracted: 10, delivered: 0,  available: 10 } },  // crit
        { id: 'c2', name: 'Beta', isActive: true, primaryAddress: null, createdAt: '',
          hours: { clientId: 'c2', contracted: 10, delivered: 8,  available: 2  } },  // ok
        { id: 'c3', name: 'Gamma', isActive: true, primaryAddress: null, createdAt: '',
          hours: { clientId: 'c3', contracted: 10, delivered: 12, available: 0  } },  // warn
      ];
    });

    it('sin filtros retorna todos los clientes ordenados por nombre ASC', () => {
      expect(component.filteredClients.map(c => c.id)).toEqual(['c1','c2','c3']);
    });

    it('filtra por zona cuando selectedZone está activo', () => {
      component.selectedZone = 'ok';
      expect(component.filteredClients.map(c => c.id)).toEqual(['c2']);
    });

    it('filtra por texto cuando quickFilter tiene valor', () => {
      component.quickFilter = 'bet';
      expect(component.filteredClients.map(c => c.id)).toEqual(['c2']);
    });

    it('combina filtro de zona y texto', () => {
      component.allClients = [
        ...component.allClients,
        { id: 'c4', name: 'Beta Dos', isActive: true, primaryAddress: null, createdAt: '',
          hours: { clientId: 'c4', contracted: 10, delivered: 0, available: 10 } },  // crit
      ];
      component.quickFilter = 'beta';
      component.selectedZone = 'ok';
      expect(component.filteredClients.map(c => c.id)).toEqual(['c2']);
    });
  });

  describe('getHoursState', () => {
    it('retorna crit cuando uso es 0% (sin actividad)', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 20, delivered: 0, available: 20 };
      expect(component.getHoursState(h)).toBe('crit');
    });
    it('retorna low cuando uso está entre 1% y 59% (uso bajo)', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 20, delivered: 8, available: 12 };
      expect(component.getHoursState(h)).toBe('low');
    });
    it('retorna low en el límite exacto de 1%', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 100, delivered: 1, available: 99 };
      expect(component.getHoursState(h)).toBe('low');
    });
    it('retorna ok cuando uso está entre 60% y 100% (uso normal)', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 8, available: 2 };
      expect(component.getHoursState(h)).toBe('ok');
    });
    it('retorna ok en el límite exacto de 60%', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 6, available: 4 };
      expect(component.getHoursState(h)).toBe('ok');
    });
    it('retorna ok en el límite exacto de 100%', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 10, available: 0 };
      expect(component.getHoursState(h)).toBe('ok');
    });
    it('retorna warn cuando uso supera el 100% (excedente)', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 12, available: 0 };
      expect(component.getHoursState(h)).toBe('warn');
    });
  });

  describe('getHoursPct', () => {
    it('retorna 0 cuando contracted es 0', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 0, delivered: 0, available: 0 };
      expect(component.getHoursPct(h)).toBe(0);
    });
    it('retorna porcentaje redondeado', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 20, delivered: 8, available: 12 };
      expect(component.getHoursPct(h)).toBe(40);
    });
    it('no cappea en 100 cuando delivered > contracted (excedente)', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 15, available: 0 };
      expect(component.getHoursPct(h)).toBe(150);
    });
  });

  describe('getHoursBarWidth', () => {
    it('devuelve el mismo valor que getHoursPct por debajo de 100', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 20, delivered: 8, available: 12 };
      expect(component.getHoursBarWidth(h)).toBe(40);
    });
    it('cappea en 100 cuando delivered > contracted (excedente)', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 15, available: 0 };
      expect(component.getHoursBarWidth(h)).toBe(100);
    });
  });

  describe('getHoursBarState', () => {
    const makeH = (contracted: number, delivered: number): ClientSubscriptionHours =>
      ({ clientId: 'c', contracted, delivered, available: contracted - delivered });

    it('retorna crit cuando contracted es 0', () => {
      expect(component.getHoursBarState(makeH(0, 0))).toBe('crit');
    });
    it('retorna crit cuando pct < 15% (uso casi nulo)', () => {
      expect(component.getHoursBarState(makeH(20, 2))).toBe('crit');   // 10%
    });
    it('retorna warn en rango 15-49%', () => {
      expect(component.getHoursBarState(makeH(20, 8))).toBe('warn');   // 40%
    });
    it('retorna ok en rango 50-100%', () => {
      expect(component.getHoursBarState(makeH(10, 7))).toBe('ok');     // 70%
    });
    it('retorna warn cuando excede 100% (excedente)', () => {
      expect(component.getHoursBarState(makeH(10, 12))).toBe('warn');  // 120%
    });
  });

  describe('kpiHours', () => {
    it('retorna ceros cuando no hay datos cargados', () => {
      expect(component.kpiHours).toEqual({ contracted: 0, delivered: 0, available: 0 });
    });

    it('suma horas de todos los clientes visibles con contracted > 0', () => {
      component.allClients = [
        { id: 'c1', name: 'A', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c1', contracted: 20, delivered: 8, available: 12 } },
        { id: 'c2', name: 'B', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c2', contracted: 10, delivered: 6, available: 4  } },
      ];
      expect(component.kpiHours).toEqual({ contracted: 30, delivered: 14, available: 16 });
    });

    it('excluye clientes con contracted = 0', () => {
      component.allClients = [
        { id: 'c1', name: 'A', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c1', contracted: 0, delivered: 0, available: 0 } },
        { id: 'c2', name: 'B', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c2', contracted: 10, delivered: 4, available: 6 } },
      ];
      expect(component.kpiHours).toEqual({ contracted: 10, delivered: 4, available: 6 });
    });

    it('excluye clientes sin hours cargado (skeleton)', () => {
      component.allClients = [
        { id: 'c1', name: 'A', isActive: true, primaryAddress: null, createdAt: '', hours: undefined },
        { id: 'c2', name: 'B', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c2', contracted: 10, delivered: 4, available: 6 } },
      ];
      expect(component.kpiHours).toEqual({ contracted: 10, delivered: 4, available: 6 });
    });
  });

  describe('kpiStates', () => {
    it('retorna ceros cuando no hay datos cargados', () => {
      expect(component.kpiStates).toEqual({ ok: 0, warn: 0, crit: 0, low: 0 });
    });

    it('clasifica correctamente clientes por rango de consumo', () => {
      component.allClients = [
        { id: 'c1', name: 'A', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c1', contracted: 10, delivered: 4,  available: 6  } }, // 40% low
        { id: 'c2', name: 'B', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c2', contracted: 10, delivered: 8,  available: 2  } }, // 80% ok
        { id: 'c3', name: 'C', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c3', contracted: 10, delivered: 12, available: 0  } }, // 120% warn
        { id: 'c4', name: 'D', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c4', contracted: 10, delivered: 0,  available: 10 } }, // 0% crit
      ];
      expect(component.kpiStates).toEqual({ ok: 1, warn: 1, crit: 1, low: 1 });
    });

    it('excluye clientes sin contracted (sin abono)', () => {
      component.allClients = [
        { id: 'c1', name: 'A', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c1', contracted: 0, delivered: 0, available: 0 } },
        { id: 'c2', name: 'B', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c2', contracted: 10, delivered: 9, available: 1 } },
      ];
      expect(component.kpiStates).toEqual({ ok: 1, warn: 0, crit: 0, low: 0 });
    });

    it('no se ve afectado por el filtro de zona seleccionado (solo por el buscador de texto)', () => {
      component.allClients = [
        { id: 'c1', name: 'A', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c1', contracted: 10, delivered: 4, available: 6 } }, // low
        { id: 'c2', name: 'B', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c2', contracted: 10, delivered: 8, available: 2 } }, // ok
      ];
      component.toggleZone('low');
      expect(component.kpiStates).toEqual({ ok: 1, warn: 0, crit: 0, low: 1 });
    });
  });

  describe('zonePct', () => {
    it('retorna 0 cuando no hay clientes con horas contratadas', () => {
      expect(component.zonePct(0)).toBe(0);
    });

    it('retorna el % que representa un conteo sobre el total de kpiStates', () => {
      component.allClients = [
        { id: 'c1', name: 'A', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c1', contracted: 10, delivered: 0, available: 10 } }, // 0% crit
        { id: 'c2', name: 'B', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c2', contracted: 10, delivered: 8, available: 2 } }, // ok
        { id: 'c3', name: 'C', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c3', contracted: 10, delivered: 8, available: 2 } }, // ok
        { id: 'c4', name: 'D', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c4', contracted: 10, delivered: 8, available: 2 } }, // ok
      ];
      expect(component.zonePct(component.kpiStates.ok)).toBe(75);
      expect(component.zonePct(component.kpiStates.crit)).toBe(25);
    });
  });

  describe('toggleZone', () => {
    beforeEach(() => {
      component.allClients = [
        { id: 'c1', name: 'Acme', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c1', contracted: 10, delivered: 0,  available: 10 } }, // crit
        { id: 'c2', name: 'Beta', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c2', contracted: 10, delivered: 8,  available: 2 } }, // ok
        { id: 'c3', name: 'Gamma', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c3', contracted: 10, delivered: 12, available: 0 } }, // warn
        { id: 'c4', name: 'Delta', isActive: true, primaryAddress: null, createdAt: '', hours: { clientId: 'c4', contracted: 10, delivered: 4,  available: 6 } }, // low
      ];
    });

    it('activa una zona y filtra la tabla a esa zona', () => {
      component.toggleZone('crit');
      expect(component.selectedZone).toBe('crit');
      expect(component.filteredClients.map((c) => c.id)).toEqual(['c1']);
    });

    it('filtra la tabla a la zona low (uso entre 1% y 59%)', () => {
      component.toggleZone('low');
      expect(component.selectedZone).toBe('low');
      expect(component.filteredClients.map((c) => c.id)).toEqual(['c4']);
    });

    it('clickear la misma zona activa la desactiva (single-select)', () => {
      component.toggleZone('ok');
      component.toggleZone('ok');
      expect(component.selectedZone).toBeNull();
      expect(component.filteredClients).toHaveSize(4);
    });

    it('clickear otra zona reemplaza la selección anterior', () => {
      component.toggleZone('crit');
      component.toggleZone('warn');
      expect(component.selectedZone).toBe('warn');
      expect(component.filteredClients.map((c) => c.id)).toEqual(['c3']);
    });

    it('combina el filtro de zona con el buscador de texto', () => {
      component.quickFilter = 'be';
      component.toggleZone('ok');
      expect(component.filteredClients.map((c) => c.id)).toEqual(['c2']);
    });
  });
});
