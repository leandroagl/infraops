# Notifications Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el módulo de notificaciones de vencimientos: backend NestJS que consolida assets/certs/dominios/software desde InfraDoc, y frontend Angular con KPIs + tabla filtrable.

**Architecture:** Nuevo módulo `notifications/` en NestJS ejecuta 5 requests en paralelo a InfraDoc (clients + 4 tipos de expiración) con scope all-clients, normaliza a `ExpirationItemDto[]` y lo expone en `GET /notifications/expirations?days=90`. Frontend lo consume con `NotificationsComponent` dentro de `features/admin/`, usando `mat-table` y getters para KPIs.

**Tech Stack:** NestJS, @nestjs/axios, Angular 19, Angular Material (MatTableModule, MatSelectModule, MatCheckboxModule), FormsModule.

## Global Constraints

- Sin standalone components en Angular — todo se declara en `AdminModule`.
- Solo `appearance="outline"` en `mat-form-field`.
- No `::ng-deep` — usar CSS custom properties o bindings con `[ngStyle]`/`[ngClass]`.
- No `mat-table` mezclada con Ag-Grid en la misma vista — esta vista usa solo `mat-table`.
- TDD obligatorio: test antes que implementación.
- Un archivo por commit como mínimo, commits frecuentes.
- Idioma del código: inglés. Commits y comentarios: español.
- `INFRADOC_API_KEY` debe tener scope "All Clients" en InfraDoc (prerequisito operativo, no de código).
- El campo de expiración de software (`software_expire` o similar) debe verificarse contra la instancia real antes de finalizar el tipo raw — ver Task 1, Step 1.

---

## File Map

**Crear:**
- `backend/src/notifications/dto/expiration-item.dto.ts`
- `backend/src/notifications/notifications.service.ts`
- `backend/src/notifications/notifications.service.spec.ts`
- `backend/src/notifications/notifications.controller.ts`
- `backend/src/notifications/notifications.controller.spec.ts`
- `backend/src/notifications/notifications.module.ts`
- `frontend/src/app/core/models/notification.models.ts`
- `frontend/src/app/core/services/notifications.service.ts`
- `frontend/src/app/features/admin/notifications/notifications.component.ts`
- `frontend/src/app/features/admin/notifications/notifications.component.html`
- `frontend/src/app/features/admin/notifications/notifications.component.scss`
- `frontend/src/app/features/admin/notifications/notifications.component.spec.ts`

**Modificar:**
- `backend/src/app.module.ts` — agregar `NotificationsModule`
- `frontend/src/app/features/admin/admin.module.ts` — declarar `NotificationsComponent`, importar `MatCheckboxModule`
- `frontend/src/app/features/admin/admin-routing.module.ts` — agregar ruta `notifications`
- `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts` — agregar tab Vencimientos

---

## Task 1: Backend DTO + Service

**Files:**
- Create: `backend/src/notifications/dto/expiration-item.dto.ts`
- Create: `backend/src/notifications/notifications.service.ts`
- Create: `backend/src/notifications/notifications.service.spec.ts`

**Interfaces:**
- Produces: `ExpirationItemDto`, `ExpirationType`, `NotificationsService.getExpirations(days?: number): Promise<ExpirationItemDto[]>`

- [ ] **Step 1: Discovery — verificar campo de expiración de software**

Antes de escribir código, ejecutar contra la instancia real de InfraDoc:
```bash
curl "https://<INFRADOC_URL>/api/v1/software/read.php?api_key=<KEY>&limit=1"
```
Inspeccionar el response e identificar el campo de fecha de vencimiento (esperado: `software_expire_date`, `software_expire`, o similar). Si no existe, omitir el tipo `software` en el servicio y removerlo de `ExpirationType`.

- [ ] **Step 2: Escribir el test del servicio**

