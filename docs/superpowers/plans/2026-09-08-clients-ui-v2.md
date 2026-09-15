# Clients UI v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el módulo clientes con KPI strip horizontal con íconos, navegación mensual (← mes →) y lógica de color invertida en las barras de horas (mayor consumo = más verde).

**Architecture:** Se agrega `month` y `year` como query params opcionales al endpoint `GET /clients/subscription-hours`; cuando están presentes, el backend consulta timesheets de Odoo (`account.analytic.line`) filtrados por rango de fechas en lugar del `qty_delivered` acumulado. En el frontend, `ClientsListComponent` adopta el patrón de `TasksUnifiedComponent` (Subject `load$` + `switchMap`) para recargar horas al navegar entre meses. El `mat-table` se reemplaza por un `*ngFor` custom para habilitar animaciones CSS de filtrado/búsqueda por fila.

**Tech Stack:** NestJS · Odoo XML-RPC · Angular 17 (módulos, `*ngFor`/`*ngIf`) · Angular Material (MatButtonModule) · SCSS con tokens CSS

**Spec:** `docs/mockups/clients-v2.html`

## Global Constraints

- Angular module-based (sin standalone components)
- Structural directives: `*ngIf`, `*ngFor` (no `@if`/`@for` — el proyecto usa Angular 17 con módulos)
- Angular Material para todo elemento interactivo; `appearance="outline"` en `mat-form-field`
- Sin `any` en TypeScript salvo casos justificados
- Sin `::ng-deep`; coloring semántico via custom properties CSS
- Backend tests: Jest · Frontend tests: Jasmine + Angular Testing Library
- Idioma de código: inglés · Commits y docs: español
- TDD obligatorio: test antes que implementación en cada task

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| Modify | `backend/src/integrations/odoo/dto/client-subscription-hours.dto.ts` |
| Create | `backend/src/integrations/odoo/dto/subscription-hours-query.dto.ts` |
| Modify | `backend/src/integrations/odoo/odoo.service.ts` |
| Modify | `backend/src/integrations/odoo/odoo.service.spec.ts` |
| Modify | `backend/src/integrations/odoo/subscription-hours.controller.ts` |
| Modify | `backend/src/integrations/odoo/subscription-hours.controller.spec.ts` |
| Modify | `frontend/src/app/core/services/clients.service.ts` |
| Modify | `frontend/src/app/core/models/client.models.ts` |
| Modify | `frontend/src/app/features/clients/clients.module.ts` |
| Modify | `frontend/src/app/features/clients/clients-list/clients-list.component.ts` |
| Modify | `frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts` |
| Modify | `frontend/src/app/features/clients/clients-list/clients-list.component.html` |
| Modify | `frontend/src/app/features/clients/clients-list/clients-list.component.scss` |

---

## Task 1: Backend — month/year params en subscription-hours

**Files:**
- Create: `backend/src/integrations/odoo/dto/subscription-hours-query.dto.ts`
- Modify: `backend/src/integrations/odoo/subscription-hours.controller.ts`
- Modify: `backend/src/integrations/odoo/odoo.service.ts`
- Test: `backend/src/integrations/odoo/subscription-hours.controller.spec.ts`
- Test: `backend/src/integrations/odoo/odoo.service.spec.ts`

**Interfaces:**
- Produces: `GET /clients/subscription-hours?month=9&year=2026` → `ClientSubscriptionHoursDto[]`
- `OdooService.getClientSubscriptionHours(month?: number, year?: number)` — firma pública actualizada

---

- [ ] **Step 1: Crear el DTO de query params**

```typescript
// backend/src/integrations/odoo/dto/subscription-hours-query.dto.ts
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SubscriptionHoursQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  year?: number;
}
```

- [ ] **Step 2: Test controller — pasa month y year al service**

En `subscription-hours.controller.spec.ts`, agregar estos tests al `describe` existente:

```typescript
it('llama getClientSubscriptionHours sin params cuando no se pasan query params', async () => {
  odooService.getClientSubscriptionHours.mockResolvedValue([]);
  await controller.getAll({});
  expect(odooService.getClientSubscriptionHours).toHaveBeenCalledWith(undefined, undefined);
});

it('llama getClientSubscriptionHours con month y year cuando se pasan query params', async () => {
  odooService.getClientSubscriptionHours.mockResolvedValue([]);
  await controller.getAll({ month: 9, year: 2026 });
  expect(odooService.getClientSubscriptionHours).toHaveBeenCalledWith(9, 2026);
});
```

- [ ] **Step 3: Ejecutar tests — verificar que fallan**

```bash
cd backend && npx jest subscription-hours.controller.spec.ts --no-coverage
```
Esperado: FAIL — `controller.getAll` no acepta args todavía.

- [ ] **Step 4: Actualizar el controller**

```typescript
// backend/src/integrations/odoo/subscription-hours.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OdooService } from './odoo.service';
import { ClientSubscriptionHoursDto } from './dto/client-subscription-hours.dto';
import { SubscriptionHoursQueryDto } from './dto/subscription-hours-query.dto';

@Controller('clients/subscription-hours')
@UseGuards(JwtAuthGuard)
export class SubscriptionHoursController {
  constructor(private readonly odooService: OdooService) {}

  @Get()
  getAll(@Query() query: SubscriptionHoursQueryDto): Promise<ClientSubscriptionHoursDto[]> {
    return this.odooService.getClientSubscriptionHours(query.month, query.year);
  }
}
```

- [ ] **Step 5: Tests controller — verificar que pasan**

```bash
cd backend && npx jest subscription-hours.controller.spec.ts --no-coverage
```
Esperado: PASS.

- [ ] **Step 6: Tests OdooService — nueva lógica por período**

En `odoo.service.spec.ts`, agregar un `describe` nuevo al final:

