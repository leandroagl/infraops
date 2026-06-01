# Clients List View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la vista de lista de clientes con búsqueda reactiva (Ag-Grid) en el sidebar de InfraOps, incluyendo la dirección primaria sincronizada desde InfraDoc.

**Architecture:** El sync existente de clientes se extiende para traer locations de InfraDoc en paralelo y guardar la dirección primaria en la entidad `Client`. El frontend agrega un módulo `/clients` lazy-loaded con una tabla Ag-Grid y un componente placeholder `/clients/:id`.

**Tech Stack:** NestJS + TypeORM (backend), Angular 19 + Ag-Grid 32 + Angular Material (frontend), Jest (tests backend), Jasmine + NO_ERRORS_SCHEMA (tests frontend).

---

## Mapa de archivos

**Backend — modificar:**
- `backend/src/clients/infradoc/infradoc.service.ts` — agregar `InfradocLocation` + `getLocations()`
- `backend/src/clients/infradoc/infradoc.service.spec.ts` — tests de `getLocations()`
- `backend/src/clients/client.entity.ts` — agregar campo `primaryAddress`
- `backend/src/clients/clients.service.ts` — sync usa locations, `hasChanged` recibe `newPrimaryAddress`
- `backend/src/clients/clients.service.spec.ts` — actualizar mocks + tests nuevos de primaryAddress

**Frontend — modificar:**
- `frontend/src/app/core/models/client.models.ts` — agregar `primaryAddress`
- `frontend/src/app/app-routing.module.ts` — agregar ruta `/clients`
- `frontend/src/app/core/shell/shell.component.ts` — agregar nav item + tipo `'clients'`
- `frontend/src/app/core/shell/shell.component.html` — agregar SVG icon de clients

**Frontend — crear:**
- `frontend/src/app/features/clients/clients-routing.module.ts`
- `frontend/src/app/features/clients/clients.module.ts`
- `frontend/src/app/features/clients/clients-list/clients-list.component.ts`
- `frontend/src/app/features/clients/clients-list/clients-list.component.html`
- `frontend/src/app/features/clients/clients-list/clients-list.component.scss`
- `frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts`
- `frontend/src/app/features/clients/client-detail/client-detail.component.ts`
- `frontend/src/app/features/clients/client-detail/client-detail.component.html`

---

## Task 1: `InfradocService.getLocations()` — TDD

**Files:**
- Modify: `backend/src/clients/infradoc/infradoc.service.spec.ts`
- Modify: `backend/src/clients/infradoc/infradoc.service.ts`

- [ ] **Step 1: Agregar helper y tests en el spec**

En `infradoc.service.spec.ts`, dentro del `describe('InfradocService')` existente, **después** del bloque `it` final, agregar:

```typescript
const makeRawLocation = (override: Record<string, unknown> = {}) => ({
  location_id: '1',
  location_client_id: '10',
  location_address: 'Av. Corrientes 1234',
  location_city: 'Buenos Aires',
  location_primary: '1',
  ...override,
});

describe('getLocations', () => {
  it('mapea los campos de InfraDoc al formato InfradocLocation', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 1, data: [makeRawLocation()] })),
    );

    const result = await service.getLocations();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      infradocClientId: 10,
      address: 'Av. Corrientes 1234',
      city: 'Buenos Aires',
      isPrimary: true,
    });
  });

  it('mapea location_primary "0" a isPrimary false', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 1, data: [makeRawLocation({ location_primary: '0' })] })),
    );

    const result = await service.getLocations();

    expect(result[0].isPrimary).toBe(false);
  });

  it('lanza ServiceUnavailableException cuando InfraDoc devuelve success False', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'False', message: 'Auth failed' })),
    );

    await expect(service.getLocations()).rejects.toThrow(ServiceUnavailableException);
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan**

```
cd backend && npx jest infradoc.service.spec --no-coverage
```

Esperado: 3 fallos con `service.getLocations is not a function`.

- [ ] **Step 3: Implementar `InfradocLocation` + `getLocations()` en `infradoc.service.ts`**

Agregar la interfaz **antes** de la clase `InfradocService`:

```typescript
export interface InfradocLocation {
  infradocClientId: number;
  address: string | null;
  city: string | null;
  isPrimary: boolean;
}
```

Agregar dentro de la clase, **después** de `getClients()`:

```typescript
async getLocations(): Promise<InfradocLocation[]> {
  const url = `${process.env.INFRADOC_URL}/api/v1/locations/read.php`;
  const response = await firstValueFrom(
    this.httpService.get(url, {
      params: { api_key: process.env.INFRADOC_API_KEY, limit: 200 },
    }),
  );

  if (response.data.success !== 'True') {
    throw new ServiceUnavailableException(
      `InfraDoc API error: ${response.data.message}`,
    );
  }

  return (response.data.data as Record<string, unknown>[]).map((raw) =>
    this.mapLocation(raw),
  );
}