Crear `backend/src/notifications/notifications.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let httpService: { get: jest.Mock };

  const axiosRes = (data: object): AxiosResponse => ({
    data, status: 200, statusText: 'OK', headers: {},
    config: { headers: new AxiosHeaders() },
  });

  const CLIENTS_OK = {
    success: 'True',
    data: [{ client_id: '1', client_name: 'Acme SA' }],
  };

  const setupMock = (
    assetsData: object[] = [],
    certsData: object[] = [],
    domainsData: object[] = [],
    softwareData: object[] = [],
  ) => {
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/clients/'))      return of(axiosRes(CLIENTS_OK));
      if (url.includes('/assets/'))       return of(axiosRes({ success: 'True', data: assetsData }));
      if (url.includes('/certificates/')) return of(axiosRes({ success: 'True', data: certsData }));
      if (url.includes('/domains/'))      return of(axiosRes({ success: 'True', data: domainsData }));
      if (url.includes('/software/'))     return of(axiosRes({ success: 'True', data: softwareData }));
      return of(axiosRes({ success: 'True', data: [] }));
    });
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-28'));
    process.env.INFRADOC_URL = 'http://infradoc.test';
    process.env.INFRADOC_API_KEY = 'test-key';

    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.INFRADOC_URL;
    delete process.env.INFRADOC_API_KEY;
  });

  it('normaliza un asset con warranty_expire a ExpirationItemDto', async () => {
    setupMock([{
      asset_id: '101', asset_name: 'Server Dell R640',
      asset_warranty_expire: '2026-07-05', client_id: '1',
    }]);

    const result = await service.getExpirations(90);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'asset_warranty',
      clientId: 1,
      clientName: 'Acme SA',
      itemName: 'Server Dell R640',
      expireDate: '2026-07-05',
      daysUntil: 7,
    });
  });

  it('omite assets sin asset_warranty_expire', async () => {
    setupMock([{ asset_id: '1', asset_name: 'Sin garantía', asset_warranty_expire: null, client_id: '1' }]);

    const result = await service.getExpirations(90);
    expect(result).toHaveLength(0);
  });

  it('incluye expirados y dentro del horizonte, excluye más allá', async () => {
    setupMock([
      { asset_id: '1', asset_name: 'Expirado', asset_warranty_expire: '2026-06-27', client_id: '1' },
      { asset_id: '2', asset_name: 'En 90d',   asset_warranty_expire: '2026-09-26', client_id: '1' },
      { asset_id: '3', asset_name: 'En 91d',   asset_warranty_expire: '2026-09-27', client_id: '1' },
    ]);

    const result = await service.getExpirations(90);
    expect(result).toHaveLength(2);
    expect(result.map(i => i.itemName)).toContain('Expirado');
    expect(result.map(i => i.itemName)).toContain('En 90d');
  });

  it('sin days devuelve todos los items incluyendo futuros lejanos', async () => {
    setupMock([
      { asset_id: '1', asset_name: 'Lejano',   asset_warranty_expire: '2027-01-01', client_id: '1' },
      { asset_id: '2', asset_name: 'Expirado', asset_warranty_expire: '2026-05-01', client_id: '1' },
    ]);

    const result = await service.getExpirations(undefined);
    expect(result).toHaveLength(2);
  });

  it('ordena por expireDate ASC — expirados primero', async () => {
    setupMock([
      { asset_id: '1', asset_name: 'Futuro',   asset_warranty_expire: '2026-07-10', client_id: '1' },
      { asset_id: '2', asset_name: 'Expirado', asset_warranty_expire: '2026-06-20', client_id: '1' },
    ]);

    const result = await service.getExpirations(90);
    expect(result[0].itemName).toBe('Expirado');
    expect(result[1].itemName).toBe('Futuro');
  });

  it('usa fallback clientName cuando el client_id no está en el mapa', async () => {
    setupMock([{
      asset_id: '1', asset_name: 'Servidor', asset_warranty_expire: '2026-07-01', client_id: '99',
    }]);

    const result = await service.getExpirations(90);
    expect(result[0].clientName).toBe('Cliente 99');
  });

  it('normaliza un dominio con domain_expire', async () => {
    setupMock([], [], [{
      domain_id: '1', domain_name: 'acme.com.ar',
      domain_expire: '2026-07-05', domain_client_id: '1',
    }]);

    const result = await service.getExpirations(90);
    expect(result[0].type).toBe('domain');
    expect(result[0].itemName).toBe('acme.com.ar');
  });

  it('ignora un tipo cuya respuesta InfraDoc tiene success False — no lanza', async () => {
    httpService.get.mockImplementation((url: string) => {
      if (url.includes('/clients/'))      return of(axiosRes(CLIENTS_OK));
      if (url.includes('/assets/'))       return of(axiosRes({ success: 'False', message: 'Error' }));
      if (url.includes('/certificates/')) return of(axiosRes({ success: 'True', data: [{
        certificate_id: '1', certificate_name: 'cert.pem',
        certificate_expire: '2026-07-05', client_id: '1',
      }] }));
      return of(axiosRes({ success: 'True', data: [] }));
    });

    const result = await service.getExpirations(90);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('certificate');
  });

  it('lanza Error cuando INFRADOC_URL no está configurado', async () => {
    delete process.env.INFRADOC_URL;
    await expect(service.getExpirations(90)).rejects.toThrow(
      'INFRADOC_URL and INFRADOC_API_KEY deben estar configurados',
    );
    expect(httpService.get).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Ejecutar test — verificar que falla**

```bash
cd backend && npx jest notifications.service.spec --no-coverage
```
Expected: FAIL — `Cannot find module './notifications.service'`

- [ ] **Step 4: Crear DTO**

Crear `backend/src/notifications/dto/expiration-item.dto.ts`:

```typescript
export type ExpirationType = 'asset_warranty' | 'certificate' | 'domain' | 'software';