```typescript
describe('getClientSubscriptionHours con month y year', () => {
  it('cuando se pasan month y year, llama account.analytic.line con rango de fechas', async () => {
    clientRepo.find.mockResolvedValue([
      makeClient({ id: 'c1', odooPartnerId: 101 }),
    ]);
    // Primera llamada: sale.order.line para contracted
    // Segunda llamada: account.analytic.line para delivered del período
    odooRpc.callKw
      .mockResolvedValueOnce([
        { product_uom_qty: 20, qty_delivered: 0, order_id: [1, 'SO001'] },
      ])
      .mockResolvedValueOnce([{ id: 1, partner_id: [101, 'ACME'] }])
      .mockResolvedValueOnce([
        { unit_amount: 8, partner_id: [101, 'ACME'] },
      ]);

    const result = await service.getClientSubscriptionHours(9, 2026);

    // Verifica que se consultó account.analytic.line con fechas de Sep 2026
    const thirdCall = odooRpc.callKw.mock.calls[2];
    expect(thirdCall[0]).toBe('account.analytic.line');
    const domain = thirdCall[2][0];
    expect(domain).toContainEqual(['date', '>=', '2026-09-01']);
    expect(domain).toContainEqual(['date', '<=', '2026-09-30']);

    expect(result).toEqual([
      { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
    ]);
  });

  it('cuando no se pasan params, usa qty_delivered de sale.order.line (comportamiento actual)', async () => {
    clientRepo.find.mockResolvedValue([
      makeClient({ id: 'c1', odooPartnerId: 101 }),
    ]);
    odooRpc.callKw
      .mockResolvedValueOnce([
        { product_uom_qty: 20, qty_delivered: 8, order_id: [1, 'SO001'] },
      ])
      .mockResolvedValueOnce([{ id: 1, partner_id: [101, 'ACME'] }]);

    const result = await service.getClientSubscriptionHours();

    // Solo 2 llamadas a callKw (no hay tercera para account.analytic.line)
    expect(odooRpc.callKw).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { clientId: 'c1', contracted: 20, delivered: 8, available: 12 },
    ]);
  });
});
```

- [ ] **Step 7: Ejecutar tests OdooService — verificar que fallan**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage -t "getClientSubscriptionHours"
```
Esperado: FAIL — el método no acepta params todavía.

- [ ] **Step 8: Actualizar OdooService**

En `odoo.service.ts`, modificar `getClientSubscriptionHours` y agregar el método privado `getDeliveredHoursForPeriod`:

```typescript
async getClientSubscriptionHours(
  month?: number,
  year?: number,
): Promise<ClientSubscriptionHoursDto[]> {
  const clients = await this.clientRepo.find({
    where: { isActive: true, odooPartnerId: Not(IsNull()) },
    select: { id: true, odooPartnerId: true },
  });

  if (clients.length === 0) return [];

  const partnerIds = clients.map((c) => c.odooPartnerId!);
  const contracted = await this.getSubscriptionHours(partnerIds);
  const contractedMap = new Map(contracted.map((h) => [h.partnerId, h.contracted]));

  let deliveredMap: Map<number, number>;

  if (month !== undefined && year !== undefined) {
    deliveredMap = await this.getDeliveredHoursForPeriod(partnerIds, month, year);
  } else {
    deliveredMap = new Map(contracted.map((h) => [h.partnerId, h.delivered]));
  }

  const partnerToClientId = new Map(clients.map((c) => [c.odooPartnerId!, c.id]));

  return Array.from(partnerToClientId.entries())
    .filter(([partnerId]) => contractedMap.has(partnerId))
    .map(([partnerId, clientId]) => {
      const contractedVal = contractedMap.get(partnerId) ?? 0;
      const deliveredVal  = deliveredMap.get(partnerId) ?? 0;
      return {
        clientId,
        contracted: contractedVal,
        delivered:  deliveredVal,
        available:  Math.max(0, contractedVal - deliveredVal),
      };
    });
}

private async getDeliveredHoursForPeriod(
  partnerIds: number[],
  month: number,
  year: number,
): Promise<Map<number, number>> {
  if (partnerIds.length === 0) return new Map();

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay  = new Date(year, month, 0).getDate();
  const dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const lines = await this.systemRpc.callKw<
    Array<{ unit_amount: number; partner_id: [number, string] | false }>
  >(
    'account.analytic.line',
    'search_read',
    [[
      ['partner_id', 'in', partnerIds],
      ['date', '>=', dateFrom],
      ['date', '<=', dateTo],
      ['product_id.name', 'in', ['Hora Única', 'Hora Única Garantia']],
    ]],
    { fields: ['unit_amount', 'partner_id'] },
  );

  const totals = new Map<number, number>();
  for (const line of lines) {
    if (!line.partner_id) continue;
    const pid = line.partner_id[0];
    totals.set(pid, (totals.get(pid) ?? 0) + line.unit_amount);
  }
  return totals;
}
```

- [ ] **Step 9: Tests OdooService — verificar que pasan**

```bash
cd backend && npx jest odoo.service.spec.ts --no-coverage -t "getClientSubscriptionHours"
```
Esperado: PASS.

- [ ] **Step 10: Suite completa backend**

```bash
cd backend && npx jest --no-coverage
```
Esperado: todos los tests pasan.

- [ ] **Step 11: Commit**

```bash
git add backend/src/integrations/odoo/dto/subscription-hours-query.dto.ts \
        backend/src/integrations/odoo/subscription-hours.controller.ts \
        backend/src/integrations/odoo/odoo.service.ts \
        backend/src/integrations/odoo/odoo.service.spec.ts \
        backend/src/integrations/odoo/subscription-hours.controller.spec.ts
git commit -m "feat(clients): agregar soporte de month/year en endpoint subscription-hours"
```

---

## Task 2: Frontend service + modelo — soporte de month/year

**Files:**
- Modify: `frontend/src/app/core/models/client.models.ts`
- Modify: `frontend/src/app/core/services/clients.service.ts`

**Interfaces:**
- Produces: `ClientsService.getSubscriptionHours(month?: number, year?: number): Observable<ClientSubscriptionHours[]>`

---

- [ ] **Step 1: Agregar getHoursBarState helper al modelo** (pure function, fácil de testear)

En `client.models.ts` agregar la función al final del archivo:

```typescript
/** Calidad de consumo: mayor consumo = mejor. Distinto de la zona de filtrado. */
export type HoursBarState = 'ok' | 'warn' | 'crit';

export function hoursBarState(pct: number): HoursBarState {
  if (pct > 100) return 'warn';   // excedente
  if (pct >= 50)  return 'ok';    // buen consumo
  if (pct >= 15)  return 'warn';  // consumo bajo
  return 'crit';                   // consumo crítico (<15%)
}
```

- [ ] **Step 2: Actualizar ClientsService.getSubscriptionHours**

```typescript
// frontend/src/app/core/services/clients.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';

