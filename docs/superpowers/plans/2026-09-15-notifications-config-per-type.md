# Notifications Config per Type — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global notifications config dialog with a dedicated `/notifications/config` screen that configures Odoo ticket automation (toggle, team, days, tags) independently per expiration type.

**Architecture:** A new JSONB column `expiration_type_configs` in `odoo_config` stores a map keyed by `ExpirationType`. The old flat fields stay for backward compat (the cron job still uses them). The new frontend screen has 4 cards (one per type) that PATCH the new column. `NotificationsComponent` reads `typeConfigs` from the map for per-type `ticketPending()` logic. The old dialog is deleted.

**Tech Stack:** NestJS + TypeORM JSONB, Angular + Angular Material (MatSlideToggle), class-validator/class-transformer.

**Spec:** `docs/superpowers/specs/2026-09-15-notifications-config-per-type-design.md`

## Global Constraints

- No standalone Angular components.
- All `mat-form-field` use `appearance="outline"` only.
- No `::ng-deep` — use CSS custom properties.
- Tests: Jest for backend, Angular TestBed + ComponentFixture for frontend (not ATL despite spec wording — follow existing pattern).
- `getOdooConfigDecrypted()` flat fields stay unchanged (cron job still uses them).
- Each task ends with `npm test` (backend or frontend) passing before committing.

---

## File Map

**Created:**
- `backend/src/migrations/1789500000000-AddExpirationTypeConfigsToOdooConfig.ts`
- `frontend/src/app/features/notifications/config/notifications-config.component.ts`
- `frontend/src/app/features/notifications/config/notifications-config.component.html`
- `frontend/src/app/features/notifications/config/notifications-config.component.scss`
- `frontend/src/app/features/notifications/config/notifications-config.component.spec.ts`

**Modified:**
- `backend/src/integration-config/entities/odoo-config.entity.ts`
- `backend/src/integration-config/dto/odoo-config.dto.ts`
- `backend/src/integration-config/integration-config.service.ts`
- `backend/src/integration-config/integration-config.service.spec.ts`
- `frontend/src/app/core/models/notification.models.ts`
- `frontend/src/app/core/services/integration-config.service.ts`
- `frontend/src/app/features/notifications/notifications-routing.module.ts`
- `frontend/src/app/features/notifications/notifications.module.ts`
- `frontend/src/app/features/notifications/notifications.component.ts`
- `frontend/src/app/features/notifications/notifications.component.spec.ts`

**Deleted:**
- `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.ts`
- `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.html`
- `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.scss`
- `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.spec.ts`

---

### Task 1: Backend — Migration

**Files:**
- Create: `backend/src/migrations/1789500000000-AddExpirationTypeConfigsToOdooConfig.ts`

**Interfaces:**
- Produces: SQL column `expiration_type_configs jsonb` on `odoo_config`

- [ ] **Step 1: Create migration file**

```typescript
// backend/src/migrations/1789500000000-AddExpirationTypeConfigsToOdooConfig.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpirationTypeConfigsToOdooConfig1789500000000 implements MigrationInterface {
  name = 'AddExpirationTypeConfigsToOdooConfig1789500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "odoo_config" ADD COLUMN IF NOT EXISTS "expiration_type_configs" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "odoo_config" DROP COLUMN IF EXISTS "expiration_type_configs"`,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/migrations/1789500000000-AddExpirationTypeConfigsToOdooConfig.ts
git commit -m "feat(notifications): migración JSONB expiration_type_configs en odoo_config"
```

---

### Task 2: Backend — Entity + DTO + Service + Tests

**Files:**
- Modify: `backend/src/integration-config/entities/odoo-config.entity.ts`
- Modify: `backend/src/integration-config/dto/odoo-config.dto.ts`
- Modify: `backend/src/integration-config/integration-config.service.ts`
- Modify: `backend/src/integration-config/integration-config.service.spec.ts`

**Interfaces:**
- Consumes: migration from Task 1 (column exists)
- Produces:
  - `ExpirationTypeConfigEntry` interface (internal)
  - `ExpirationTypeConfigEntryDto` class (DTO)
  - `PatchOdooConfigDto.expirationsTypeConfigs?: Record<string, ExpirationTypeConfigEntryDto>`
  - `OdooConfigResponseDto.expirationsTypeConfigs: Record<string, ExpirationTypeConfigEntry> | null`
  - `OdooConfig.expirationsTypeConfigs: Record<string, ExpirationTypeConfigEntry> | null`
  - `getOdoo()` returns `expirationsTypeConfigs`
  - `patchOdoo()` persists `expirationsTypeConfigs`

- [ ] **Step 1: Write failing tests (add to `integration-config.service.spec.ts`)**

Add the following tests inside the existing `describe('IntegrationConfigService', ...)` block, nested under their respective `describe` groups. Add them **at the end** of `describe('getOdoo', ...)` and `describe('patchOdoo', ...)`.

In `describe('getOdoo', ...)` add:

```typescript
it('retorna expirationsTypeConfigs desde la fila cuando está configurado', async () => {
  const typeConfigs = {
    domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [3] },
  };
  odooRepo.findOne.mockResolvedValue({
    id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    expirationsTypeConfigs: typeConfigs,
    stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
    updatedAt: null, updatedBy: null,
  });
  const result = await service.getOdoo();
  expect(result.expirationsTypeConfigs).toEqual(typeConfigs);
});