export class ExpirationItemDto {
  type!: ExpirationType;
  clientId!: number;
  clientName!: string;
  itemName!: string;
  expireDate!: string;
  daysUntil!: number;
}
```

> Si en Step 1 el campo de software no existe, remover `'software'` de `ExpirationType`.

- [ ] **Step 5: Implementar NotificationsService**

Crear `backend/src/notifications/notifications.service.ts`:

```typescript
import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ExpirationItemDto, ExpirationType } from './dto/expiration-item.dto';

interface RawClient     { client_id: string; client_name: string; }
interface RawAsset      { asset_id: string; asset_name: string; asset_warranty_expire: string | null; client_id: string; }
interface RawCert       { certificate_id: string; certificate_name: string; certificate_expire: string | null; client_id: string; }
interface RawDomain     { domain_id: string; domain_name: string; domain_expire: string | null; domain_client_id: string; }
interface RawSoftware   { software_id: string; software_name: string; software_expire: string | null; client_id: string; }
// Ajustar software_expire al nombre real descubierto en Step 1.

interface InfradocResponse<T> { success: string; data: T[]; }

@Injectable()
export class NotificationsService {
  constructor(private readonly httpService: HttpService) {}

  async getExpirations(days?: number): Promise<ExpirationItemDto[]> {
    const baseUrl = process.env.INFRADOC_URL;
    const apiKey  = process.env.INFRADOC_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error('INFRADOC_URL and INFRADOC_API_KEY deben estar configurados');
    }

    const agent = new https.Agent({ rejectUnauthorized: false });
    const get = <T>(module: string) =>
      firstValueFrom(
        this.httpService.get<InfradocResponse<T>>(
          `${baseUrl}/api/v1/${module}/read.php`,
          { httpsAgent: agent, params: { api_key: apiKey, limit: 500 } },
        ),
      );

    const [clientsRes, assetsRes, certsRes, domainsRes, softwareRes] = await Promise.all([
      get<RawClient>('clients'),
      get<RawAsset>('assets'),
      get<RawCert>('certificates'),
      get<RawDomain>('domains'),
      get<RawSoftware>('software'),
    ]);

