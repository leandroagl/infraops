# Horas de suscripción en tabla de clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar horas contratadas, usadas y disponibles de Odoo en la tabla de clientes, reemplazando la columna de dirección.

**Architecture:** Nuevo método en `OdooService` que consulta `sale.order.line` en 2 llamadas bulk para todos los clientes. Un nuevo `SubscriptionHoursController` (dentro de `OdooIntegrationModule`, montado en `/clients/subscription-hours`) evita la dependencia circular con `ClientsModule`. El frontend carga clientes y horas en paralelo; la tabla aparece inmediatamente y las horas se mergean cuando llegan.

**Tech Stack:** NestJS · TypeORM · Angular · Angular Material · RxJS

**Spec:** `docs/superpowers/specs/2026-08-19-clients-subscription-hours-design.md`

## Global Constraints

- TDD obligatorio: test antes que implementación en todo cambio de backend
- Sin elementos HTML nativos en templates Angular — solo Angular Material
- `appearance="outline"` en todos los `mat-form-field`
- Sin standalone components en Angular
- Idioma del código: inglés · commits: español
- No cachear datos de Odoo en la base de datos
- `available = Math.max(0, contracted - delivered)` — nunca negativo

---

## File Map

| Archivo | Operación | Responsabilidad |
|---|---|---|
| `backend/src/integrations/odoo/odoo.service.ts` | Modificar | Agregar `getSubscriptionHours` y `getClientSubscriptionHours` |
| `backend/src/integrations/odoo/odoo.service.spec.ts` | Modificar | Tests de los dos métodos nuevos |
| `backend/src/integrations/odoo/dto/client-subscription-hours.dto.ts` | Crear | DTO de respuesta |
| `backend/src/integrations/odoo/subscription-hours.controller.ts` | Crear | `GET /clients/subscription-hours` |
| `backend/src/integrations/odoo/subscription-hours.controller.spec.ts` | Crear | Test del controller |
| `backend/src/integrations/odoo/odoo-integration.module.ts` | Modificar | Registrar `SubscriptionHoursController` |
| `frontend/src/app/core/models/client.models.ts` | Modificar | Agregar `ClientSubscriptionHours` y `ClientWithHours` |
| `frontend/src/app/core/services/clients.service.ts` | Modificar | Agregar `getSubscriptionHours()` |
| `frontend/src/app/features/clients/clients-list/clients-list.component.ts` | Modificar | Carga paralela, merge local, helpers de color |
| `frontend/src/app/features/clients/clients-list/clients-list.component.html` | Modificar | Columna horas, quitar dirección, buscador izquierda |
| `frontend/src/app/features/clients/clients-list/clients-list.component.scss` | Modificar | Estilos de celda de horas y skeleton |
| `frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts` | Crear | Tests del componente |

---

## Task 1: Branch y DTO

**Files:**
- Create: `backend/src/integrations/odoo/dto/client-subscription-hours.dto.ts`

**Interfaces:**
- Produces: clase `ClientSubscriptionHoursDto` con `clientId: string`, `contracted: number`, `delivered: number`, `available: number`

- [ ] **Step 1: Crear branch**

```bash
git checkout -b feature/clients-subscription-hours
```

- [ ] **Step 2: Crear el DTO**

Crear `backend/src/integrations/odoo/dto/client-subscription-hours.dto.ts`:

```typescript
export class ClientSubscriptionHoursDto {
  clientId: string;
  contracted: number;
  delivered: number;
  available: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/integrations/odoo/dto/client-subscription-hours.dto.ts
git commit -m "feat: agregar DTO ClientSubscriptionHoursDto"
```

---