private mapLocation(raw: Record<string, unknown>): InfradocLocation {
  return {
    infradocClientId: Number(raw.location_client_id),
    address: (raw.location_address as string) ?? null,
    city: (raw.location_city as string) ?? null,
    isPrimary: raw.location_primary === '1' || raw.location_primary === 1,
  };
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```
cd backend && npx jest infradoc.service.spec --no-coverage
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Commit**

```
git add backend/src/clients/infradoc/infradoc.service.ts backend/src/clients/infradoc/infradoc.service.spec.ts
git commit -m "feat(clients): agregar InfradocLocation e InfradocService.getLocations()"
```

---

## Task 2: Entidad `Client` — campo `primaryAddress`

**Files:**
- Modify: `backend/src/clients/client.entity.ts`

> `synchronize` está activo en dev (`synchronize: process.env.NODE_ENV !== 'production'`), por lo que TypeORM aplica el cambio automáticamente al levantar el servidor. No se requiere archivo de migración en desarrollo.

- [ ] **Step 1: Agregar el campo en la entidad**

En `backend/src/clients/client.entity.ts`, agregar el campo **después** de `isLead`:

```typescript
@Column({ type: 'varchar', length: 500, nullable: true })
primaryAddress: string | null;
```

- [ ] **Step 2: Verificar compilación**

```
cd backend && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```
git add backend/src/clients/client.entity.ts
git commit -m "feat(clients): agregar primaryAddress a entidad Client"
```

---

## Task 3: `ClientsService.syncWithInfradoc()` — integración con locations (TDD)

**Files:**
- Modify: `backend/src/clients/clients.service.spec.ts`
- Modify: `backend/src/clients/clients.service.ts`

- [ ] **Step 1: Actualizar el spec — mocks y tests nuevos**

En `clients.service.spec.ts`:

**3a) Actualizar `makeLocal`** — agregar `primaryAddress: null`:

```typescript
const makeLocal = (override: Partial<Client> = {}): Client => ({
  id: 'uuid-1',
  infradocId: 1,
  name: 'ACME Corp',
  abbreviation: 'ACME',
  type: 'Empresa',
  website: 'acme.com',
  referral: null,
  rate: null,
  currencyCode: null,
  netTerms: null,
  taxIdNumber: null,
  isLead: false,
  notes: null,
  isActive: true,
  primaryAddress: null,
  lastSyncedAt: null,
  createdAt: new Date('2026-01-01'),
  ...override,
});
```

**3b) Actualizar el mock de `infradocService`** en `beforeEach`:

```typescript
infradocService = {
  getClients: jest.fn(),
  getLocations: jest.fn().mockResolvedValue([]),
};
```

**3c) Agregar al import** al inicio del spec:

```typescript
import { InfradocClient, InfradocLocation, InfradocService } from './infradoc/infradoc.service';
```

**3d) Agregar los tests nuevos** dentro del `describe('syncWithInfradoc')` existente:

```typescript
it('guarda primaryAddress cuando existe primary location para el cliente', async () => {
  const location: InfradocLocation = {
    infradocClientId: 1,
    address: 'Av. Corrientes 1234',
    city: 'Buenos Aires',
    isPrimary: true,
  };
  infradocService.getClients.mockResolvedValue([makeRemote()]);
  infradocService.getLocations.mockResolvedValue([location]);
  clientRepository.find.mockResolvedValue([]);

  await service.syncWithInfradoc();

  expect(clientRepository.save).toHaveBeenCalledWith(
    expect.objectContaining({ primaryAddress: 'Av. Corrientes 1234, Buenos Aires' }),
  );
});

it('guarda primaryAddress null cuando no hay primary location para el cliente', async () => {
  const location: InfradocLocation = {
    infradocClientId: 99,  // otro cliente
    address: 'Otra calle',
    city: 'Rosario',
    isPrimary: true,
  };
  infradocService.getClients.mockResolvedValue([makeRemote()]);
  infradocService.getLocations.mockResolvedValue([location]);
  clientRepository.find.mockResolvedValue([]);

  await service.syncWithInfradoc();

  expect(clientRepository.save).toHaveBeenCalledWith(
    expect.objectContaining({ primaryAddress: null }),
  );
});

it('detecta cambio de primaryAddress y actualiza el cliente', async () => {
  const location: InfradocLocation = {
    infradocClientId: 1,
    address: 'Av. Nueva 999',
    city: 'Córdoba',
    isPrimary: true,
  };
  // Cliente local sin dirección
  clientRepository.find.mockResolvedValue([makeLocal({ primaryAddress: null })]);
  infradocService.getClients.mockResolvedValue([makeRemote()]);
  infradocService.getLocations.mockResolvedValue([location]);

  const result = await service.syncWithInfradoc();

  expect(clientRepository.update).toHaveBeenCalledWith(
    'uuid-1',
    expect.objectContaining({ primaryAddress: 'Av. Nueva 999, Córdoba' }),
  );
  expect(result.updated).toBe(1);
});
```

- [ ] **Step 2: Verificar que los nuevos tests fallan**

```
cd backend && npx jest clients.service.spec --no-coverage
```

Esperado: los 3 tests nuevos fallan; los existentes pasan.

- [ ] **Step 3: Actualizar `clients.service.ts`**

**3a) Actualizar el import** de `InfradocService`:

```typescript
import { InfradocClient, InfradocLocation, InfradocService } from './infradoc/infradoc.service';
```

**3b) Actualizar `syncWithInfradoc`** — reemplazar el bloque `Promise.all` y el loop principal:

```typescript
async syncWithInfradoc(skipCooldown = false): Promise<SyncResult> {
  if (!skipCooldown && this.lastSyncAt !== null) {
    const elapsed = Date.now() - this.lastSyncAt.getTime();
    if (elapsed < this.COOLDOWN_MS) {
      throw new HttpException(
        'Sync ejecutado recientemente. Intentá de nuevo en unos segundos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  const [infradocClients, localClients, infradocLocations] = await Promise.all([
    this.infradocService.getClients(),
    this.clientRepository.find(),
    this.infradocService.getLocations(),
  ]);

  const primaryAddressMap = new Map<number, string>();
  for (const loc of infradocLocations) {
    if (loc.isPrimary) {
      const parts = [loc.address, loc.city].filter(Boolean) as string[];
      primaryAddressMap.set(loc.infradocClientId, parts.join(', '));
    }
  }

  const localByInfradocId = new Map(localClients.map((c) => [c.infradocId, c]));
  const infradocIds = new Set(infradocClients.map((c) => c.infradocId));

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const remote of infradocClients) {
    const local = localByInfradocId.get(remote.infradocId);
    const newPrimaryAddress = primaryAddressMap.get(remote.infradocId) ?? null;

    if (!local) {
      await this.clientRepository.save(
        this.clientRepository.create({
          ...remote,
          lastSyncedAt: new Date(),
          primaryAddress: newPrimaryAddress,
        }),
      );
      created++;
    } else if (this.hasChanged(local, remote, newPrimaryAddress)) {
      const { infradocId, ...fields } = remote;
      await this.clientRepository.update(local.id, {
        ...fields,
        lastSyncedAt: new Date(),
        primaryAddress: newPrimaryAddress,
      });
      updated++;
    } else {
      unchanged++;
    }
  }

  let archived = 0;
  for (const local of localClients) {
    if (!infradocIds.has(local.infradocId) && local.isActive) {
      await this.clientRepository.update(local.id, {
        isActive: false,
        lastSyncedAt: new Date(),
      });
      archived++;
    }
  }

  const syncedAt = new Date();
  this.lastSyncAt = syncedAt;

  return { created, updated, archived, unchanged, syncedAt };
}
```