    const clientMap = new Map<string, string>();
    for (const c of (clientsRes.data.data ?? [])) {
      clientMap.set(String(c.client_id), c.client_name);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const items: ExpirationItemDto[] = [];

    for (const r of this.safe(assetsRes.data)) {
      if (!r.asset_warranty_expire) continue;
      items.push(this.toItem('asset_warranty', r.client_id, r.asset_name, r.asset_warranty_expire, clientMap, today));
    }
    for (const r of this.safe(certsRes.data)) {
      if (!r.certificate_expire) continue;
      items.push(this.toItem('certificate', r.client_id, r.certificate_name, r.certificate_expire, clientMap, today));
    }
    for (const r of this.safe(domainsRes.data)) {
      if (!r.domain_expire) continue;
      items.push(this.toItem('domain', r.domain_client_id, r.domain_name, r.domain_expire, clientMap, today));
    }
    for (const r of this.safe(softwareRes.data)) {
      if (!r.software_expire) continue;
      items.push(this.toItem('software', r.client_id, r.software_name, r.software_expire, clientMap, today));
    }

    return this.filterAndSort(items, days);
  }

  private safe<T>(res: InfradocResponse<T>): T[] {
    return res.success === 'True' && Array.isArray(res.data) ? res.data : [];
  }

  private toItem(
    type: ExpirationType,
    rawClientId: string,
    name: string,
    expireDate: string,
    clientMap: Map<string, string>,
    today: Date,
  ): ExpirationItemDto {
    const clientId = Number(rawClientId);
    const expire = new Date(expireDate);
    expire.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((expire.getTime() - today.getTime()) / 86_400_000);
    return {
      type,
      clientId,
      clientName: clientMap.get(String(clientId)) ?? `Cliente ${clientId}`,
      itemName: name,
      expireDate,
      daysUntil,
    };
  }

  private filterAndSort(items: ExpirationItemDto[], days?: number): ExpirationItemDto[] {
    const filtered = days !== undefined
      ? items.filter(i => i.daysUntil < 0 || i.daysUntil <= days)
      : items;
    return filtered.sort((a, b) => a.expireDate.localeCompare(b.expireDate));
  }
}
```

- [ ] **Step 6: Ejecutar tests — verificar que pasan**

```bash
cd backend && npx jest notifications.service.spec --no-coverage
```
Expected: PASS — todos los tests verdes.

- [ ] **Step 7: Commit**

```bash
git add backend/src/notifications/
git commit -m "feat(notifications): DTO + service de vencimientos InfraDoc"
```

---

## Task 2: Backend Controller + Module + registro en AppModule

**Files:**
- Create: `backend/src/notifications/notifications.controller.ts`
- Create: `backend/src/notifications/notifications.controller.spec.ts`
- Create: `backend/src/notifications/notifications.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `NotificationsService.getExpirations(days?: number)`
- Produces: `GET /notifications/expirations?days=<number>`

- [ ] **Step 1: Escribir el test del controller**

Crear `backend/src/notifications/notifications.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpirationItemDto } from './dto/expiration-item.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: { getExpirations: jest.Mock };

  const makeItem = (): ExpirationItemDto => ({
    type: 'domain', clientId: 1, clientName: 'Acme',
    itemName: 'acme.com', expireDate: '2026-07-15', daysUntil: 17,
  });

  beforeEach(async () => {
    service = { getExpirations: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: service },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('devuelve el array del servicio', async () => {
    service.getExpirations.mockResolvedValue([makeItem()]);
    const result = await controller.getExpirations(undefined);
    expect(result).toHaveLength(1);
  });

  it('parsea query param days a número y lo pasa al servicio', async () => {
    service.getExpirations.mockResolvedValue([]);
    await controller.getExpirations('30');
    expect(service.getExpirations).toHaveBeenCalledWith(30);
  });

  it('pasa undefined al servicio cuando days no se provee', async () => {
    service.getExpirations.mockResolvedValue([]);
    await controller.getExpirations(undefined);
    expect(service.getExpirations).toHaveBeenCalledWith(undefined);
  });

  it('tiene JwtAuthGuard aplicado', () => {
    const guards = Reflect.getMetadata('__guards__', NotificationsController);
    expect(guards).toContain(JwtAuthGuard);
  });
});
```