## Task 2: OdooService — getSubscriptionHours (método interno bulk)

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`

**Interfaces:**
- Consumes: `this.systemRpc.callKw<T>(model, method, args, kwargs)` — ya existe
- Produces: `getSubscriptionHours(partnerIds: number[]): Promise<{ partnerId: number; contracted: number; delivered: number }[]>`

- [ ] **Step 1: Escribir los tests (failing)**

Agregar en `odoo.service.spec.ts`, dentro del `describe('OdooService')` existente:

```typescript
describe('getSubscriptionHours', () => {
  it('retorna lista vacía sin llamar a Odoo cuando partnerIds está vacío', async () => {
    const result = await service.getSubscriptionHours([]);
    expect(result).toEqual([]);
    expect(odooRpc.callKw).not.toHaveBeenCalled();
  });

  it('suma horas de dos productos (Hora Única + Hora Única Garantia) para el mismo partner', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([
        { id: 1, product_uom_qty: 20, qty_delivered: 8,  order_id: [101, 'SO001'] },
        { id: 2, product_uom_qty: 5,  qty_delivered: 2,  order_id: [101, 'SO001'] },
      ])
      .mockResolvedValueOnce([
        { id: 101, partner_id: [201, 'ACME Corp'] },
      ]);

    const result = await service.getSubscriptionHours([201]);

    expect(result).toEqual([{ partnerId: 201, contracted: 25, delivered: 10 }]);
  });

  it('maneja múltiples partners en una sola llamada a Odoo', async () => {
    odooRpc.callKw
      .mockResolvedValueOnce([
        { id: 1, product_uom_qty: 20, qty_delivered: 5, order_id: [101, 'SO001'] },
        { id: 2, product_uom_qty: 10, qty_delivered: 8, order_id: [102, 'SO002'] },
      ])
      .mockResolvedValueOnce([
        { id: 101, partner_id: [201, 'ACME Corp'] },
        { id: 102, partner_id: [202, 'Beta SRL'] },
      ]);

    const result = await service.getSubscriptionHours([201, 202]);

    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ partnerId: 201, contracted: 20, delivered: 5 });
    expect(result).toContainEqual({ partnerId: 202, contracted: 10, delivered: 8 });
  });

  it('retorna lista vacía y hace solo una llamada cuando Odoo no devuelve líneas', async () => {
    odooRpc.callKw.mockResolvedValueOnce([]);

    const result = await service.getSubscriptionHours([201]);

    expect(result).toEqual([]);
    expect(odooRpc.callKw).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

```bash
cd backend && npx jest odoo.service.spec.ts --testNamePattern="getSubscriptionHours" --no-coverage
```

Esperado: FAIL — `getSubscriptionHours is not a function`

- [ ] **Step 3: Implementar el método en odoo.service.ts**

Agregar a los imports de TypeORM al inicio del archivo (línea 9):
```typescript
import { IsNull, Not, Repository } from 'typeorm';
```

Agregar el método dentro de la clase `OdooService`, antes de `logTimesheet`:

```typescript
async getSubscriptionHours(
  partnerIds: number[],
): Promise<{ partnerId: number; contracted: number; delivered: number }[]> {
  if (partnerIds.length === 0) return [];

  const lines = await this.systemRpc.callKw<
    Array<{
      id: number;
      product_uom_qty: number;
      qty_delivered: number;
      order_id: [number, string];
    }>
  >(
    'sale.order.line',
    'search_read',
    [
      [
        ['order_id.partner_id', 'in', partnerIds],
        ['product_id.name', 'in', ['Hora Única', 'Hora Única Garantia']],
        ['order_id.state', 'in', ['sale', 'done']],
      ],
    ],
    { fields: ['product_uom_qty', 'qty_delivered', 'order_id'] },
  );

  if (lines.length === 0) return [];

  const orderIds = [...new Set(lines.map((l) => l.order_id[0]))];
  const orders = await this.systemRpc.callKw<
    Array<{ id: number; partner_id: [number, string] }>
  >(
    'sale.order',
    'read',
    [orderIds],
    { fields: ['partner_id'] },
  );

  const partnerByOrderId = new Map(orders.map((o) => [o.id, o.partner_id[0]]));

  const totals = new Map<number, { contracted: number; delivered: number }>();
  for (const line of lines) {
    const partnerId = partnerByOrderId.get(line.order_id[0]);
    if (partnerId === undefined) continue;
    const existing = totals.get(partnerId) ?? { contracted: 0, delivered: 0 };
    totals.set(partnerId, {
      contracted: existing.contracted + line.product_uom_qty,
      delivered: existing.delivered + line.qty_delivered,
    });
  }

  return Array.from(totals.entries()).map(([partnerId, { contracted, delivered }]) => ({
    partnerId,
    contracted,
    delivered,
  }));
}
```

- [ ] **Step 4: Ejecutar para verificar que pasan**

```bash
npx jest odoo.service.spec.ts --testNamePattern="getSubscriptionHours" --no-coverage
```

Esperado: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts backend/src/integrations/odoo/odoo.service.spec.ts
git commit -m "feat(odoo): agregar getSubscriptionHours — query bulk en 2 llamadas"
```

---

## Task 3: OdooService — getClientSubscriptionHours + Controller + Module

**Files:**
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.spec.ts`
- Create: `backend/src/integrations/odoo/subscription-hours.controller.ts`
- Create: `backend/src/integrations/odoo/subscription-hours.controller.spec.ts`
- Modify: `backend/src/integrations/odoo/odoo-integration.module.ts`

**Interfaces:**
- Consumes: `getSubscriptionHours(partnerIds)` — Task 2; `ClientSubscriptionHoursDto` — Task 1
- Produces: `GET /clients/subscription-hours` → `ClientSubscriptionHoursDto[]`

- [ ] **Step 1: Escribir test de getClientSubscriptionHours (failing)**

Agregar en `odoo.service.spec.ts` dentro del `describe('OdooService')`:

```typescript
describe('getClientSubscriptionHours', () => {
  it('devuelve horas mapeadas por clientId con available calculado', async () => {
    clientRepo.find.mockResolvedValue([
      makeClient({ id: 'client-1', odooPartnerId: 201 }),
    ]);
    jest.spyOn(service, 'getSubscriptionHours').mockResolvedValue([
      { partnerId: 201, contracted: 20, delivered: 8 },
    ]);

    const result = await service.getClientSubscriptionHours();

    expect(result).toEqual([
      { clientId: 'client-1', contracted: 20, delivered: 8, available: 12 },
    ]);
  });

  it('available es 0 cuando delivered supera contracted', async () => {
    clientRepo.find.mockResolvedValue([
      makeClient({ id: 'client-1', odooPartnerId: 201 }),
    ]);
    jest.spyOn(service, 'getSubscriptionHours').mockResolvedValue([
      { partnerId: 201, contracted: 10, delivered: 15 },
    ]);

    const result = await service.getClientSubscriptionHours();

    expect(result[0].available).toBe(0);
  });

  it('retorna lista vacía y no llama a getSubscriptionHours cuando no hay clientes con odooPartnerId', async () => {
    clientRepo.find.mockResolvedValue([]);
    const spy = jest.spyOn(service, 'getSubscriptionHours');

    const result = await service.getClientSubscriptionHours();

    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que fallan**

```bash
npx jest odoo.service.spec.ts --testNamePattern="getClientSubscriptionHours" --no-coverage
```

Esperado: FAIL — `getClientSubscriptionHours is not a function`

- [ ] **Step 3: Implementar getClientSubscriptionHours en odoo.service.ts**

Agregar el método después de `getSubscriptionHours`:

```typescript
async getClientSubscriptionHours(): Promise<ClientSubscriptionHoursDto[]> {
  const clients = await this.clientRepo.find({
    where: { isActive: true, odooPartnerId: Not(IsNull()) },
    select: { id: true, odooPartnerId: true },
  });

  if (clients.length === 0) return [];

  const partnerIds = clients.map((c) => c.odooPartnerId!);
  const hours = await this.getSubscriptionHours(partnerIds);

  const partnerToClientId = new Map(clients.map((c) => [c.odooPartnerId!, c.id]));

  return hours.map(({ partnerId, contracted, delivered }) => ({
    clientId: partnerToClientId.get(partnerId)!,
    contracted,
    delivered,
    available: Math.max(0, contracted - delivered),
  }));
}
```

Agregar el import del DTO al inicio de `odoo.service.ts`:

```typescript
import { ClientSubscriptionHoursDto } from './dto/client-subscription-hours.dto';
```

- [ ] **Step 4: Ejecutar tests**

```bash
npx jest odoo.service.spec.ts --no-coverage
```

Esperado: todos los tests existentes + los nuevos en PASS

- [ ] **Step 5: Crear el controller spec (failing)**

Crear `backend/src/integrations/odoo/subscription-hours.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionHoursController } from './subscription-hours.controller';
import { OdooService } from './odoo.service';
import { ClientSubscriptionHoursDto } from './dto/client-subscription-hours.dto';

describe('SubscriptionHoursController', () => {
  let controller: SubscriptionHoursController;
  let odooService: { getClientSubscriptionHours: jest.Mock };

  beforeEach(async () => {
    odooService = { getClientSubscriptionHours: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionHoursController],
      providers: [{ provide: OdooService, useValue: odooService }],
    }).compile();

    controller = module.get<SubscriptionHoursController>(SubscriptionHoursController);
  });

  it('llama a odooService.getClientSubscriptionHours y devuelve el resultado', async () => {
    const mockData: ClientSubscriptionHoursDto[] = [
      { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
    ];
    odooService.getClientSubscriptionHours.mockResolvedValue(mockData);

    const result = await controller.getAll();

    expect(odooService.getClientSubscriptionHours).toHaveBeenCalled();
    expect(result).toEqual(mockData);
  });
});
```

- [ ] **Step 6: Ejecutar para verificar que falla**

```bash
npx jest subscription-hours.controller.spec.ts --no-coverage
```

Esperado: FAIL — `Cannot find module './subscription-hours.controller'`

- [ ] **Step 7: Crear el controller**

Crear `backend/src/integrations/odoo/subscription-hours.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OdooService } from './odoo.service';
import { ClientSubscriptionHoursDto } from './dto/client-subscription-hours.dto';