**3c) Actualizar `hasChanged`** para recibir y comparar `newPrimaryAddress`:

```typescript
private hasChanged(
  local: Client,
  remote: InfradocClient,
  newPrimaryAddress: string | null,
): boolean {
  return (
    local.name !== remote.name ||
    local.abbreviation !== remote.abbreviation ||
    local.type !== remote.type ||
    local.website !== remote.website ||
    local.referral !== remote.referral ||
    local.rate !== remote.rate ||
    local.currencyCode !== remote.currencyCode ||
    local.netTerms !== remote.netTerms ||
    local.taxIdNumber !== remote.taxIdNumber ||
    local.isLead !== remote.isLead ||
    local.notes !== remote.notes ||
    local.isActive !== remote.isActive ||
    local.primaryAddress !== newPrimaryAddress
  );
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```
cd backend && npx jest clients.service.spec --no-coverage
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Correr la suite completa del backend**

```
cd backend && npx jest --no-coverage
```

Esperado: sin fallos.

- [ ] **Step 6: Commit**

```
git add backend/src/clients/clients.service.ts backend/src/clients/clients.service.spec.ts
git commit -m "feat(clients): sync incluye primaryAddress desde InfraDoc locations"
```

---

## Task 4: Frontend — modelo `Client` + routing

**Files:**
- Modify: `frontend/src/app/core/models/client.models.ts`
- Modify: `frontend/src/app/app-routing.module.ts`

- [ ] **Step 1: Actualizar el modelo `Client`**

Reemplazar el contenido de `frontend/src/app/core/models/client.models.ts`:

```typescript
export interface Client {
  id: string;
  name: string;
  primaryAddress: string | null;
  isActive: boolean;
  createdAt: string;
}
```

- [ ] **Step 2: Agregar la ruta `/clients` en `app-routing.module.ts`**

Dentro del array `children` del shell, agregar **antes** de la ruta `tasks`:

```typescript
{
  path: 'clients',
  loadChildren: () =>
    import('./features/clients/clients.module').then(m => m.ClientsModule),
},
```

- [ ] **Step 3: Verificar compilación**

```
cd frontend && npx tsc --noEmit
```

Esperado: puede fallar por `ClientsModule` no existente aún — es esperado en este paso.

- [ ] **Step 4: Commit**

```
git add frontend/src/app/core/models/client.models.ts frontend/src/app/app-routing.module.ts
git commit -m "feat(clients): agregar primaryAddress al modelo Client y ruta /clients"
```

---

## Task 5: Frontend — `ClientsModule` + placeholder

**Files:**
- Create: `frontend/src/app/features/clients/client-detail/client-detail.component.ts`
- Create: `frontend/src/app/features/clients/client-detail/client-detail.component.html`
- Create: `frontend/src/app/features/clients/clients-routing.module.ts`
- Create: `frontend/src/app/features/clients/clients.module.ts`