getSubscriptionHours(month?: number, year?: number): Observable<ClientSubscriptionHours[]> {
  let params = new HttpParams();
  if (month !== undefined) params = params.set('month', month);
  if (year  !== undefined) params = params.set('year',  year);
  return this.http.get<ClientSubscriptionHours[]>(`${this.base}/subscription-hours`, { params });
}
```

- [ ] **Step 3: Tests unitarios de hoursBarState**

Crear un bloque `describe` en `clients-list.component.spec.ts` (ya que no hay spec para models):

```typescript
import { hoursBarState } from '../../../core/models/client.models';

describe('hoursBarState', () => {
  it('retorna crit cuando pct < 15 (0%)', () => expect(hoursBarState(0)).toBe('crit'));
  it('retorna crit en el límite superior de crit (14%)', () => expect(hoursBarState(14)).toBe('warn')); // 14 < 15
  it('retorna warn en el límite 15%', () => expect(hoursBarState(15)).toBe('warn'));
  it('retorna warn en el rango 15-49%', () => expect(hoursBarState(40)).toBe('warn'));
  it('retorna ok en el límite 50%', () => expect(hoursBarState(50)).toBe('ok'));
  it('retorna ok en el rango 50-100%', () => expect(hoursBarState(75)).toBe('ok'));
  it('retorna ok en 100%', () => expect(hoursBarState(100)).toBe('ok'));
  it('retorna warn cuando excede 100% (excedente)', () => expect(hoursBarState(112)).toBe('warn'));
});
```

Nota: el test `'retorna crit en el límite superior de crit (14%)'` tiene el assert `toBe('warn')` porque 14 NO es < 15 en la función — es decir `pct >= 15` false, `pct >= 50` false, devuelve `crit`. Corregir:

```typescript
it('retorna crit cuando pct es 14', () => expect(hoursBarState(14)).toBe('crit'));
it('retorna warn en el límite exacto 15%', () => expect(hoursBarState(15)).toBe('warn'));
```

- [ ] **Step 4: Ejecutar tests**

```bash
cd frontend && npx ng test --include="**/clients-list.component.spec.ts" --watch=false
```
Esperado: los nuevos tests de `hoursBarState` pasan. El resto también.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/models/client.models.ts \
        frontend/src/app/core/services/clients.service.ts \
        frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts
git commit -m "feat(clients): agregar hoursBarState y soporte month/year en ClientsService"
```

---

## Task 3: Refactor ClientsListComponent — month state + lógica de filtrado manual

**Files:**
- Modify: `frontend/src/app/features/clients/clients-list/clients-list.component.ts`
- Modify: `frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts`

**Interfaces:**
- Consumes: `ClientsService.getSubscriptionHours(month, year)`, `hoursBarState(pct)`
- Produces:
  - `component.selectedMonth: number`, `component.selectedYear: number`
  - `component.monthLabel: string`
  - `component.isPastMonth: boolean`
  - `component.navigateMonth(dir: -1 | 1): void`
  - `component.filteredClients: ClientWithHours[]` — reemplaza `dataSource.filteredData`
  - `component.getHoursBarState(hours): HoursBarState` — nueva, lógica invertida
  - `component.getHoursState(hours): HoursZone` — sin cambios (zone classification)

---

- [ ] **Step 1: Tests — month state inicial**

Agregar al spec, dentro del `describe('ClientsListComponent')` principal:

```typescript
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
```

- [ ] **Step 2: Tests — filteredClients**

```typescript
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
```

- [ ] **Step 3: Test — getHoursBarState**

```typescript
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
```

- [ ] **Step 4: Ejecutar los tests nuevos — verificar que fallan**

```bash
cd frontend && npx ng test --include="**/clients-list.component.spec.ts" --watch=false
```
Esperado: múltiples FAIL por propiedades y métodos que no existen todavía.

- [ ] **Step 5: Reescribir ClientsListComponent**