@Controller('clients/subscription-hours')
@UseGuards(JwtAuthGuard)
export class SubscriptionHoursController {
  constructor(private readonly odooService: OdooService) {}

  @Get()
  getAll(): Promise<ClientSubscriptionHoursDto[]> {
    return this.odooService.getClientSubscriptionHours();
  }
}
```

- [ ] **Step 8: Registrar el controller en el módulo**

Modificar `odoo-integration.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module';
import { UsersModule } from '../../users/users.module';
import { TechniciansModule } from '../../technicians/technicians.module';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';
import { SubscriptionHoursController } from './subscription-hours.controller';

@Module({
  imports: [ClientsModule, UsersModule, TechniciansModule],
  controllers: [OdooController, SubscriptionHoursController],
  providers: [OdooSystemRpcService, OdooService],
  exports: [OdooService],
})
export class OdooIntegrationModule {}
```

- [ ] **Step 9: Ejecutar todos los tests de backend**

```bash
npx jest --no-coverage
```

Esperado: todos en PASS

- [ ] **Step 10: Commit**

```bash
git add backend/src/integrations/odoo/odoo.service.ts \
        backend/src/integrations/odoo/odoo.service.spec.ts \
        backend/src/integrations/odoo/subscription-hours.controller.ts \
        backend/src/integrations/odoo/subscription-hours.controller.spec.ts \
        backend/src/integrations/odoo/odoo-integration.module.ts