it('retorna null para expirationsTypeConfigs cuando la fila no tiene datos', async () => {
  odooRepo.findOne.mockResolvedValue({
    id: 1, url: 'u', db: 'd', username: 'u', apiKey: null,
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    expirationsTypeConfigs: null,
    stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
    updatedAt: null, updatedBy: null,
  });
  const result = await service.getOdoo();
  expect(result.expirationsTypeConfigs).toBeNull();
});

it('retorna null para expirationsTypeConfigs cuando no hay fila en DB', async () => {
  odooRepo.findOne.mockResolvedValue(null);
  const result = await service.getOdoo();
  expect(result.expirationsTypeConfigs).toBeNull();
});
```

In `describe('patchOdoo', ...)` add:

```typescript
it('persiste expirationsTypeConfigs cuando se provee en el DTO', async () => {
  odooRepo.findOne.mockResolvedValue(null);
  odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
  const configs = {
    domain:   { enabled: true,  helpdeskTeamId: 9, daysAhead: 14, tagIds: [3] },
    software: { enabled: false, helpdeskTeamId: null, daysAhead: 30, tagIds: [] },
  };
  await service.patchOdoo({ expirationsTypeConfigs: configs }, 'admin@test.com');
  const saved = odooRepo.save.mock.calls[0][0];
  expect(saved.expirationsTypeConfigs).toEqual(configs);
});