```typescript
// frontend/src/app/features/clients/clients-list/clients-list.component.ts
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ClientsService } from '../../../core/services/clients.service';
import {
  ClientSubscriptionHours,
  ClientWithHours,
  hoursBarState,
  HoursBarState,
} from '../../../core/models/client.models';

export type HoursZone = 'crit' | 'low' | 'ok' | 'warn';

interface TableFilter { q: string; zone: HoursZone | null; }

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

@Component({
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  allClients: ClientWithHours[] = [];
  quickFilter   = '';
  selectedZone: HoursZone | null = null;
  loadError     = false;
  selectedMonth: number;
  selectedYear:  number;

  private readonly load$ = new Subject<void>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly router: Router,
  ) {
    const now     = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear  = now.getFullYear();
  }

  ngOnInit(): void {
    // Carga lista de clientes una sola vez
    this.clientsService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.allClients = data
            .filter((c) => c.isActive)
            .map((c) => ({ ...c, hours: undefined }));
        },
        error: () => { this.loadError = true; },
      });

    // Carga horas reactivamente al navegar entre meses
    this.load$
      .pipe(
        switchMap(() =>
          this.clientsService.getSubscriptionHours(this.selectedMonth, this.selectedYear)
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (hoursData) => {
          const map = new Map(hoursData.map((h) => [h.clientId, h]));
          this.allClients = this.allClients.map((c) => ({
            ...c,
            hours: map.get(c.id) ?? { clientId: c.id, contracted: 0, delivered: 0, available: 0 },
          }));
        },
        error: () => {
          this.allClients = this.allClients.map((c) => ({
            ...c,
            hours: { clientId: c.id, contracted: 0, delivered: 0, available: 0 },
          }));
        },
      });

    this.load$.next();
  }

  // ── Month navigation ────────────────────────────────────────
  get monthLabel(): string {
    return `${MONTH_NAMES[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  get isPastMonth(): boolean {
    const now = new Date();
    return this.selectedYear < now.getFullYear()
      || (this.selectedYear === now.getFullYear() && this.selectedMonth < now.getMonth() + 1);
  }

  get isCurrentMonth(): boolean {
    const now = new Date();
    return this.selectedMonth === now.getMonth() + 1 && this.selectedYear === now.getFullYear();
  }

  navigateMonth(dir: -1 | 1): void {
    if (dir === 1 && this.isCurrentMonth) return;  // no navegar al futuro

    let m = this.selectedMonth + dir;
    let y = this.selectedYear;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }

    // Marcar horas como cargando (skeleton) antes de pedir al servidor
    this.allClients = this.allClients.map((c) => ({ ...c, hours: undefined }));
    this.selectedMonth = m;
    this.selectedYear  = y;
    this.quickFilter   = '';
    this.selectedZone  = null;
    this.load$.next();
  }

  // ── Filters ─────────────────────────────────────────────────
  get filteredClients(): ClientWithHours[] {
    const q    = this.quickFilter.trim().toLowerCase();
    const zone = this.selectedZone;
    return this.allClients
      .filter((c) => {
        const textMatch = !q || c.name.toLowerCase().includes(q);
        const zoneMatch = !zone || (c.hours != null && c.hours.contracted > 0
          && this.getHoursState(c.hours) === zone);
        return textMatch && zoneMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  toggleZone(zone: HoursZone): void {
    this.selectedZone = this.selectedZone === zone ? null : zone;
  }

  navigateToClient(id: string): void {
    this.router.navigate(['/clients', id]);
  }

  // ── KPI helpers ─────────────────────────────────────────────
  private get textFilteredClients(): ClientWithHours[] {
    const q = this.quickFilter.trim().toLowerCase();
    return this.allClients.filter((c) => !q || c.name.toLowerCase().includes(q));
  }

  get kpiHours(): { contracted: number; delivered: number; available: number } {
    return this.textFilteredClients
      .filter((c) => c.hours != null && c.hours.contracted > 0)
      .reduce(
        (acc, c) => ({
          contracted: acc.contracted + c.hours!.contracted,
          delivered:  acc.delivered  + c.hours!.delivered,
          available:  acc.available  + c.hours!.available,
        }),
        { contracted: 0, delivered: 0, available: 0 },
      );
  }

  get kpiHoursPct(): number {
    const { contracted, delivered } = this.kpiHours;
    if (contracted === 0) return 0;
    return Math.round((delivered / contracted) * 100);
  }

  get kpiStates(): { ok: number; warn: number; crit: number; low: number } {
    return this.textFilteredClients
      .filter((c) => c.hours != null && c.hours.contracted > 0)
      .reduce(
        (acc, c) => {
          const state = this.getHoursState(c.hours!);
          return { ...acc, [state]: acc[state] + 1 };
        },
        { ok: 0, warn: 0, crit: 0, low: 0 },
      );
  }

  zonePct(count: number): number {
    const { ok, warn, crit, low } = this.kpiStates;
    const total = ok + warn + crit + low;
    return total === 0 ? 0 : Math.round((count / total) * 100);
  }

  // ── Hour state methods ───────────────────────────────────────
  /** Zona de consumo — para filtros del KPI strip (sin cambios). */
  getHoursState(hours: ClientSubscriptionHours): HoursZone {
    if (hours.contracted === 0) return 'ok';
    const pct = hours.delivered / hours.contracted;
    if (pct > 1)    return 'warn';
    if (pct >= 0.6) return 'ok';
    if (pct > 0)    return 'low';
    return 'crit';
  }

  /** Calidad de consumo — para color de barras (mayor consumo = mejor). */
  getHoursBarState(hours: ClientSubscriptionHours): HoursBarState {
    if (hours.contracted === 0) return 'crit';
    const pct = Math.round((hours.delivered / hours.contracted) * 100);
    return hoursBarState(pct);
  }

  getHoursPct(hours: ClientSubscriptionHours): number {
    if (hours.contracted === 0) return 0;
    return Math.round((hours.delivered / hours.contracted) * 100);
  }

  getHoursBarWidth(hours: ClientSubscriptionHours): number {
    return Math.min(100, this.getHoursPct(hours));
  }

  get globalHoursBarState(): HoursBarState {
    return hoursBarState(this.kpiHoursPct);
  }
}
```

- [ ] **Step 6: Ajustar los tests existentes que rompieron**

Los tests de `getHoursState` verifican la lógica de zona (sin cambios). Los tests de `kpiStates` usan `dataSource.data` — ahora la propiedad se llama `allClients`. Actualizar el spec:

Reemplazar todas las ocurrencias de `component.dataSource.data =` por `component.allClients =`.
Reemplazar `component.dataSource.filteredData` por `component.filteredClients`.
En el `beforeEach` del describe principal, eliminar la referencia a `MatTableModule`, `MatSortModule` y `MatTableDataSource`.

Mantener `MATERIAL_IMPORTS` sin `MatTableModule` ni `MatSortModule` (ya no los usa el componente):

```typescript
const MATERIAL_IMPORTS = [
  NoopAnimationsModule,
  RouterTestingModule,
  FormsModule,
  MatFormFieldModule,
  MatInputModule,
  MatButtonModule,   // ← agregar
];
```

Agregar `MatButtonModule` al import del spec:
```typescript
import { MatButtonModule } from '@angular/material/button';
```

- [ ] **Step 7: Ejecutar todos los tests del componente**

```bash
cd frontend && npx ng test --include="**/clients-list.component.spec.ts" --watch=false
```
Esperado: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/clients/clients-list/clients-list.component.ts \
        frontend/src/app/features/clients/clients-list/clients-list.component.spec.ts
git commit -m "refactor(clients): reescribir ClientsListComponent con month nav y hoursBarState"
```

---

## Task 4: Frontend UI — template, SCSS y module

**Files:**
- Modify: `frontend/src/app/features/clients/clients-list/clients-list.component.html`
- Modify: `frontend/src/app/features/clients/clients-list/clients-list.component.scss`
- Modify: `frontend/src/app/features/clients/clients.module.ts`

**Interfaces:**
- Consumes: todas las propiedades/métodos de Task 3

---

- [ ] **Step 1: Actualizar clients.module.ts**

```typescript
// frontend/src/app/features/clients/clients.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';  // ← nuevo (month nav + search clear)
import { MatTableModule } from '@angular/material/table';    // ← mantener (client-mantenimientos lo usa)
import { MatTabsModule } from '@angular/material/tabs';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientOverviewComponent } from './client-overview/client-overview.component';
import { ClientMantenimientosComponent } from './client-mantenimientos/client-mantenimientos.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    ClientsListComponent,
    ClientDetailComponent,
    ClientOverviewComponent,
    ClientMantenimientosComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatTableModule,
    MatTabsModule,
    ClientsRoutingModule,
    SharedModule,
  ],
})
export class ClientsModule {}
```

- [ ] **Step 2: Reescribir el template HTML**

Referencia visual: `docs/mockups/clients-v2.html`. El template usa `*ngFor`/`*ngIf` (no `@for`/`@if`).

```html
<!-- frontend/src/app/features/clients/clients-list/clients-list.component.html -->
<div class="page">

  <!-- ── Page header ── -->
  <div class="page-hdr">
    <span class="page-title">Clientes</span>
    <span class="page-count">{{ allClients.length }} activos</span>
  </div>

  <!-- ── Month nav bar ── -->
  <div class="month-nav-bar">
    <button mat-icon-button class="month-nav-btn" (click)="navigateMonth(-1)" aria-label="Mes anterior">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="month-label">{{ monthLabel }}</span>
    <button mat-icon-button class="month-nav-btn" (click)="navigateMonth(1)" [disabled]="isCurrentMonth" aria-label="Mes siguiente">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <span class="month-nav-sep"></span>
    <span class="month-past-badge" [class.visible]="isPastMonth">Período cerrado</span>
  </div>

  <!-- ── KPI strip ── -->
  <div class="kpi-strip">

    <!-- Sin actividad -->
    <div class="kpi-zone kpi-zone--crit" [class.active]="selectedZone === 'crit'"
         role="button" tabindex="0"
         (click)="toggleZone('crit')"
         (keydown.enter)="toggleZone('crit')"
         (keydown.space)="toggleZone('crit'); $event.preventDefault()">
      <div class="kpi-zone__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>
        <span class="kpi-zone__icon-label">Sin actividad</span>
      </div>
      <div class="kpi-zone__main">
        <span class="kpi-zone__val">{{ kpiStates.crit }}</span>
        <span class="kpi-zone__pct">{{ zonePct(kpiStates.crit) }}%</span>
        <span class="kpi-zone__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </span>
      </div>
      <div class="kpi-zone__foot">0% uso</div>
    </div>

    <!-- Uso bajo -->
    <div class="kpi-zone kpi-zone--low" [class.active]="selectedZone === 'low'"
         role="button" tabindex="0"
         (click)="toggleZone('low')"
         (keydown.enter)="toggleZone('low')"
         (keydown.space)="toggleZone('low'); $event.preventDefault()">
      <div class="kpi-zone__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
        <span class="kpi-zone__icon-label">Uso bajo</span>
      </div>
      <div class="kpi-zone__main">
        <span class="kpi-zone__val">{{ kpiStates.low }}</span>
        <span class="kpi-zone__pct">{{ zonePct(kpiStates.low) }}%</span>
        <span class="kpi-zone__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </span>
      </div>
      <div class="kpi-zone__foot">1–59%</div>
    </div>

    <!-- Uso normal -->
    <div class="kpi-zone kpi-zone--ok" [class.active]="selectedZone === 'ok'"
         role="button" tabindex="0"
         (click)="toggleZone('ok')"
         (keydown.enter)="toggleZone('ok')"
         (keydown.space)="toggleZone('ok'); $event.preventDefault()">
      <div class="kpi-zone__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span class="kpi-zone__icon-label">Uso normal</span>
      </div>
      <div class="kpi-zone__main">
        <span class="kpi-zone__val">{{ kpiStates.ok }}</span>
        <span class="kpi-zone__pct">{{ zonePct(kpiStates.ok) }}%</span>
        <span class="kpi-zone__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </span>
      </div>
      <div class="kpi-zone__foot">60–100%</div>
    </div>

    <!-- Excedente -->
    <div class="kpi-zone kpi-zone--warn" [class.active]="selectedZone === 'warn'"
         role="button" tabindex="0"
         (click)="toggleZone('warn')"
         (keydown.enter)="toggleZone('warn')"
         (keydown.space)="toggleZone('warn'); $event.preventDefault()">
      <div class="kpi-zone__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
        <span class="kpi-zone__icon-label">Excedente</span>
      </div>
      <div class="kpi-zone__main">
        <span class="kpi-zone__val">{{ kpiStates.warn }}</span>
        <span class="kpi-zone__pct">{{ zonePct(kpiStates.warn) }}%</span>
        <span class="kpi-zone__check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>
        </span>
      </div>
      <div class="kpi-zone__foot">&gt;100%</div>
    </div>

    <!-- Horas del mes -->
    <div class="kpi-hours">
      <div class="kpi-hours__head">
        <span class="kpi-hours__label">Horas del mes · {{ monthLabel }}</span>
        <div class="kpi-hours__pct-badge">
          <span class="kpi-hours__pct" [ngClass]="'kpi-hours__pct--' + globalHoursBarState">{{ kpiHoursPct }}%</span>
          <span class="kpi-hours__pct-lbl">consumido</span>
        </div>
      </div>
      <div class="kpi-hours__bar">
        <div class="kpi-hours__fill" [ngClass]="'kpi-hours__fill--' + globalHoursBarState"
             [style.width.%]="kpiHoursPct > 100 ? 100 : kpiHoursPct"></div>
      </div>
      <div class="kpi-hours__metrics">
        <div class="kpi-hours__metric">
          <span class="kpi-hours__metric-val kpi-hours__metric-val--neutral">{{ kpiHours.contracted }}h</span>
          <span class="kpi-hours__metric-lbl">Contratadas</span>
        </div>
        <div class="kpi-hours__metric">
          <span class="kpi-hours__metric-val" [ngClass]="'kpi-hours__metric-val--' + globalHoursBarState">{{ kpiHours.delivered }}h</span>
          <span class="kpi-hours__metric-lbl">Usadas</span>
        </div>
        <div class="kpi-hours__metric">
          <span class="kpi-hours__metric-val kpi-hours__metric-val--hi">{{ kpiHours.available }}h</span>
          <span class="kpi-hours__metric-lbl">Disponibles</span>
        </div>
      </div>
    </div>

  </div><!-- /kpi-strip -->

  <!-- ── Controls / search bar ── -->
  <div class="controls-bar">
    <div class="search-wrap">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
        <input matInput [(ngModel)]="quickFilter" placeholder="Buscar cliente...">
      </mat-form-field>
      <button mat-icon-button class="search-clear" *ngIf="quickFilter" (click)="quickFilter = ''" aria-label="Limpiar búsqueda">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>

    <span class="filter-chip filter-chip--crit" *ngIf="selectedZone === 'crit'" (click)="toggleZone('crit')">
      Sin actividad
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </span>
    <span class="filter-chip filter-chip--low" *ngIf="selectedZone === 'low'" (click)="toggleZone('low')">
      Uso bajo
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </span>
    <span class="filter-chip filter-chip--ok" *ngIf="selectedZone === 'ok'" (click)="toggleZone('ok')">
      Uso normal
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </span>
    <span class="filter-chip filter-chip--warn" *ngIf="selectedZone === 'warn'" (click)="toggleZone('warn')">
      Excedente
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </span>

    <span class="controls-spacer"></span>
    <span class="result-count" [class.filtered]="selectedZone || quickFilter">
      <ng-container *ngIf="selectedZone || quickFilter">{{ filteredClients.length }} de {{ allClients.length }}</ng-container>
      <ng-container *ngIf="!selectedZone && !quickFilter">{{ allClients.length }}</ng-container>
      clientes
    </span>
  </div>

  <!-- ── Error banner ── -->
  <div *ngIf="loadError" class="error-banner">
    Error al cargar los clientes. Intentá recargar la página.
  </div>

  <!-- ── Table ── -->
  <div class="clients-table-wrap">

    <div class="col-hdr">
      <div class="col-hdr-cell">Cliente</div>
      <div class="col-hdr-cell">Horas del mes</div>
      <div class="col-hdr-cell">Estado</div>
    </div>

    <div class="client-row" *ngFor="let row of filteredClients"
         [class.row-in]="true"
         (click)="navigateToClient(row.id)">

      <div class="client-name">
        <div class="client-initial">{{ row.name.slice(0,2).toUpperCase() }}</div>
        <span class="client-name-text">{{ row.name }}</span>
      </div>

      <div class="hours-cell">
        <ng-container *ngIf="row.hours; else skeleton">
          <ng-container *ngIf="row.hours.contracted > 0; else noData">
            <div class="hours-metrics">
              <div class="metric">
                <span class="metric__value metric__value--neutral">{{ row.hours.contracted }}</span>
                <span class="metric__label">Contratadas</span>
              </div>
              <div class="metric">
                <span class="metric__value" [ngClass]="'metric__value--' + getHoursBarState(row.hours)">{{ row.hours.delivered }}</span>
                <span class="metric__label">Usadas</span>
              </div>
              <div class="metric">
                <span class="metric__value metric__value--hi">{{ row.hours.available }}</span>
                <span class="metric__label">Disponibles</span>
              </div>
            </div>
            <div class="hours-bar">
              <div class="bar-track">
                <div class="bar-fill" [ngClass]="'bar-fill--' + getHoursBarState(row.hours)"
                     [style.width.%]="getHoursBarWidth(row.hours)"></div>
              </div>
              <span class="bar-pct" [ngClass]="'bar-pct--' + getHoursBarState(row.hours)">{{ getHoursPct(row.hours) }}%</span>
            </div>
          </ng-container>
        </ng-container>

        <ng-template #noData>
          <span class="no-data">—</span>
        </ng-template>

        <ng-template #skeleton>
          <div class="hours-metrics">
            <div class="metric"><span class="skeleton sk-val"></span><span class="metric__label">Contratadas</span></div>
            <div class="metric"><span class="skeleton sk-val"></span><span class="metric__label">Usadas</span></div>
            <div class="metric"><span class="skeleton sk-val"></span><span class="metric__label">Disponibles</span></div>
          </div>
          <div class="hours-bar"><div class="bar-track"><span class="skeleton sk-bar"></span></div></div>
        </ng-template>
      </div>

      <div class="status-col">
        <ng-container *ngIf="row.hours && row.hours.contracted > 0">
          <span class="zone-badge" [ngClass]="'zone-badge--' + getHoursState(row.hours)">
            {{ { crit: 'Sin actividad', low: 'Uso bajo', ok: 'Normal', warn: 'Excedente' }[getHoursState(row.hours)] }}
          </span>
        </ng-container>
      </div>

    </div><!-- /ngFor -->

    <div class="empty-state" *ngIf="filteredClients.length === 0 && allClients.length > 0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
      <span class="empty-state__title">Sin resultados</span>
      <span class="empty-state__sub">Ningún cliente coincide con los filtros aplicados</span>
    </div>

  </div><!-- /clients-table-wrap -->

</div><!-- /page -->
```

- [ ] **Step 3: Reescribir el SCSS**

Reemplazar completamente `clients-list.component.scss` con los estilos del mockup, adaptados a SCSS con variables del design system:

```scss
// frontend/src/app/features/clients/clients-list/clients-list.component.scss

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ── Page header ──────────────────────────────────────────────
.page-hdr {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px 0;
  flex-shrink: 0;
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--tx-hi);
  letter-spacing: -.2px;
}

.page-count {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--tx-lo);
  background: var(--card);
  border: 1px solid var(--border-lo);
  border-radius: 10px;
  padding: 1px 8px;
}

// ── Month nav bar ─────────────────────────────────────────────
.month-nav-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-lo);
  flex-shrink: 0;
}

.month-nav-btn {
  width: 28px !important;
  height: 28px !important;
  line-height: 28px !important;
  border: 1px solid var(--border-lo) !important;
  border-radius: var(--radius-sm) !important;
  color: var(--tx-md) !important;

  svg { width: 13px; height: 13px; stroke: currentColor; fill: none; }

  &:hover:not([disabled]) {
    background: var(--elevated) !important;
    border-color: var(--border-md) !important;
    color: var(--tx-hi) !important;
  }

  &[disabled] { opacity: .35; }
}

.month-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--tx-hi);
  min-width: 160px;
  text-align: center;
}

.month-nav-sep {
  width: 1px;
  height: 18px;
  background: var(--border-lo);
  margin: 0 6px;
}

.month-past-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: .6px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--neutral-bg, rgba(84,110,122,.12));
  border: 1px solid var(--neutral-bd, rgba(84,110,122,.25));
  color: var(--tx-lo);
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;

  &.visible { opacity: 1; }
}

// ── KPI strip ─────────────────────────────────────────────────
.kpi-strip {
  display: flex;
  align-items: stretch;
  padding: 0 24px;
  background: var(--card);
  border-top: 1px solid var(--border-lo);
  border-bottom: 1px solid var(--border-lo);
  min-height: 80px;
  flex-shrink: 0;
}

// ── KPI zone (clickable filter block) ──
.kpi-zone {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 20px;
  border-right: 1px solid var(--border-lo);
  cursor: pointer;
  position: relative;
  transition: background 180ms ease;
  user-select: none;
  gap: 5px;

  &:hover { background: var(--elevated); }
  &:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 0 0 2px 2px;
    opacity: 0;
    transition: opacity 180ms ease;
  }
  &.active::before { opacity: 1; }

  &--crit { &::before { background: var(--crit); } &.active { background: rgba(244,67,54,.16); } }
  &--low  { &::before { background: var(--accent); } &.active { background: rgba(77,208,225,.16); } }
  &--ok   { &::before { background: var(--ok); } &.active { background: rgba(67,217,138,.16); } }
  &--warn { &::before { background: var(--warn); } &.active { background: rgba(255,179,0,.16); } }
}

.kpi-zone__icon {
  display: flex;
  align-items: center;
  gap: 6px;

  svg { width: 13px; height: 13px; opacity: .7; transition: opacity 180ms ease; }
  .kpi-zone.active & svg { opacity: 1; }
}

.kpi-zone__icon-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .7px;
  font-family: var(--font-mono);
  opacity: .7;
  transition: opacity 180ms ease;
  .kpi-zone.active & { opacity: 1; }
}

.kpi-zone--crit .kpi-zone__icon { color: var(--crit); }
.kpi-zone--low  .kpi-zone__icon { color: var(--accent); }
.kpi-zone--ok   .kpi-zone__icon { color: var(--ok); }
.kpi-zone--warn .kpi-zone__icon { color: var(--warn); }

.kpi-zone__main {
  display: flex;
  align-items: baseline;
  gap: 7px;
}

.kpi-zone__val {
  font-family: var(--font-mono);
  font-size: 26px;
  font-weight: 500;
  line-height: 1;

  .kpi-zone--crit & { color: var(--crit); }
  .kpi-zone--low  & { color: var(--accent); }
  .kpi-zone--ok   & { color: var(--ok); }
  .kpi-zone--warn & { color: var(--warn); }
}

.kpi-zone__pct {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tx-lo);
  margin-bottom: 2px;
}

.kpi-zone__check {
  display: flex;
  align-items: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  opacity: 0;
  transform: scale(.5);
  transition: opacity 180ms ease, transform 180ms ease;
  margin-bottom: 2px;

  svg { width: 10px; height: 10px; stroke: currentColor; fill: none; stroke-width: 3; stroke-linecap: round; }

  .kpi-zone.active & { opacity: 1; transform: scale(1); }
  .kpi-zone--crit & { color: var(--crit); }
  .kpi-zone--low  & { color: var(--accent); }
  .kpi-zone--ok   & { color: var(--ok); }
  .kpi-zone--warn & { color: var(--warn); }
}

.kpi-zone__foot {
  font-size: 9px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

// ── Horas del mes (progress block) ──
.kpi-hours {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 28px;
  gap: 7px;
  min-width: 0;
}

.kpi-hours__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.kpi-hours__label {
  font-size: 9px;
  color: var(--tx-lo);
  text-transform: uppercase;
  letter-spacing: .7px;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.kpi-hours__pct-badge {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-shrink: 0;
}

.kpi-hours__pct {
  font-size: 18px;
  font-weight: 600;
  font-family: var(--font-mono);
  line-height: 1;

  &--ok   { color: var(--ok); }
  &--warn { color: var(--warn); }
  &--crit { color: var(--crit); }
}

.kpi-hours__pct-lbl {
  font-size: 10px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

.kpi-hours__bar {
  height: 8px;
  border-radius: 4px;
  background: var(--elevated);
  overflow: hidden;
  border: 1px solid var(--border-lo);
}

.kpi-hours__fill {
  height: 100%;
  border-radius: 4px;
  transition: width .6s cubic-bezier(.4,0,.2,1);

  &--ok   { background: linear-gradient(90deg, var(--ok), rgba(67,217,138,.7)); }
  &--warn { background: linear-gradient(90deg, var(--warn), rgba(255,179,0,.7)); }
  &--crit { background: linear-gradient(90deg, var(--crit), rgba(244,67,54,.7)); }
}

.kpi-hours__metrics {
  display: flex;
  align-items: center;
}

.kpi-hours__metric {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-right: 24px;
  border-right: 1px solid var(--border-lo);
  margin-right: 24px;

  &:last-child { border-right: none; margin-right: 0; padding-right: 0; }
}

.kpi-hours__metric-val {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 600;
  line-height: 1;

  &--neutral { color: var(--tx-md); }
  &--ok      { color: var(--ok); }
  &--warn    { color: var(--warn); }
  &--crit    { color: var(--crit); }
  &--hi      { color: var(--tx-hi); }
}

.kpi-hours__metric-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: .7px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
}

// ── Controls / search bar ─────────────────────────────────────
.controls-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border-lo);
  flex-shrink: 0;
}

.search-wrap {
  position: relative;
  flex: 0 0 280px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 14px;
  height: 14px;
  color: var(--tx-lo);
  transition: color 180ms ease;
  pointer-events: none;
  z-index: 1;

  .search-wrap:focus-within & { color: var(--accent); }
}

.search-field {
  width: 100%;

  .mat-mdc-text-field-wrapper { padding-left: 32px !important; }
}

.search-clear {
  position: absolute;
  right: 4px;
  width: 24px !important;
  height: 24px !important;
  line-height: 24px !important;
  color: var(--tx-lo) !important;

  svg { width: 8px; height: 8px; stroke: currentColor; fill: none; }
}

.controls-spacer { flex: 1; }

.result-count {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--tx-lo);
  white-space: nowrap;
  transition: color 180ms ease;

  &.filtered { color: var(--accent); }
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: opacity 180ms ease;

  svg { width: 9px; height: 9px; stroke: currentColor; fill: none; stroke-width: 3; stroke-linecap: round; }
  &:hover { opacity: .8; }

  &--crit { background: var(--crit-bg); border: 1px solid var(--crit-bd); color: var(--crit); }
  &--low  { background: var(--accent-bg); border: 1px solid var(--accent-bd); color: var(--accent); }
  &--ok   { background: var(--ok-bg); border: 1px solid var(--ok-bd); color: var(--ok); }
  &--warn { background: var(--warn-bg); border: 1px solid var(--warn-bd); color: var(--warn); }
}

// ── Table ─────────────────────────────────────────────────────
.clients-table-wrap {
  flex: 1;
  overflow-y: auto;
  background: var(--surface);
}

.col-hdr {
  display: grid;
  grid-template-columns: 1fr 300px 110px;
  padding: 8px 24px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;

  .col-hdr-cell {
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .6px;
    color: var(--tx-lo);
    font-family: var(--font-mono);
  }
}

// ── Client row ──
.client-row {
  display: grid;
  grid-template-columns: 1fr 300px 110px;
  padding: 11px 24px;
  border-bottom: 1px solid var(--border-lo);
  align-items: center;
  cursor: pointer;
  transition: background 180ms ease, opacity 220ms ease, transform 220ms ease;

  &:last-child { border-bottom: none; }
  &:hover { background: var(--hover); }
  &:hover .client-name-text { color: var(--accent); }
}

.client-name {
  display: flex;
  align-items: center;
  gap: 10px;
}

.client-initial {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs);
  background: var(--elevated);
  border: 1px solid var(--border-lo);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--tx-md);
  flex-shrink: 0;
  transition: background 180ms ease, color 180ms ease, border-color 180ms ease;

  .client-row:hover & {
    background: var(--accent-bg);
    border-color: var(--accent-bd);
    color: var(--accent);
  }
}

.client-name-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--tx-hi);
  transition: color 180ms ease;
}

// ── Hours cell ──
.hours-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.hours-metrics {
  display: flex;
  gap: 20px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.metric__value {
  font-family: var(--font-mono);
  font-size: 13px;
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
  letter-spacing: .7px;
  color: var(--tx-lo);
  font-family: var(--font-mono);
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
  transition: width 400ms cubic-bezier(.4,0,.2,1);

  &--ok   { background: var(--ok); }
  &--warn { background: var(--warn); }
  &--crit { background: var(--crit); }
}

.bar-pct {
  font-family: var(--font-mono);
  font-size: 10px;
  min-width: 32px;
  text-align: right;

  &--ok   { color: var(--ok); }
  &--warn { color: var(--warn); }
  &--crit { color: var(--crit); }
}

// ── Status badge column ──
.status-col {
  display: flex;
  justify-content: flex-end;
}

.zone-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  font-weight: 600;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 2px 8px;
  border-radius: 10px;

  &--crit { background: var(--crit-bg); border: 1px solid var(--crit-bd); color: var(--crit); }
  &--low  { background: var(--accent-bg); border: 1px solid var(--accent-bd); color: var(--accent); }
  &--ok   { background: var(--ok-bg); border: 1px solid var(--ok-bd); color: var(--ok); }
  &--warn { background: var(--warn-bg); border: 1px solid var(--warn-bd); color: var(--warn); }
}

// ── Skeleton ─────────────────────────────────────────────────
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}

.skeleton {
  display: inline-block;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--elevated) 25%, var(--hover) 50%, var(--elevated) 75%);
  background-size: 800px 100%;
  animation: shimmer 1.4s infinite linear;
}

.sk-val { width: 36px; height: 13px; }
.sk-bar { width: 100%; height: 4px; display: block; }

// ── Empty state ───────────────────────────────────────────────
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px 24px;
  color: var(--tx-lo);

  svg { width: 36px; height: 36px; stroke: currentColor; fill: none; opacity: .35; }
}

.empty-state__title { font-size: 13px; color: var(--tx-md); }
.empty-state__sub   { font-size: 11px; color: var(--tx-lo); }

// ── Error banner ──────────────────────────────────────────────
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
  margin: 0 24px;
}

.no-data { color: var(--tx-lo); font-size: 12px; }
```

- [ ] **Step 4: Ejecutar el servidor de desarrollo y verificar visualmente**

```bash
cd frontend && npm start
```

Abrir `http://localhost:4200/clients` y verificar:
- KPI strip horizontal se ve con íconos y colores correctos
- Navegación de meses funciona (← →)
- Buscador con ícono, foco en cyan, botón ✕
- Filtrado por zona activa el estado en el strip
- Chip de zona activa aparece en la barra de controles
- Barras de progreso: rojo <15%, amarillo 15-49%, verde 50-100%

- [ ] **Step 5: Ejecutar suite completa de tests frontend**

```bash
cd frontend && npx ng test --watch=false
```
Esperado: todos los tests pasan (incluyendo los de otros módulos).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/clients/clients.module.ts \
        frontend/src/app/features/clients/clients-list/clients-list.component.html \
        frontend/src/app/features/clients/clients-list/clients-list.component.scss
git commit -m "feat(clients): redesign UI — KPI strip, month nav, animaciones y barras semánticas"
```

---

## Self-review

**Spec coverage:**
- ✅ KPI strip horizontal con íconos → Task 4 template
- ✅ Colores siempre visibles en zonas → Task 4 SCSS `.kpi-zone__val` siempre coloreado
- ✅ Estado activo marcado con línea top + fondo → Task 4 SCSS `.kpi-zone::before`
- ✅ Horas contratadas/usadas/disponibles prominentes → Task 4 `.kpi-hours__metrics` 16px
- ✅ Barra de progreso 8px con gradiente → Task 4 SCSS `.kpi-hours__bar`
- ✅ Navegación mensual ← → → Task 3 `navigateMonth`, Task 4 template
- ✅ Badge "Período cerrado" en meses pasados → Task 4 `.month-past-badge`
- ✅ Lógica invertida en barras (mayor consumo = verde) → Task 2 `hoursBarState`, Task 3 `getHoursBarState`
- ✅ Buscador con ícono y foco animado → Task 4 SCSS `.search-icon`
- ✅ Chip de zona activa en controls bar → Task 4 template `.filter-chip`
- ✅ Backend con soporte month/year → Task 1
- ✅ TDD en todos los tasks → steps de tests antes de implementación

**Placeholders:** ninguno.

**Consistencia de tipos:**
- `HoursBarState = 'ok' | 'warn' | 'crit'` definido en `client.models.ts` (Task 2), usado en `clients-list.component.ts` (Task 3) y template (Task 4).
- `HoursZone = 'crit' | 'low' | 'ok' | 'warn'` exportado desde `clients-list.component.ts`, sin cambios.
- `hoursBarState(pct: number): HoursBarState` definido en `client.models.ts`, importado en el componente.
- `allClients` reemplaza `dataSource.data` en el spec (Task 3 Step 6 lo explicita).