git commit -m "feat(odoo): endpoint GET /clients/subscription-hours"
```

---

## Task 4: Frontend — modelos y service

**Files:**
- Modify: `frontend/src/app/core/models/client.models.ts`
- Modify: `frontend/src/app/core/services/clients.service.ts`

**Interfaces:**
- Produces: interfaz `ClientSubscriptionHours`, interfaz `ClientWithHours`, método `ClientsService.getSubscriptionHours()`

- [ ] **Step 1: Actualizar client.models.ts**

Reemplazar el contenido de `frontend/src/app/core/models/client.models.ts`:

```typescript
export interface Client {
  id: string;
  name: string;
  primaryAddress: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ClientSubscriptionHours {
  clientId: string;
  contracted: number;
  delivered: number;
  available: number;
}

export interface ClientWithHours extends Client {
  hours?: ClientSubscriptionHours;
}
```

- [ ] **Step 2: Agregar getSubscriptionHours al service**

Agregar el método en `frontend/src/app/core/services/clients.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Client, ClientSubscriptionHours } from '../models/client.models';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly base = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Client[]> {
    return this.http.get<Client[]>(this.base);
  }

  getById(id: string): Observable<Client> {
    return this.http.get<Client>(`${this.base}/${id}`);
  }

  getSubscriptionHours(): Observable<ClientSubscriptionHours[]> {
    return this.http.get<ClientSubscriptionHours[]>(`${this.base}/subscription-hours`);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/core/models/client.models.ts \
        frontend/src/app/core/services/clients.service.ts
git commit -m "feat(frontend): modelos y service para horas de suscripción"
```

---

## Task 5: Frontend — componente, template y estilos

**Files:**
- Modify: `frontend/src/app/features/clients/clients-list/clients-list.component.ts`
- Modify: `frontend/src/app/features/clients/clients-list/clients-list.component.html`
- Modify: `frontend/src/app/features/clients/clients-list/clients-list.component.scss`
- Create: `frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts`

**Interfaces:**
- Consumes: `ClientsService.getAll()`, `ClientsService.getSubscriptionHours()`, `ClientWithHours`, `ClientSubscriptionHours` — Tasks 4

- [ ] **Step 1: Escribir el spec (failing)**

Crear `frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts`:

```typescript
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

describe('ClientsListComponent', () => {
  let component: ClientsListComponent;
  let fixture: ComponentFixture<ClientsListComponent>;
  let clientsService: { getAll: jest.Mock; getSubscriptionHours: jest.Mock };

  beforeEach(async () => {
    clientsService = {
      getAll: jest.fn().mockReturnValue(of([])),
      getSubscriptionHours: jest.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      declarations: [ClientsListComponent],
      imports: [
        NoopAnimationsModule,
        RouterTestingModule,
        FormsModule,
        MatTableModule,
        MatSortModule,
        MatFormFieldModule,
        MatInputModule,
      ],
      providers: [{ provide: ClientsService, useValue: clientsService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lanza getAll y getSubscriptionHours en paralelo al inicializar', () => {
    expect(clientsService.getAll).toHaveBeenCalledTimes(1);
    expect(clientsService.getSubscriptionHours).toHaveBeenCalledTimes(1);
  });

  it('filtra clientes inactivos y popula dataSource', () => {
    const clients = [makeClient({ id: 'c1', isActive: true }), makeClient({ id: 'c2', isActive: false })];
    clientsService.getAll.mockReturnValue(of(clients));
    clientsService.getSubscriptionHours.mockReturnValue(NEVER);

    fixture = TestBed.createComponent(ClientsListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.dataSource.data).toHaveLength(1);
    expect(fixture.componentInstance.dataSource.data[0].id).toBe('c1');
  });

  it('hours es undefined (skeleton) antes de que lleguen las horas', () => {
    clientsService.getAll.mockReturnValue(of([makeClient()]));
    clientsService.getSubscriptionHours.mockReturnValue(NEVER);

    fixture = TestBed.createComponent(ClientsListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.dataSource.data[0].hours).toBeUndefined();
  });

  it('mergea horas sin volver a llamar getAll', () => {
    const hours: ClientSubscriptionHours[] = [
      { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
    ];
    clientsService.getAll.mockReturnValue(of([makeClient()]));
    clientsService.getSubscriptionHours.mockReturnValue(of(hours));

    fixture = TestBed.createComponent(ClientsListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.dataSource.data[0].hours).toEqual(hours[0]);
    expect(clientsService.getAll).toHaveBeenCalledTimes(1);
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
```

- [ ] **Step 2: Ejecutar para verificar que falla**

```bash
cd frontend && npx jest clients-list.component.spec.ts --no-coverage
```

Esperado: FAIL — component no tiene los métodos ni la estructura nueva

- [ ] **Step 3: Reemplazar clients-list.component.ts**

```typescript
import { Component, DestroyRef, inject, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { ClientsService } from '../../../core/services/clients.service';
import { ClientSubscriptionHours, ClientWithHours } from '../../../core/models/client.models';

@Component({
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit, AfterViewInit {
  readonly dataSource = new MatTableDataSource<ClientWithHours>([]);
  readonly displayedColumns = ['name', 'hours'];
  quickFilter = '';
  loadError = false;

  @ViewChild(MatSort) sort!: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.clientsService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.dataSource.data = data
            .filter((c) => c.isActive)
            .map((c) => ({ ...c, hours: undefined }));
        },
        error: () => {
          this.loadError = true;
        },
      });

    this.clientsService.getSubscriptionHours()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (hoursData) => {
          const hoursMap = new Map(hoursData.map((h) => [h.clientId, h]));
          this.dataSource.data = this.dataSource.data.map((c) => ({
            ...c,
            hours: hoursMap.get(c.id),
          }));
        },
      });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  applyFilter(): void {
    this.dataSource.filter = this.quickFilter.trim().toLowerCase();
  }

  navigateToClient(id: string): void {
    this.router.navigate(['/clients', id]);
  }

  getHoursState(hours: ClientSubscriptionHours): 'ok' | 'warn' | 'crit' {
    if (hours.contracted === 0) return 'ok';
    const pct = hours.delivered / hours.contracted;
    if (pct >= 0.9) return 'crit';
    if (pct >= 0.7) return 'warn';
    return 'ok';
  }

  getHoursPct(hours: ClientSubscriptionHours): number {
    if (hours.contracted === 0) return 0;
    return Math.min(100, Math.round((hours.delivered / hours.contracted) * 100));
  }
}
```

- [ ] **Step 4: Reemplazar clients-list.component.html**

```html
<div class="page">
  <div class="page-header">
    <div class="page-header__search">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
        <mat-label>Buscar</mat-label>
        <input matInput [(ngModel)]="quickFilter" (ngModelChange)="applyFilter()" placeholder="Nombre de cliente...">
      </mat-form-field>
    </div>
    <div>
      <h1 class="page-header__title">Clientes</h1>
      <span class="page-header__count">{{ dataSource.data.length }} clientes activos</span>
    </div>
  </div>

  <div *ngIf="loadError" class="error-banner">
    Error al cargar los clientes. Intentá recargar la página.
  </div>

  <div class="surface-card clients-table">
    <table mat-table [dataSource]="dataSource" matSort matSortActive="name" matSortDirection="asc" style="width:100%">

      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Cliente</th>
        <td mat-cell *matCellDef="let row" class="client-name" (click)="navigateToClient(row.id)">
          {{ row.name }}
        </td>
      </ng-container>

      <ng-container matColumnDef="hours">
        <th mat-header-cell *matHeaderCellDef>Horas del mes</th>
        <td mat-cell *matCellDef="let row">

          <ng-container *ngIf="row.hours; else skeleton">
            <ng-container *ngIf="row.hours.contracted > 0; else noData">
              <div class="hours-metrics">
                <div class="metric">
                  <span class="metric__value metric__value--neutral">{{ row.hours.contracted }}</span>
                  <span class="metric__label">Contratadas</span>
                </div>
                <div class="metric">
                  <span class="metric__value" [ngClass]="'metric__value--' + getHoursState(row.hours)">
                    {{ row.hours.delivered }}
                  </span>
                  <span class="metric__label">Usadas</span>
                </div>
                <div class="metric">
                  <span class="metric__value metric__value--hi">{{ row.hours.available }}</span>
                  <span class="metric__label">Disponibles</span>
                </div>
              </div>
              <div class="hours-bar">
                <div class="bar-track">
                  <div class="bar-fill" [ngClass]="'bar-fill--' + getHoursState(row.hours)"
                       [style.width.%]="getHoursPct(row.hours)">
                  </div>
                </div>
                <span class="bar-pct">{{ getHoursPct(row.hours) }}%</span>
              </div>
            </ng-container>
          </ng-container>

          <ng-template #noData>
            <span class="no-data">—</span>
          </ng-template>

          <ng-template #skeleton>
            <div class="hours-metrics">
              <div class="metric">
                <span class="skeleton sk-val"></span>
                <span class="metric__label">Contratadas</span>
              </div>
              <div class="metric">
                <span class="skeleton sk-val"></span>
                <span class="metric__label">Usadas</span>
              </div>
              <div class="metric">
                <span class="skeleton sk-val"></span>
                <span class="metric__label">Disponibles</span>
              </div>
            </div>
            <div class="hours-bar">
              <div class="bar-track"><span class="skeleton sk-bar"></span></div>
            </div>
          </ng-template>

        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      <tr class="mat-mdc-no-data-row" *matNoDataRow>
        <td [attr.colspan]="displayedColumns.length">Sin clientes</td>
      </tr>
    </table>
  </div>
</div>
```

- [ ] **Step 5: Reemplazar clients-list.component.scss**

```scss
.page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;

  &__title {
    font-size: 20px;
    font-weight: 600;
    color: var(--tx-hi);
    margin: 0 0 2px;
  }

  &__count {
    font-size: 11px;
    color: var(--tx-lo);
    font-family: var(--font-mono);
  }

  &__search {
    flex-shrink: 0;
  }
}

.search-field {
  width: 280px;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--crit-bg);
  border: 1px solid var(--crit-bd);
  border-radius: var(--radius-sm);
  color: var(--crit);
  font-size: 12px;
}

.clients-table {
  overflow: hidden;
}

.client-name {
  color: var(--accent);
  cursor: pointer;
}

// ── Hours cell ──────────────────────────────────────────

.hours-metrics {
  display: flex;
  gap: 24px;
  margin-bottom: 8px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric__value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;

  &--neutral { color: var(--tx-md); }
  &--hi      { color: var(--tx-hi); }
  &--ok      { color: var(--ok); }
  &--warn    { color: var(--warn); }
  &--crit    { color: var(--crit); }
}

.metric__label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--tx-lo);
}

.hours-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-track {
  flex: 1;
  height: 4px;
  background: var(--elevated);
  border-radius: 2px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 2px;

  &--ok   { background: var(--ok); }
  &--warn { background: var(--warn); }
  &--crit { background: var(--crit); }
}

.bar-pct {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--tx-lo);
  min-width: 32px;
  text-align: right;
}

.no-data {
  color: var(--tx-lo);
}

// ── Skeleton ─────────────────────────────────────────────

@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}

.skeleton {
  display: inline-block;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    var(--elevated) 25%,
    var(--hover)    50%,
    var(--elevated) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.4s infinite linear;
}

.sk-val { width: 36px; height: 14px; }
.sk-bar { width: 100%; height: 4px; display: block; }
```

- [ ] **Step 6: Ejecutar tests**

```bash
npx jest clients-list.component.spec.ts --no-coverage
```

Esperado: todos en PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/clients/clients-list/
git commit -m "feat(ui): columna horas de suscripción en tabla de clientes"
```

---

## Task 6: Verificación integrada

- [ ] **Step 1: Ejecutar suite completa de backend**

```bash
cd backend && npx jest --no-coverage
```

Esperado: todos en PASS, sin regresiones

- [ ] **Step 2: Ejecutar suite completa de frontend**

```bash
cd frontend && npx jest --no-coverage
```

Esperado: todos en PASS, sin regresiones

- [ ] **Step 3: Levantar la app y verificar visualmente**

```bash
# Terminal 1
cd backend && npm run start:dev

# Terminal 2
cd frontend && npm start
```

Verificar en el browser:
- La tabla de clientes muestra columna "Horas del mes"
- No aparece la columna "Dirección primaria"
- El buscador está a la izquierda
- Las filas muestran skeleton mientras llegan las horas de Odoo
- Al cargar, los valores y la barra de progreso aparecen con el color correcto según el umbral

- [ ] **Step 4: Commit final si hay ajustes menores**

```bash
git add -p
git commit -m "fix: ajustes visuales tras verificación integrada"
```