it('no pisa expirationsTypeConfigs existente cuando el DTO no lo incluye', async () => {
  const existing = {
    id: 1, url: 'u', db: 'd', username: 'u', apiKey: 'enc',
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    expirationsTypeConfigs: { domain: { enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [] } },
    stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
    updatedAt: new Date(), updatedBy: 'x',
  };
  odooRepo.findOne.mockResolvedValue(existing);
  odooRepo.save.mockImplementation(async (e: OdooConfig) => e);
  await service.patchOdoo({ url: 'https://new.com' }, 'admin@test.com');
  const saved = odooRepo.save.mock.calls[0][0];
  expect(saved.expirationsTypeConfigs).toEqual(existing.expirationsTypeConfigs);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest integration-config.service.spec.ts --no-coverage
```

Expected: FAIL — `result.expirationsTypeConfigs` is `undefined`.

- [ ] **Step 3: Update entity**

In `backend/src/integration-config/entities/odoo-config.entity.ts`, add the new column after `expirationsTagIds`:

```typescript
@Column({ name: 'expiration_type_configs', type: 'jsonb', nullable: true })
expirationsTypeConfigs: Record<string, {
  enabled: boolean;
  helpdeskTeamId: number | null;
  daysAhead: number;
  tagIds: number[];
}> | null = null;
```

- [ ] **Step 4: Update DTOs**

Replace the contents of `backend/src/integration-config/dto/odoo-config.dto.ts`:

```typescript
import {
  IsString, IsOptional, IsInt, Min, IsArray, IsBoolean, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExpirationTypeConfigEntryDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  helpdeskTeamId: number | null;

  @IsInt()
  @Min(1)
  daysAhead: number;

  @IsArray()
  @IsInt({ each: true })
  tagIds: number[];
}

export class PatchOdooConfigDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  db?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  helpdeskTeamId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expirationsHelpdeskTeamId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  expirationsTicketDaysAhead?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  expirationsTagIds?: number[];

  @IsOptional()
  @IsString()
  stageInProgressName?: string;

  @IsOptional()
  @IsString()
  stageNotDoneName?: string;

  @IsOptional()
  @IsString()
  stageDoneName?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested({ each: true })
  @Type(() => ExpirationTypeConfigEntryDto)
  expirationsTypeConfigs?: Record<string, ExpirationTypeConfigEntryDto>;
}

export class OdooConfigResponseDto {
  url: string;
  db: string;
  username: string;
  apiKey: string;
  helpdeskTeamId: number;
  expirationsHelpdeskTeamId: number;
  expirationsTicketDaysAhead: number;
  expirationsTagIds: number[];
  expirationsTypeConfigs: Record<string, {
    enabled: boolean;
    helpdeskTeamId: number | null;
    daysAhead: number;
    tagIds: number[];
  }> | null;
  stageInProgressName: string;
  stageNotDoneName: string;
  stageDoneName: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
```

- [ ] **Step 5: Update service — `getOdoo()` and `patchOdoo()`**

In `backend/src/integration-config/integration-config.service.ts`:

In `getOdoo()`, add `expirationsTypeConfigs` to both the fallback return and the DB return:

```typescript
// fallback (no row):
return {
  url: this.configService.get('ODOO_URL', ''),
  db: this.configService.get('ODOO_DB', ''),
  username: this.configService.get('ODOO_USERNAME', ''),
  apiKey: MASK,
  helpdeskTeamId: parseInt(this.configService.get('ODOO_HELPDESK_TEAM_ID', '0'), 10),
  expirationsHelpdeskTeamId: parseInt(this.configService.get('ODOO_EXPIRATIONS_HELPDESK_TEAM_ID', '0'), 10),
  expirationsTicketDaysAhead: 30,
  expirationsTagIds: [],
  expirationsTypeConfigs: null,
  stageInProgressName: '',
  stageNotDoneName: '',
  stageDoneName: '',
  updatedAt: null,
  updatedBy: null,
};

// from DB row:
return {
  url: row.url ?? '', db: row.db ?? '', username: row.username ?? '',
  apiKey: MASK, helpdeskTeamId: row.helpdeskTeamId ?? 0,
  expirationsHelpdeskTeamId: row.expirationsHelpdeskTeamId ?? 0,
  expirationsTicketDaysAhead: row.expirationsTicketDaysAhead ?? 30,
  expirationsTagIds: row.expirationsTagIds ?? [],
  expirationsTypeConfigs: row.expirationsTypeConfigs ?? null,
  stageInProgressName: row.stageInProgressName ?? '',
  stageNotDoneName: row.stageNotDoneName ?? '',
  stageDoneName: row.stageDoneName ?? '',
  updatedAt: row.updatedAt, updatedBy: row.updatedBy,
};
```

In `patchOdoo()`, add handling for the new field after the existing field assignments (before `existing.updatedBy = updatedBy`):

```typescript
if (dto.expirationsTypeConfigs !== undefined) {
  existing.expirationsTypeConfigs = dto.expirationsTypeConfigs as Record<string, {
    enabled: boolean; helpdeskTeamId: number | null; daysAhead: number; tagIds: number[];
  }>;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && npx jest integration-config.service.spec.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 7: Run full backend test suite to check no regressions**

```bash
cd backend && npx jest --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/integration-config/entities/odoo-config.entity.ts \
         backend/src/integration-config/dto/odoo-config.dto.ts \
         backend/src/integration-config/integration-config.service.ts \
         backend/src/integration-config/integration-config.service.spec.ts
git commit -m "feat(notifications): campo expirationsTypeConfigs en entidad, DTO y servicio Odoo"
```

---

### Task 3: Frontend — Type Definitions

**Files:**
- Modify: `frontend/src/app/core/models/notification.models.ts`
- Modify: `frontend/src/app/core/services/integration-config.service.ts`

**Interfaces:**
- Produces:
  - `ExpirationTypeConfigEntry` interface (used by component and parent)
  - `OdooConfigDto.expirationsTypeConfigs: Record<string, ExpirationTypeConfigEntry> | null`

- [ ] **Step 1: Update notification models**

In `frontend/src/app/core/models/notification.models.ts`, add the interface after the existing types:

```typescript
export interface ExpirationTypeConfigEntry {
  enabled: boolean;
  helpdeskTeamId: number | null;
  daysAhead: number;
  tagIds: number[];
}
```

- [ ] **Step 2: Update OdooConfigDto in integration-config service**

In `frontend/src/app/core/services/integration-config.service.ts`, add to `OdooConfigDto`:

```typescript
expirationsTypeConfigs: Record<string, {
  enabled: boolean;
  helpdeskTeamId: number | null;
  daysAhead: number;
  tagIds: number[];
}> | null;
```

The full updated `OdooConfigDto` interface:

```typescript
export interface OdooConfigDto {
  url: string; db: string; username: string; apiKey: string;
  helpdeskTeamId: number;
  expirationsHelpdeskTeamId: number;
  expirationsTicketDaysAhead: number;
  expirationsTagIds: number[];
  expirationsTypeConfigs: Record<string, {
    enabled: boolean;
    helpdeskTeamId: number | null;
    daysAhead: number;
    tagIds: number[];
  }> | null;
  stageInProgressName: string; stageNotDoneName: string; stageDoneName: string;
  updatedAt: Date | null; updatedBy: string | null;
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/models/notification.models.ts \
         frontend/src/app/core/services/integration-config.service.ts
git commit -m "feat(notifications): tipo ExpirationTypeConfigEntry y campo en OdooConfigDto"
```

---

### Task 4: Frontend — NotificationsConfigComponent (TDD)

**Files:**
- Create: `frontend/src/app/features/notifications/config/notifications-config.component.spec.ts`
- Create: `frontend/src/app/features/notifications/config/notifications-config.component.ts`
- Create: `frontend/src/app/features/notifications/config/notifications-config.component.html`
- Create: `frontend/src/app/features/notifications/config/notifications-config.component.scss`

**Interfaces:**
- Consumes:
  - `IntegrationConfigService.getOdoo(): Observable<OdooConfigDto>` (returns `expirationsTypeConfigs`)
  - `IntegrationConfigService.getHelpdeskTeams(): Observable<HelpdeskTeamDto[]>`
  - `IntegrationConfigService.getHelpdeskTags(): Observable<HelpdeskTagDto[]>`
  - `IntegrationConfigService.patchOdoo(dto): Observable<OdooConfigDto>`
  - `ExpirationTypeConfigEntry` from `notification.models.ts`
  - `ExpirationType` from `notification.models.ts`
- Produces:
  - `NotificationsConfigComponent` declared class
  - `EXPIRATION_TYPES: ExpirationType[]` export

- [ ] **Step 1: Write the spec file**

Create `frontend/src/app/features/notifications/config/notifications-config.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NEVER, of } from 'rxjs';
import { NotificationsConfigComponent } from './notifications-config.component';
import { IntegrationConfigService } from '../../../core/services/integration-config.service';

const MOCK_TEAMS = [{ id: 9, name: 'Vencimientos' }, { id: 7, name: 'Mantenimientos' }];
const MOCK_TAGS  = [{ id: 3, name: 'Urgente' }, { id: 5, name: 'Garantía' }];

function mockConfig(expirationsTypeConfigs: object | null = null) {
  return {
    url: 'u', db: 'd', username: 'u', apiKey: '••••••••',
    helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
    expirationsTicketDaysAhead: 30, expirationsTagIds: [],
    expirationsTypeConfigs,
    stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
    updatedAt: null, updatedBy: null,
  };
}

describe('NotificationsConfigComponent', () => {
  let fixture: ComponentFixture<NotificationsConfigComponent>;
  let comp: NotificationsConfigComponent;
  let svc: jasmine.SpyObj<IntegrationConfigService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    svc = jasmine.createSpyObj('IntegrationConfigService', [
      'getOdoo', 'getHelpdeskTeams', 'getHelpdeskTags', 'patchOdoo',
    ]);
    svc.getOdoo.and.returnValue(of(mockConfig() as any));
    svc.getHelpdeskTeams.and.returnValue(of(MOCK_TEAMS));
    svc.getHelpdeskTags.and.returnValue(of(MOCK_TAGS));
    svc.patchOdoo.and.returnValue(of(mockConfig() as any));

    router = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      declarations: [NotificationsConfigComponent],
      imports: [
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatSlideToggleModule,
      ],
      providers: [
        { provide: IntegrationConfigService, useValue: svc },
        { provide: Router, useValue: router },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsConfigComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga config, teams y tags al inicializar', fakeAsync(() => {
    tick();
    expect(svc.getOdoo).toHaveBeenCalled();
    expect(svc.getHelpdeskTeams).toHaveBeenCalled();
    expect(svc.getHelpdeskTags).toHaveBeenCalled();
    expect(comp.loading).toBe(false);
    expect(comp.teams).toEqual(MOCK_TEAMS);
    expect(comp.tags).toEqual(MOCK_TAGS);
  }));

  it('popula el formulario con expirationsTypeConfigs existente', fakeAsync(() => {
    const configs = {
      domain:         { enabled: true,  helpdeskTeamId: 9, daysAhead: 14, tagIds: [3] },
      asset_warranty: { enabled: false, helpdeskTeamId: null, daysAhead: 60, tagIds: [] },
    };
    svc.getOdoo.and.returnValue(of(mockConfig(configs) as any));
    const f = TestBed.createComponent(NotificationsConfigComponent);
    f.detectChanges();
    tick();
    const domainGroup = f.componentInstance.form.get('domain')!;
    expect(domainGroup.get('enabled')!.value).toBe(true);
    expect(domainGroup.get('helpdeskTeamId')!.value).toBe(9);
    expect(domainGroup.get('daysAhead')!.value).toBe(14);
    expect(domainGroup.get('tagIds')!.value).toEqual([3]);
  }));

  it('toggle ON habilita campos del tipo', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    expect(group.get('helpdeskTeamId')!.disabled).toBe(true);
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    expect(group.get('helpdeskTeamId')!.disabled).toBe(false);
    expect(group.get('daysAhead')!.disabled).toBe(false);
    expect(group.get('tagIds')!.disabled).toBe(false);
  }));

  it('toggle OFF deshabilita campos del tipo', fakeAsync(() => {
    tick();
    const group = comp.form.get('software')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('software');
    expect(group.get('helpdeskTeamId')!.disabled).toBe(false);
    group.get('enabled')!.setValue(false);
    comp.onToggleChange('software');
    expect(group.get('helpdeskTeamId')!.disabled).toBe(true);
    expect(group.get('daysAhead')!.disabled).toBe(true);
  }));

  it('formValid es false cuando un tipo está habilitado pero sin equipo', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    group.get('helpdeskTeamId')!.setValue(null);
    expect(comp.formValid).toBe(false);
  }));

  it('formValid es true cuando todos los tipos habilitados tienen equipo', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    group.get('helpdeskTeamId')!.setValue(9);
    expect(comp.formValid).toBe(true);
  }));

  it('save llama patchOdoo con el payload correcto para tipos activos e inactivos', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    group.get('helpdeskTeamId')!.setValue(9);
    group.get('daysAhead')!.setValue(14);
    group.get('tagIds')!.setValue([3]);
    comp.save();
    tick();
    const call = svc.patchOdoo.calls.mostRecent().args[0];
    expect(call.expirationsTypeConfigs!['domain']).toEqual({
      enabled: true, helpdeskTeamId: 9, daysAhead: 14, tagIds: [3],
    });
    expect(call.expirationsTypeConfigs!['software'].enabled).toBe(false);
  }));

  it('save bloquea cuando formValid es false (enabled sin team)', fakeAsync(() => {
    tick();
    const group = comp.form.get('domain')!;
    group.get('enabled')!.setValue(true);
    comp.onToggleChange('domain');
    group.get('helpdeskTeamId')!.setValue(null);
    comp.save();
    tick();
    expect(svc.patchOdoo).not.toHaveBeenCalled();
  }));

  it('save navega a /notifications al completar', fakeAsync(() => {
    tick();
    comp.save();
    tick();
    expect(router.navigate).toHaveBeenCalledWith(['/notifications']);
  }));

  it('save activa saving=true mientras está en progreso', fakeAsync(() => {
    tick();
    svc.patchOdoo.and.returnValue(NEVER);
    comp.save();
    expect(comp.saving).toBe(true);
  }));

  it('back() navega a /notifications', () => {
    comp.back();
    expect(router.navigate).toHaveBeenCalledWith(['/notifications']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails (component file doesn't exist)**

```bash
cd frontend && npx ng test --include="**/notifications-config.component.spec.ts" --no-progress --watch=false
```

Expected: FAIL — component not found.

- [ ] **Step 3: Create the TypeScript component**

Create `frontend/src/app/features/notifications/config/notifications-config.component.ts`:

```typescript
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  IntegrationConfigService,
  HelpdeskTeamDto,
  HelpdeskTagDto,
} from '../../../core/services/integration-config.service';
import { ExpirationTypeConfigEntry, ExpirationType } from '../../../core/models/notification.models';

export const EXPIRATION_TYPES: ExpirationType[] = [
  'asset_warranty', 'certificate', 'domain', 'software',
];

@Component({
  selector: 'app-notifications-config',
  templateUrl: './notifications-config.component.html',
  styleUrl: './notifications-config.component.scss',
})
export class NotificationsConfigComponent implements OnInit {
  form: FormGroup;
  loading = true;
  saving = false;
  teams: HelpdeskTeamDto[] = [];
  tags: HelpdeskTagDto[] = [];
  readonly types = EXPIRATION_TYPES;

  constructor(
    private readonly fb: FormBuilder,
    private readonly svc: IntegrationConfigService,
    private readonly router: Router,
  ) {
    this.form = this.fb.group(
      Object.fromEntries(
        EXPIRATION_TYPES.map(type => [
          type,
          this.fb.group({
            enabled:        [false],
            helpdeskTeamId: [{ value: null, disabled: true }],
            daysAhead:      [{ value: 30,   disabled: true }],
            tagIds:         [{ value: [],   disabled: true }],
          }),
        ]),
      ),
    );
  }

  ngOnInit(): void {
    forkJoin({
      config: this.svc.getOdoo(),
      teams:  this.svc.getHelpdeskTeams().pipe(catchError(() => of([]))),
      tags:   this.svc.getHelpdeskTags().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ config, teams, tags }) => {
        this.teams = teams;
        this.tags  = tags;
        const configs = (config.expirationsTypeConfigs ?? {}) as Record<string, ExpirationTypeConfigEntry>;
        for (const type of EXPIRATION_TYPES) {
          const entry = configs[type];
          if (entry) {
            const group = this.form.get(type) as FormGroup;
            group.get('enabled')!.setValue(entry.enabled);
            group.get('helpdeskTeamId')!.setValue(entry.helpdeskTeamId);
            group.get('daysAhead')!.setValue(entry.daysAhead);
            group.get('tagIds')!.setValue(entry.tagIds);
            this.applyEnabledState(group, entry.enabled);
          }
        }
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onToggleChange(type: string): void {
    const group = this.form.get(type) as FormGroup;
    const enabled = group.get('enabled')!.value as boolean;
    this.applyEnabledState(group, enabled);
  }

  isEnabled(type: string): boolean {
    return !!(this.form.get(type) as FormGroup).get('enabled')!.value;
  }

  get formValid(): boolean {
    return EXPIRATION_TYPES.every(type => {
      const g = this.form.get(type) as FormGroup;
      const enabled = g.get('enabled')!.value as boolean;
      return !enabled || !!g.get('helpdeskTeamId')!.value;
    });
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

  save(): void {
    if (!this.formValid) return;
    this.saving = true;
    const expirationsTypeConfigs: Record<string, ExpirationTypeConfigEntry> = {};
    for (const type of EXPIRATION_TYPES) {
      const g = this.form.get(type) as FormGroup;
      expirationsTypeConfigs[type] = g.getRawValue() as ExpirationTypeConfigEntry;
    }
    this.svc.patchOdoo({ expirationsTypeConfigs } as any).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(['/notifications']);
      },
      error: () => { this.saving = false; },
    });
  }

  back(): void {
    this.router.navigate(['/notifications']);
  }

  private applyEnabledState(group: FormGroup, enabled: boolean): void {
    ['helpdeskTeamId', 'daysAhead', 'tagIds'].forEach(ctrl => {
      const c = group.get(ctrl)!;
      enabled ? c.enable() : c.disable();
    });
  }
}
```

- [ ] **Step 4: Create the HTML template**

Create `frontend/src/app/features/notifications/config/notifications-config.component.html`:

```html
<div class="nc-page">
  <div class="nc-header">
    <h2 class="nc-header__title">Configuración de vencimientos</h2>
    <div class="nc-header__actions">
      <button mat-stroked-button (click)="back()">Volver</button>
      <button mat-flat-button color="primary"
              [disabled]="saving || !formValid"
              (click)="save()">
        <mat-spinner *ngIf="saving" [diameter]="16" class="nc-spinner-inline"></mat-spinner>
        Guardar
      </button>
    </div>
  </div>

  <div *ngIf="loading" class="nc-loading">
    <mat-spinner [diameter]="32"></mat-spinner>
  </div>

  <div *ngIf="!loading" [formGroup]="form" class="nc-grid">
    <div *ngFor="let type of types" class="nc-card" [formGroupName]="type">
      <div class="nc-card__header">
        <span class="badge" [ngClass]="typeClass(type)">{{ typeLabel(type) }}</span>
        <span class="nc-card__type-name">{{ typeLabel(type) }}</span>
        <mat-slide-toggle formControlName="enabled"
                          (change)="onToggleChange(type)">
        </mat-slide-toggle>
      </div>

      <div class="nc-card__body" [class.is-disabled]="!isEnabled(type)">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Equipo Odoo</mat-label>
          <mat-select formControlName="helpdeskTeamId">
            <mat-option [value]="null">— Sin equipo —</mat-option>
            <mat-option *ngFor="let team of teams" [value]="team.id">
              {{ team.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Días de anticipación</mat-label>
          <input matInput type="number" formControlName="daysAhead" min="1" />
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Tags</mat-label>
          <mat-select formControlName="tagIds" multiple>
            <mat-option *ngFor="let tag of tags" [value]="tag.id">
              {{ tag.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Create the SCSS**

Create `frontend/src/app/features/notifications/config/notifications-config.component.scss`:

```scss
.nc-page {
  padding: 24px;
  max-width: 920px;
}

.nc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;

  &__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--tx-hi);
    margin: 0;
    letter-spacing: 0.2px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}

.nc-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.nc-spinner-inline {
  display: inline-block;
  vertical-align: middle;
  margin-right: 6px;
}

.nc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.nc-card {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  &__type-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: var(--tx-hi);
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: opacity 0.15s;

    mat-form-field {
      width: 100%;
    }

    &.is-disabled {
      opacity: 0.35;
      pointer-events: none;
    }
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd frontend && npx ng test --include="**/notifications-config.component.spec.ts" --no-progress --watch=false
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/notifications/config/
git commit -m "feat(notifications): pantalla dedicada NotificationsConfigComponent con TDD"
```

---

### Task 5: Frontend — Routing and Module

**Files:**
- Modify: `frontend/src/app/features/notifications/notifications-routing.module.ts`
- Modify: `frontend/src/app/features/notifications/notifications.module.ts`

**Interfaces:**
- Consumes: `NotificationsConfigComponent` from Task 4
- Produces: route `/notifications/config` guarded by `AdminGuard`

- [ ] **Step 1: Update routing module**

Replace `frontend/src/app/features/notifications/notifications-routing.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NotificationsComponent } from './notifications.component';
import { NotificationsConfigComponent } from './config/notifications-config.component';
import { AdminGuard } from '../../core/guards/admin.guard';

const routes: Routes = [
  { path: '', component: NotificationsComponent },
  { path: 'config', component: NotificationsConfigComponent, canActivate: [AdminGuard] },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NotificationsRoutingModule {}
```

- [ ] **Step 2: Update notifications module**

Replace `frontend/src/app/features/notifications/notifications.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationsRoutingModule } from './notifications-routing.module';
import { NotificationsComponent } from './notifications.component';
import { NotificationsConfigComponent } from './config/notifications-config.component';

@NgModule({
  declarations: [NotificationsComponent, NotificationsConfigComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    NotificationsRoutingModule,
  ],
})
export class NotificationsModule {}
```

Note: `MatDialogModule` removed (dialog being deleted in Task 7).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/notifications/notifications-routing.module.ts \
         frontend/src/app/features/notifications/notifications.module.ts
git commit -m "feat(notifications): ruta /config con AdminGuard y módulo actualizado"
```

---

### Task 6: Frontend — Update NotificationsComponent + Spec (TDD)

**Files:**
- Modify: `frontend/src/app/features/notifications/notifications.component.spec.ts`
- Modify: `frontend/src/app/features/notifications/notifications.component.ts`

**Interfaces:**
- Consumes: `ExpirationTypeConfigEntry` from Task 3; `Router` (Angular)
- Produces:
  - `typeConfigs: Record<string, ExpirationTypeConfigEntry>` (replaces `ticketWindowDays`)
  - `openConfig()` navigates instead of opening dialog
  - `ticketPending(item)` uses `typeConfigs[item.type]?.daysAhead ?? 30`

- [ ] **Step 1: Update the spec first (TDD)**

In `frontend/src/app/features/notifications/notifications.component.spec.ts` make the following changes:

**a) Update imports** — remove `MatDialog` import, add `Router`:

```typescript
// Remove:
import { MatDialog } from '@angular/material/dialog';

// Add:
import { Router } from '@angular/router';
```

**b) Update provider declarations** — replace `mockDialog` with `mockRouter`:

```typescript
// Remove:
let mockDialog: jasmine.SpyObj<MatDialog>;

// Add:
let mockRouter: jasmine.SpyObj<Router>;
```

**c) Update `beforeEach`** — remove dialog mock, add router mock, update `getOdoo` mock to include `expirationsTypeConfigs`:

```typescript
// Remove:
mockDialog = jasmine.createSpyObj('MatDialog', ['open']);

// Add:
mockRouter = jasmine.createSpyObj('Router', ['navigate']);
```

Update `mockIntegrationConfig.getOdoo.and.returnValue(of({...}))` to include `expirationsTypeConfigs: null`:

```typescript
mockIntegrationConfig.getOdoo.and.returnValue(of({
  expirationsTypeConfigs: null,
  expirationsTicketDaysAhead: 20, expirationsTagIds: [],
  helpdeskTeamId: 7, expirationsHelpdeskTeamId: 9,
  url: '', db: '', username: '', apiKey: '',
  stageInProgressName: '', stageNotDoneName: '', stageDoneName: '',
  updatedAt: null, updatedBy: null,
}));
```

Update providers array — replace `MatDialog` with `Router`:

```typescript
// Remove:
{ provide: MatDialog, useValue: mockDialog },

// Add:
{ provide: Router, useValue: mockRouter },
```

**d) Replace the `ticketWindowDays` test with a `typeConfigs` test** — find and replace:

```typescript
// Remove this test:
it('carga ticketWindowDays desde la config al inicializar', () => {
  expect(component.ticketWindowDays).toBe(20);
});

// Add this test:
it('carga typeConfigs desde la config al inicializar (null → mapa vacío)', () => {
  expect(component.typeConfigs).toEqual({});
});
```

**e) Add `openConfig()` navigation test** — add at the end of the describe block:

```typescript
it('openConfig() navega a /notifications/config', () => {
  component.openConfig();
  expect(mockRouter.navigate).toHaveBeenCalledWith(['/notifications/config']);
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
```

- [ ] **Step 2: Run spec to verify new tests fail and existing ones still pass**

```bash
cd frontend && npx ng test --include="**/notifications.component.spec.ts" --no-progress --watch=false
```

Expected: The new `openConfig`, `typeConfigs`, and `ticketPending per-type` tests FAIL. All other existing tests PASS.

- [ ] **Step 3: Update NotificationsComponent**

In `frontend/src/app/features/notifications/notifications.component.ts`, make these changes:

**a) Update imports** — remove dialog and config-dialog imports, add Router:

```typescript
// Remove these imports:
import { MatDialog } from '@angular/material/dialog';
import { NotificationsConfigDialogComponent } from './config-dialog/notifications-config-dialog.component';

// Add:
import { Router } from '@angular/router';
import { ExpirationTypeConfigEntry } from '../../core/models/notification.models';
```

**b) Replace `ticketWindowDays` property with `typeConfigs`**:

```typescript
// Remove:
ticketWindowDays = 30;

// Add:
typeConfigs: Record<string, ExpirationTypeConfigEntry> = {};
```

**c) Update `ngOnInit()`** — change what the config subscription stores:

```typescript
ngOnInit(): void {
  this.integrationConfigService.getOdoo().subscribe({
    next: (config) => {
      this.typeConfigs = (config.expirationsTypeConfigs ?? {}) as Record<string, ExpirationTypeConfigEntry>;
    },
  });
  this.load();
}
```

**d) Update `openConfig()`** — replace dialog.open() with router.navigate():

```typescript
openConfig(): void {
  this.router.navigate(['/notifications/config']);
}
```

**e) Update `ticketPending()`** — use per-type daysAhead:

```typescript
ticketPending(item: ExpirationItem): boolean {
  const daysAhead = this.typeConfigs[item.type]?.daysAhead ?? 30;
  return item.odooTicketId == null && item.daysUntil <= daysAhead;
}
```

**f) Update constructor** — replace `MatDialog` with `Router`:

```typescript
constructor(
  private readonly notificationsService: NotificationsService,
  private readonly authService: AuthService,
  private readonly integrationConfigService: IntegrationConfigService,
  private readonly router: Router,
) {}
```

- [ ] **Step 4: Run spec to verify all tests pass**

```bash
cd frontend && npx ng test --include="**/notifications.component.spec.ts" --no-progress --watch=false
```

Expected: All tests PASS.

- [ ] **Step 5: Run full frontend test suite to check no regressions**

```bash
cd frontend && npx ng test --no-progress --watch=false
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/notifications/notifications.component.ts \
         frontend/src/app/features/notifications/notifications.component.spec.ts
git commit -m "feat(notifications): openConfig navega a /config, ticketPending usa typeConfigs por tipo"
```

---

### Task 7: Cleanup — Delete Dialog

**Files:**
- Delete: `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.ts`
- Delete: `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.html`
- Delete: `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.scss`
- Delete: `frontend/src/app/features/notifications/config-dialog/notifications-config-dialog.component.spec.ts`

- [ ] **Step 1: Delete the config-dialog directory**

```bash
# PowerShell:
Remove-Item -Recurse -Force frontend/src/app/features/notifications/config-dialog
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors. (notifications.module.ts no longer imports the dialog; notifications.component.ts no longer imports it either.)

- [ ] **Step 3: Run full frontend test suite**

```bash
cd frontend && npx ng test --no-progress --watch=false
```

Expected: All tests PASS. The deleted dialog spec no longer runs.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(notifications): eliminar dialog de configuración global reemplazado por pantalla dedicada"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Toggle explícito por tipo | Task 4 (component) |
| JSONB `expiration_type_configs` en `OdooConfig` | Task 1 (migration) + Task 2 (entity) |
| DTO `ExpirationTypeConfigEntryDto` + `PatchOdooConfigDto.expirationsTypeConfigs` | Task 2 |
| Tests backend: patch persiste y retorna correctamente | Task 2 |
| Pantalla dedicada `/notifications/config` con AdminGuard | Task 4 + Task 5 |
| Header: título + botón Volver + botón Guardar | Task 4 (template) |
| 4 cards en grid 2×2 | Task 4 (template) |
| Body expandido toggle ON: team, días, tags | Task 4 (template + component) |
| Body colapsado toggle OFF: campos deshabilitados | Task 4 (component `applyEnabledState`) |
| Un único PATCH al guardar | Task 4 (`save()`) |
| carga inicial forkJoin getOdoo + getHelpdeskTeams + getHelpdeskTags | Task 4 (`ngOnInit`) |
| Eliminar dialog y sus 4 archivos | Task 7 |
| `notifications-routing.module.ts`: ruta hija `/config` con AdminGuard | Task 5 |
| `notifications.module.ts`: eliminar dialog, agregar ConfigComponent + RouterModule | Task 5 |
| `openConfig()` navega en lugar de abrir dialog | Task 6 |
| `typeConfigs` reemplaza `ticketWindowDays` | Task 6 |
| `ticketPending` usa `typeConfigs[item.type]?.daysAhead ?? 30` | Task 6 |
| Tests frontend NotificationsConfigComponent | Task 4 |
| Tests frontend NotificationsComponent | Task 6 |

**Placeholder scan:** None found. All steps have concrete code.

**Type consistency check:**
- `ExpirationTypeConfigEntry` defined in `notification.models.ts` (Task 3), used identically in `OdooConfig` entity (Task 2), `OdooConfigResponseDto` (Task 2), `OdooConfigDto` frontend (Task 3), `NotificationsConfigComponent` (Task 4), `NotificationsComponent` (Task 6).
- `EXPIRATION_TYPES` exported from `notifications-config.component.ts` as `ExpirationType[]`.
- `patchOdoo` DTO uses `as any` cast for `expirationsTypeConfigs` because `OdooConfigDto` is `Partial<OdooConfigDto>` and the nested shape matches.