- [ ] **Step 2: Ejecutar test — verificar que falla**

```bash
cd backend && npx jest notifications.controller.spec --no-coverage
```
Expected: FAIL — `Cannot find module './notifications.controller'`

- [ ] **Step 3: Implementar controller**

Crear `backend/src/notifications/notifications.controller.ts`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { ExpirationItemDto } from './dto/expiration-item.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('expirations')
  getExpirations(@Query('days') days?: string): Promise<ExpirationItemDto[]> {
    const parsedDays = days !== undefined ? parseInt(days, 10) : undefined;
    return this.notificationsService.getExpirations(parsedDays);
  }
}
```

- [ ] **Step 4: Ejecutar test del controller — verificar que pasa**

```bash
cd backend && npx jest notifications.controller.spec --no-coverage
```
Expected: PASS

- [ ] **Step 5: Crear módulo y registrar en AppModule**

Crear `backend/src/notifications/notifications.module.ts`:

```typescript
import * as https from 'https';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    HttpModule.register({
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
```

Modificar `backend/src/app.module.ts` — agregar la importación:

```typescript
import { NotificationsModule } from './notifications/notifications.module';

// Dentro de @Module imports[]:
NotificationsModule,
```

El array `imports` completo queda:
```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  TypeOrmModule.forRoot({ ... }),
  ScheduleModule.forRoot(),
  AuthModule,
  UsersModule,
  ClientsModule,
  TechniciansModule,
  TasksModule,
  MaintenanceLogsModule,
  InfradocIntegrationModule,
  OdooIntegrationModule,
  NotificationsModule,
],
```

- [ ] **Step 6: Ejecutar todos los tests del módulo**

```bash
cd backend && npx jest notifications --no-coverage
```
Expected: PASS — todos los tests de `notifications/` verdes.

- [ ] **Step 7: Commit**

```bash
git add backend/src/notifications/notifications.controller.ts \
        backend/src/notifications/notifications.controller.spec.ts \
        backend/src/notifications/notifications.module.ts \
        backend/src/app.module.ts
git commit -m "feat(notifications): controller, módulo y registro en AppModule"
```

---

## Task 3: Frontend — Model, Service y NotificationsComponent

**Files:**
- Create: `frontend/src/app/core/models/notification.models.ts`
- Create: `frontend/src/app/core/services/notifications.service.ts`
- Create: `frontend/src/app/features/admin/notifications/notifications.component.ts`
- Create: `frontend/src/app/features/admin/notifications/notifications.component.html`
- Create: `frontend/src/app/features/admin/notifications/notifications.component.scss`
- Create: `frontend/src/app/features/admin/notifications/notifications.component.spec.ts`
- Modify: `frontend/src/app/features/admin/admin.module.ts`
- Modify: `frontend/src/app/features/admin/admin-routing.module.ts`
- Modify: `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts`

**Interfaces:**
- Consumes: `GET /api/notifications/expirations?days=<number>` → `ExpirationItem[]`
- Produces: `NotificationsComponent` en ruta `/admin/notifications`

- [ ] **Step 1: Crear modelo y servicio frontend**

Crear `frontend/src/app/core/models/notification.models.ts`:

```typescript
export type ExpirationType = 'asset_warranty' | 'certificate' | 'domain' | 'software';

export interface ExpirationItem {
  type: ExpirationType;
  clientId: number;
  clientName: string;
  itemName: string;
  expireDate: string;
  daysUntil: number;
}
```

Crear `frontend/src/app/core/services/notifications.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ExpirationItem } from '../models/notification.models';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly base = `${environment.apiUrl}/notifications`;

  constructor(private http: HttpClient) {}

  getExpirations(days?: number): Observable<ExpirationItem[]> {
    const params = days !== undefined
      ? new HttpParams().set('days', String(days))
      : new HttpParams();
    return this.http.get<ExpirationItem[]>(`${this.base}/expirations`, { params });
  }
}
```

- [ ] **Step 2: Escribir el test del componente**

Crear `frontend/src/app/features/admin/notifications/notifications.component.spec.ts`:

```typescript
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
    expect(component.items).toHaveLength(5);
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
    expect(component.filteredItems).toHaveLength(1);
    expect(component.filteredItems[0].itemName).toBe('Esta semana');
  });

  it('filterUrgency=expired muestra solo items con daysUntil < 0', () => {
    component.filterUrgency = 'expired';
    expect(component.filteredItems).toHaveLength(1);
    expect(component.filteredItems[0].daysUntil).toBeLessThan(0);
  });

  it('filterUrgency=week muestra solo items con 0 ≤ daysUntil ≤ 7', () => {
    component.filterUrgency = 'week';
    const result = component.filteredItems;
    expect(result.every(i => i.daysUntil >= 0 && i.daysUntil <= 7)).toBeTrue();
  });

  it('filterUrgency=soon muestra solo items con 8 ≤ daysUntil ≤ 20', () => {
    component.filterUrgency = 'soon';
    const result = component.filteredItems;
    expect(result.every(i => i.daysUntil >= 8 && i.daysUntil <= 20)).toBeTrue();
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
```

- [ ] **Step 3: Ejecutar test — verificar que falla**

```bash
cd frontend && npx ng test --include="**/notifications.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: FAIL — `Cannot find module './notifications.component'`

- [ ] **Step 4: Implementar el componente TypeScript**

Crear `frontend/src/app/features/admin/notifications/notifications.component.ts`:

```typescript
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExpirationItem, ExpirationType } from '../../../core/models/notification.models';
import { NotificationsService } from '../../../core/services/notifications.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  items: ExpirationItem[] = [];
  loading = false;
  error = '';
  filterType: ExpirationType | '' = '';
  filterUrgency: 'expired' | 'week' | 'soon' | 'attention' | '' = '';
  showAll = false;

  readonly displayedColumns = ['client', 'item', 'type', 'expireDate', 'status'];

  private readonly destroyRef = inject(DestroyRef);

  constructor(private notificationsService: NotificationsService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const days = this.showAll ? undefined : 90;
    this.notificationsService.getExpirations(days)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => { this.items = items; this.loading = false; },
        error: () => { this.error = 'No se pudo cargar los vencimientos'; this.loading = false; },
      });
  }

  get filteredItems(): ExpirationItem[] {
    return this.items.filter(item => {
      if (this.filterType && item.type !== this.filterType) return false;
      if (this.filterUrgency) {
        const u = this.filterUrgency;
        if (u === 'expired'   && item.daysUntil >= 0)                              return false;
        if (u === 'week'      && (item.daysUntil < 0  || item.daysUntil > 7))      return false;
        if (u === 'soon'      && (item.daysUntil < 8  || item.daysUntil > 20))     return false;
        if (u === 'attention' && (item.daysUntil < 21 || item.daysUntil > 45))     return false;
      }
      return true;
    });
  }

  get expiredCount(): number { return this.items.filter(i => i.daysUntil < 0).length; }
  get weekCount():    number { return this.items.filter(i => i.daysUntil >= 0 && i.daysUntil <= 7).length; }
  get soonCount():    number { return this.items.filter(i => i.daysUntil >= 8 && i.daysUntil <= 20).length; }
  get totalShown():   number { return this.filteredItems.length; }

  urgencyClass(item: ExpirationItem): string {
    if (item.daysUntil < 0)  return 'badge--crit';
    if (item.daysUntil <= 7) return 'badge--crit';
    if (item.daysUntil <= 20) return 'badge--warn';
    if (item.daysUntil <= 45) return 'badge--accent';
    return 'badge--neutral';
  }

  urgencyLabel(item: ExpirationItem): string {
    return item.daysUntil < 0 ? 'Vencido' : `${item.daysUntil} días`;
  }

  typeClass(type: ExpirationType): string {
    const map: Record<ExpirationType, string> = {
      asset_warranty: 'badge--srv',
      certificate:    'badge--bkp',
      domain:         'badge--accent',
      software:       'badge--win',
    };
    return map[type];
  }

  typeLabel(type: ExpirationType): string {
    const map: Record<ExpirationType, string> = {
      asset_warranty: 'Garantía',
      certificate:    'Certificado',
      domain:         'Dominio',
      software:       'Licencia',
    };
    return map[type];
  }

  onShowAllChange(): void {
    this.load();
  }
}
```

- [ ] **Step 5: Implementar el template HTML**

Crear `frontend/src/app/features/admin/notifications/notifications.component.html`:

```html
<div class="page">

  <div class="page-hdr">
    <div class="page-hdr__left">
      <span class="page-title">Vencimientos</span>
      <span class="page-count" *ngIf="!loading">{{ totalShown }} items</span>
    </div>
    <button mat-stroked-button (click)="load()" [disabled]="loading">Actualizar</button>
  </div>

  <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

  <div *ngIf="error" class="error-banner">{{ error }}</div>

  <div class="kpi-row">
    <div class="kpi kpi--vencido">
      <div class="kpi__label">Vencidos</div>
      <div class="kpi__value">{{ expiredCount }}</div>
      <div class="kpi__sub">requieren acción</div>
    </div>
    <div class="kpi kpi--crit">
      <div class="kpi__label">Esta semana</div>
      <div class="kpi__value">{{ weekCount }}</div>
      <div class="kpi__sub">≤ 7 días</div>
    </div>
    <div class="kpi kpi--warn">
      <div class="kpi__label">Próximamente</div>
      <div class="kpi__value">{{ soonCount }}</div>
      <div class="kpi__sub">8 – 20 días</div>
    </div>
    <div class="kpi kpi--total">
      <div class="kpi__label">Mostrando</div>
      <div class="kpi__value">{{ totalShown }}</div>
      <div class="kpi__sub">{{ showAll ? 'todos' : 'próximos 90 días' }}</div>
    </div>
  </div>

  <div class="filter-bar">
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Tipo</mat-label>
      <mat-select [(ngModel)]="filterType">
        <mat-option value="">Todos los tipos</mat-option>
        <mat-option value="asset_warranty">Garantía de activo</mat-option>
        <mat-option value="certificate">Certificado SSL</mat-option>
        <mat-option value="domain">Dominio</mat-option>
        <mat-option value="software">Licencia</mat-option>
      </mat-select>
    </mat-form-field>

    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>Urgencia</mat-label>
      <mat-select [(ngModel)]="filterUrgency">
        <mat-option value="">Toda urgencia</mat-option>
        <mat-option value="expired">Vencidos</mat-option>
        <mat-option value="week">Esta semana (≤7d)</mat-option>
        <mat-option value="soon">Próximo (≤20d)</mat-option>
        <mat-option value="attention">Atención (≤45d)</mat-option>
      </mat-select>
    </mat-form-field>

    <span class="filter-sep"></span>

    <mat-checkbox [(ngModel)]="showAll" (change)="onShowAllChange()">
      Ver todos los futuros
    </mat-checkbox>
  </div>

  <mat-table [dataSource]="filteredItems" class="exp-table">

    <ng-container matColumnDef="client">
      <mat-header-cell *matHeaderCellDef>Cliente</mat-header-cell>
      <mat-cell *matCellDef="let item">{{ item.clientName }}</mat-cell>
    </ng-container>

    <ng-container matColumnDef="item">
      <mat-header-cell *matHeaderCellDef>Item</mat-header-cell>
      <mat-cell *matCellDef="let item" class="cell--name">{{ item.itemName }}</mat-cell>
    </ng-container>

    <ng-container matColumnDef="type">
      <mat-header-cell *matHeaderCellDef>Tipo</mat-header-cell>
      <mat-cell *matCellDef="let item">
        <span class="badge badge--type" [ngClass]="typeClass(item.type)">{{ typeLabel(item.type) }}</span>
      </mat-cell>
    </ng-container>

    <ng-container matColumnDef="expireDate">
      <mat-header-cell *matHeaderCellDef>Vence</mat-header-cell>
      <mat-cell *matCellDef="let item" class="cell--mono">{{ item.expireDate }}</mat-cell>
    </ng-container>

    <ng-container matColumnDef="status">
      <mat-header-cell *matHeaderCellDef>Estado</mat-header-cell>
      <mat-cell *matCellDef="let item">
        <span class="badge" [ngClass]="urgencyClass(item)">{{ urgencyLabel(item) }}</span>
      </mat-cell>
    </ng-container>

    <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
    <mat-row
      *matRowDef="let row; columns: displayedColumns;"
      class="exp-row"
      [class.exp-row--expired]="row.daysUntil < 0">
    </mat-row>

  </mat-table>

</div>
```

- [ ] **Step 6: Implementar estilos SCSS**

Crear `frontend/src/app/features/admin/notifications/notifications.component.scss`:

```scss
:host { display: block; }

.page {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-hdr {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.page-hdr__left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--tx-hi);
}

.page-count {
  font-size: 11px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.kpi {
  background: var(--surface);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius);
  padding: 12px 16px;
  box-shadow: var(--shadow-card);

  &__label {
    font-size: 9px;
    color: var(--tx-lo);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-family: var(--font-mono);
    margin-bottom: 6px;
  }

  &__value {
    font-size: 26px;
    font-weight: 500;
    line-height: 1;
    font-family: var(--font-mono);
    color: var(--tx-hi);
  }

  &__sub {
    font-size: 10px;
    color: var(--tx-lo);
    margin-top: 4px;
  }

  &--vencido .kpi__value { color: var(--crit); }
  &--crit    .kpi__value { color: var(--warn); }
  &--warn    .kpi__value { color: var(--accent); }
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-sep { flex: 1; }

.exp-table {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border-lo);
  border-radius: var(--radius);
}

.cell--mono { font-family: var(--font-mono); font-size: 11px; }
.cell--name { font-size: 11px; color: var(--tx-md); }

.exp-row--expired {
  --mat-table-row-item-container-color: rgba(248, 113, 113, 0.04);
}
```

- [ ] **Step 7: Registrar en AdminModule, routing y layout**

Modificar `frontend/src/app/features/admin/admin.module.ts` — agregar `MatCheckboxModule` en imports y `NotificationsComponent` en declarations:

```typescript
import { MatCheckboxModule } from '@angular/material/checkbox';
import { NotificationsComponent } from './notifications/notifications.component';

// En declarations[]:
NotificationsComponent,

// En imports[]:
MatCheckboxModule,
```

Modificar `frontend/src/app/features/admin/admin-routing.module.ts` — agregar ruta:

```typescript
import { NotificationsComponent } from './notifications/notifications.component';

// En routes[], dentro del children[]:
{ path: 'notifications', component: NotificationsComponent },
```

Modificar `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts` — agregar tab:

```typescript
readonly tabs: AdminTab[] = [
  { path: '/admin/tasks',         label: 'Tareas'        },
  { path: '/admin/users',         label: 'Usuarios'      },
  { path: '/admin/technicians',   label: 'Técnicos'      },
  { path: '/admin/notifications', label: 'Vencimientos'  },
];
```

- [ ] **Step 8: Ejecutar tests del componente — verificar que pasan**

```bash
cd frontend && npx ng test --include="**/notifications.component.spec.ts" --watch=false --browsers=ChromeHeadless
```
Expected: PASS — todos los tests verdes.

- [ ] **Step 9: Ejecutar suite completa de frontend**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```
Expected: sin regresiones.

- [ ] **Step 10: Ejecutar suite completa de backend**

```bash
cd backend && npx jest --no-coverage
```
Expected: sin regresiones.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/app/core/models/notification.models.ts \
        frontend/src/app/core/services/notifications.service.ts \
        frontend/src/app/features/admin/notifications/ \
        frontend/src/app/features/admin/admin.module.ts \
        frontend/src/app/features/admin/admin-routing.module.ts \
        frontend/src/app/features/admin/admin-layout/admin-layout.component.ts
git commit -m "feat(notifications): componente Angular con KPIs, filtros y mat-table"
```
