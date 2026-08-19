import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { of, NEVER } from 'rxjs';
import { ClientsListComponent } from './clients-list.component';
import { ClientsService } from '../../../core/services/clients.service';
import { Client, ClientSubscriptionHours } from '../../../core/models/client.models';

const makeClient = (override: Partial<Client> = {}): Client => ({
  id: 'c1', name: 'ACME Corp', primaryAddress: null, isActive: true, createdAt: '2026-01-01', ...override,
});

const MATERIAL_IMPORTS = [
  NoopAnimationsModule,
  RouterTestingModule,
  FormsModule,
  MatTableModule,
  MatSortModule,
  MatFormFieldModule,
  MatInputModule,
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

  it('filtra clientes inactivos y popula dataSource', async () => {
    TestBed.resetTestingModule();
    const clients = [makeClient({ id: 'c1', isActive: true }), makeClient({ id: 'c2', isActive: false })];
    const spy1 = jasmine.createSpy('getAll').and.returnValue(of(clients));
    const spy2 = jasmine.createSpy('getSubscriptionHours').and.returnValue(NEVER);
    const f = await buildFixture(spy1, spy2);

    expect(f.componentInstance.dataSource.data).toHaveSize(1);
    expect(f.componentInstance.dataSource.data[0].id).toBe('c1');
  });

  it('hours es undefined (skeleton) antes de que lleguen las horas', async () => {
    TestBed.resetTestingModule();
    const spy1 = jasmine.createSpy('getAll').and.returnValue(of([makeClient()]));
    const spy2 = jasmine.createSpy('getSubscriptionHours').and.returnValue(NEVER);
    const f = await buildFixture(spy1, spy2);

    expect(f.componentInstance.dataSource.data[0].hours).toBeUndefined();
  });

  it('mergea horas sin volver a llamar getAll', async () => {
    TestBed.resetTestingModule();
    const hours: ClientSubscriptionHours[] = [
      { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
    ];
    const spy1 = jasmine.createSpy('getAll').and.returnValue(of([makeClient()]));
    const spy2 = jasmine.createSpy('getSubscriptionHours').and.returnValue(of(hours));
    const f = await buildFixture(spy1, spy2);

    expect(f.componentInstance.dataSource.data[0].hours).toEqual(hours[0]);
    expect(spy1).toHaveBeenCalledTimes(1);
  });

  describe('getHoursState', () => {
    it('retorna ok cuando uso < 70%', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 20, delivered: 8, available: 12 };
      expect(component.getHoursState(h)).toBe('ok');
    });
    it('retorna warn cuando uso está entre 70% y 90%', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 8, available: 2 };
      expect(component.getHoursState(h)).toBe('warn');
    });
    it('retorna crit cuando uso >= 90%', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 9, available: 1 };
      expect(component.getHoursState(h)).toBe('crit');
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
    it('está capeado en 100 cuando delivered > contracted', () => {
      const h: ClientSubscriptionHours = { clientId: 'c1', contracted: 10, delivered: 15, available: 0 };
      expect(component.getHoursPct(h)).toBe(100);
    });
  });
});