- [ ] **Step 1: Crear `client-detail.component.ts`**

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
})
export class ClientDetailComponent {}
```

- [ ] **Step 2: Crear `client-detail.component.html`**

```html
<div class="card" style="margin: 24px;">
  <p class="tx-md">Vista de cliente — próximamente</p>
</div>
```

- [ ] **Step 3: Crear `clients-routing.module.ts`**

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';

const routes: Routes = [
  { path: '', component: ClientsListComponent },
  { path: ':id', component: ClientDetailComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ClientsRoutingModule {}
```

- [ ] **Step 4: Crear `clients.module.ts`**

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AgGridModule } from 'ag-grid-angular';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';

@NgModule({
  declarations: [ClientsListComponent, ClientDetailComponent],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    AgGridModule,
    ClientsRoutingModule,
  ],
})
export class ClientsModule {}
```

- [ ] **Step 5: Commit**

```
git add frontend/src/app/features/clients/
git commit -m "feat(clients): crear ClientsModule, routing y ClientDetailComponent placeholder"
```

---

## Task 6: `ClientsListComponent` — TDD

**Files:**
- Create: `frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts`
- Create: `frontend/src/app/features/clients/clients-list/clients-list.component.ts`
- Create: `frontend/src/app/features/clients/clients-list/clients-list.component.html`
- Create: `frontend/src/app/features/clients/clients-list/clients-list.component.scss`

- [ ] **Step 1: Crear el spec**

Crear `clients-list.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { CellClickedEvent } from 'ag-grid-community';
import { ClientsListComponent } from './clients-list.component';
import { ClientsService } from '../../../../core/services/clients.service';
import { Client } from '../../../../core/models/client.models';

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: '1',
  name: 'ACME Corp',
  primaryAddress: 'Av. Corrientes 1234, Buenos Aires',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('ClientsListComponent', () => {
  let component: ClientsListComponent;
  let fixture: ComponentFixture<ClientsListComponent>;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    clientsServiceSpy = jasmine.createSpyObj('ClientsService', ['getAll']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    clientsServiceSpy.getAll.and.returnValue(of([
      makeClient({ id: '1', name: 'ACME Corp', isActive: true }),
      makeClient({ id: '2', name: 'Archivado SA', isActive: false }),
    ]));

    await TestBed.configureTestingModule({
      declarations: [ClientsListComponent],
      providers: [
        { provide: ClientsService, useValue: clientsServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga solo clientes activos en ngOnInit', () => {
    expect(component.clients.length).toBe(1);
    expect(component.clients[0].name).toBe('ACME Corp');
  });

  it('navega a /clients/:id al hacer click en la columna nombre', () => {
    component.onCellClicked({
      colDef: { field: 'name' },
      data: { id: '1' },
    } as CellClickedEvent);

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients', '1']);
  });

  it('no navega al hacer click en la columna dirección', () => {
    component.onCellClicked({
      colDef: { field: 'primaryAddress' },
      data: { id: '1' },
    } as CellClickedEvent);

    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('expone columnDefs con los campos name y primaryAddress', () => {
    const fields = component.columnDefs.map(c => c.field);
    expect(fields).toContain('name');
    expect(fields).toContain('primaryAddress');
  });
});
```

- [ ] **Step 2: Verificar que el spec falla**

```
cd frontend && npx ng test --include="**/clients-list.component.spec.ts" --watch=false
```

Esperado: error de compilación — `ClientsListComponent` no existe.

- [ ] **Step 3: Crear `clients-list.component.ts`**

```typescript
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ColDef, CellClickedEvent, ValueFormatterParams } from 'ag-grid-community';
import { ClientsService } from '../../../../core/services/clients.service';
import { Client } from '../../../../core/models/client.models';

@Component({
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  clients: Client[] = [];
  quickFilter = '';

  readonly columnDefs: ColDef[] = [
    {
      field: 'name',
      headerName: 'Cliente',
      flex: 1,
      sort: 'asc',
      cellStyle: { color: 'var(--accent)', cursor: 'pointer' },
    },
    {
      field: 'primaryAddress',
      headerName: 'Dirección primaria',
      flex: 2,
      valueFormatter: (p: ValueFormatterParams) => p.value ?? '—',
    },
  ];

  constructor(
    private readonly clientsService: ClientsService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.clientsService.getAll().subscribe({
      next: (data) => {
        this.clients = data.filter((c) => c.isActive);
      },
    });
  }

  onCellClicked(event: CellClickedEvent): void {
    if (event.colDef.field === 'name') {
      this.router.navigate(['/clients', event.data.id]);
    }
  }
}
```

- [ ] **Step 4: Crear `clients-list.component.html`**

```html
<div class="clients-page">
  <div class="clients-page__header">
    <span class="section-label">Clientes</span>
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
      <mat-label>Buscar</mat-label>
      <input matInput [(ngModel)]="quickFilter" placeholder="Nombre o dirección...">
    </mat-form-field>
  </div>

  <div class="clients-page__grid ag-theme-alpine-dark">
    <ag-grid-angular
      [rowData]="clients"
      [columnDefs]="columnDefs"
      [quickFilterText]="quickFilter"
      (cellClicked)="onCellClicked($event)">
    </ag-grid-angular>
  </div>
</div>
```

- [ ] **Step 5: Crear `clients-list.component.scss`**

```scss
.clients-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  gap: 14px;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__grid {
    flex: 1;
    min-height: 0;

    ag-grid-angular {
      width: 100%;
      height: 100%;
    }
  }
}

.section-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

.search-field {
  width: 280px;
}
```

- [ ] **Step 6: Verificar que los tests pasan**

```
cd frontend && npx ng test --include="**/clients-list.component.spec.ts" --watch=false
```

Esperado: 4 tests pasan.

- [ ] **Step 7: Verificar compilación completa**

```
cd frontend && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 8: Commit**

```
git add frontend/src/app/features/clients/clients-list/
git commit -m "feat(clients): agregar ClientsListComponent con Ag-Grid y búsqueda reactiva"
```

---

## Task 7: Shell — nav item Clientes

**Files:**
- Modify: `frontend/src/app/core/shell/shell.component.ts`
- Modify: `frontend/src/app/core/shell/shell.component.html`

- [ ] **Step 1: Actualizar `shell.component.ts`**

Reemplazar la interfaz `NavItem` y el array `navItems`:

```typescript
interface NavItem {
  route: string;
  label: string;
  icon: 'dashboard' | 'clients' | 'tasks' | 'admin';
}

readonly navItems: NavItem[] = [
  { route: '/dashboard', label: 'Dashboard',  icon: 'dashboard' },
  { route: '/clients',   label: 'Clientes',   icon: 'clients'   },
  { route: '/tasks',     label: 'Mis tareas', icon: 'tasks'     },
  { route: '/admin',     label: 'Admin',      icon: 'admin'     },
];
```

- [ ] **Step 2: Agregar el SVG en `shell.component.html`**

Dentro del `<a *ngFor="let item of navItems">`, agregar **después** del bloque `tasks icon` y **antes** del bloque `admin icon`:

```html
<!-- clients icon -->
<svg *ngIf="item.icon === 'clients'" viewBox="0 0 24 24"
     style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
  <circle cx="9" cy="7" r="4"/>
  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
</svg>
```

- [ ] **Step 3: Verificar compilación**

```
cd frontend && npx tsc --noEmit
```

Esperado: sin errores.

- [ ] **Step 4: Correr la suite completa del frontend**

```
cd frontend && npx ng test --watch=false
```

Esperado: sin fallos en ningún spec.

- [ ] **Step 5: Commit**

```
git add frontend/src/app/core/shell/shell.component.ts frontend/src/app/core/shell/shell.component.html
git commit -m "feat(shell): agregar ítem de navegación Clientes en el sidebar"
```
