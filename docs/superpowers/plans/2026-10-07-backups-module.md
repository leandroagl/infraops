# Backups Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo `/backups` que monitorea el estado de backups Veeam B&R por cliente, con lectura en vivo de la API, snapshot diario persistido y configuración per-cliente en Admin.

**Architecture:** El backend expone un módulo `backups/` con servicio, controller y cron. El servicio `integrations/veeam/` encapsula las llamadas a la API REST de Veeam (auth + jobs + sessions). La vista Angular muestra un grid de cards por cliente con drawer de detalle; la config vive en `/admin/backups`.

**Tech Stack:** NestJS · TypeORM · PostgreSQL · @nestjs/schedule · axios · Angular · Angular Material · no standalone components

**Spec:** `docs/mockups/backups-v1.html` · `CLAUDE.md` sección Vistas definidas `/backups`

---

## Global Constraints

- Angular: sin standalone components — todos los componentes van en NgModule
- Angular Material: `appearance="outline"` obligatorio en mat-form-field; sin elementos HTML nativos en formularios
- Passwords cifradas con AES-256-GCM usando `backend/src/integration-config/crypto.util.ts` — misma clave env `INTEGRATIONS_ENCRYPT_KEY`
- Endpoints confirmados por spike: auth `POST /api/oauth2/token`, jobs `GET /api/v1/jobs`, sessions `GET /api/v1/sessions`, repos `GET /api/v1/backupInfrastructure/repositories`
- Header requerido en cada request Veeam: `x-api-version: 1.1-rev2`
- Sessions endpoint devuelve todos los tipos — filtrar siempre por `sessionType === 'BackupJob'` para backups; réplicas (`VSphereReplica`) se muestran separadas
- Umbral de "stale": job con `hoursAgo > 30` se marca `isStale: true` y se muestra en naranja
- Estado del cliente = peor estado entre sus jobs: `Failed > Warning > Success`
- Capacidad de repositorios NO disponible vía API (limitación confirmada) — no intentar obtenerla
- KPI strip: mismo patrón visual que `/tasks` y `/notifications` (`.kpi-strip` + `.kpi-block`)
- TDD obligatorio: test antes que implementación en cada tarea
- Un archivo confirmado por el usuario antes de continuar al siguiente — no generar múltiples archivos sin pausa

## Review Focus

- **Cliente sin sesiones registradas:** job sin sesiones debe mostrar `lastResult: null`, `hoursAgo: null`, `isStale: false` — no crashear
- **Credenciales inválidas al hacer test connection:** debe devolver `{ success: false, message: 'Authentication failed' }` con HTTP 200 (no 500) — es un resultado esperado, no un error del servidor
- **Cliente con todos los jobs disabled en Veeam:** `jobs` vacío → `status: 'no_data'`, contadores en cero
- **Sesiones con `endTime: null` (job corriendo):** calcular `hoursAgo` desde `creationTime`, marcar `isRunning: true`
- **Snapshot duplicado el mismo día:** unique constraint `(clientId, jobId, snapshotDate)` — el cron debe hacer upsert, no insertar

---

## File Map

```
backend/src/
├── integrations/veeam/
│   ├── veeam.module.ts              CREAR — módulo NestJS, exporta VeeamService
│   ├── veeam.service.ts             CREAR — auth + jobs + sessions + status calc
│   ├── veeam.service.spec.ts        CREAR — tests unitarios con mocks de HttpService
│   └── dto/
│       └── veeam-api.dto.ts         CREAR — interfaces para respuestas de la API Veeam
├── backups/
│   ├── backups.module.ts            CREAR
│   ├── backups.controller.ts        CREAR — endpoints REST
│   ├── backups.controller.spec.ts   CREAR
│   ├── backups.service.ts           CREAR — lógica de negocio, config CRUD, live read
│   ├── backups.service.spec.ts      CREAR
│   ├── backups.cron.ts              CREAR — snapshot diario @Cron
│   ├── entities/
│   │   ├── veeam-client-config.entity.ts   CREAR
│   │   └── veeam-daily-snapshot.entity.ts  CREAR
│   └── dto/
│       ├── backup-status.dto.ts     CREAR — respuestas de la API
│       └── veeam-config.dto.ts      CREAR — create/update/response DTOs
├── migrations/
│   ├── 1790000000000-CreateVeeamClientConfigs.ts   CREAR
│   └── 1790100000000-CreateVeeamDailySnapshots.ts  CREAR
└── app.module.ts                    MODIFICAR — registrar BackupsModule

frontend/src/app/
├── features/backups/
│   ├── backups.module.ts            CREAR
│   ├── backups-routing.module.ts    CREAR
│   ├── backups.component.ts         CREAR — página principal /backups
│   ├── backups.component.html       CREAR
│   ├── backups.component.scss       CREAR
│   ├── backups.component.spec.ts    CREAR
│   ├── models/
│   │   └── backup.models.ts         CREAR — tipos compartidos frontend
│   ├── services/
│   │   └── backups.service.ts       CREAR — HTTP calls al backend
│   └── components/
│       ├── backup-client-card/      CREAR — card del grid
│       │   ├── backup-client-card.component.ts/html/scss/spec.ts
│       └── backup-client-drawer/    CREAR — panel de detalle
│           ├── backup-client-drawer.component.ts/html/scss/spec.ts
├── features/admin/
│   ├── backups-config/              CREAR — pestaña Admin → Backups
│   │   ├── backups-config.component.ts/html/scss/spec.ts
│   │   └── backups-config-dialog/   CREAR — dialog para add/edit
│   │       └── backups-config-dialog.component.ts/html/spec.ts
│   ├── admin-layout/
│   │   └── admin-layout.component.ts   MODIFICAR — agregar pestaña Backups
│   ├── admin-routing.module.ts      MODIFICAR — agregar ruta /admin/backups
│   └── admin.module.ts              MODIFICAR — declarar BackupsConfigComponent
├── core/shell/
│   └── shell.component.ts           MODIFICAR — agregar backups a navItems
└── app-routing.module.ts            MODIFICAR — agregar ruta /backups
```

---

## Task 1: DB Entities + Migrations

**Files:**
- Create: `backend/src/backups/entities/veeam-client-config.entity.ts`
- Create: `backend/src/backups/entities/veeam-daily-snapshot.entity.ts`
- Create: `backend/src/migrations/1790000000000-CreateVeeamClientConfigs.ts`
- Create: `backend/src/migrations/1790100000000-CreateVeeamDailySnapshots.ts`

**Interfaces:**
- Produces: `VeeamClientConfig` entity, `VeeamDailySnapshot` entity — usados en Tasks 3 y 4

- [ ] **Step 1: Crear entity VeeamClientConfig**

```typescript
// backend/src/backups/entities/veeam-client-config.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('veeam_client_configs')
export class VeeamClientConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @Column({ type: 'varchar' })
  host: string;

  @Column({ type: 'int', default: 9419 })
  port: number;

  @Column({ type: 'varchar' })
  username: string;

  @Column({ type: 'varchar', name: 'encrypted_password' })
  encryptedPassword: string;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @Column({ type: 'timestamptz', name: 'last_connected_at', nullable: true })
  lastConnectedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', name: 'updated_at', default: () => 'now()' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Crear entity VeeamDailySnapshot**

```typescript
// backend/src/backups/entities/veeam-daily-snapshot.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('veeam_daily_snapshots')
@Unique(['clientId', 'jobId', 'snapshotDate'])
export class VeeamDailySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId: string;

  @Column({ type: 'varchar', name: 'job_id' })
  jobId: string;

  @Column({ type: 'varchar', name: 'job_name' })
  jobName: string;

  @Column({ type: 'varchar', name: 'job_type' })
  jobType: string;

  @Column({ type: 'varchar', nullable: true })
  result: string | null;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'timestamptz', name: 'last_run_at', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'float', name: 'hours_ago', nullable: true })
  hoursAgo: number | null;

  @Column({ type: 'date', name: 'snapshot_date' })
  snapshotDate: string;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;
}
```

- [ ] **Step 3: Crear migración VeeamClientConfigs**

```typescript
// backend/src/migrations/1790000000000-CreateVeeamClientConfigs.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVeeamClientConfigs1790000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE veeam_client_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        host VARCHAR NOT NULL,
        port INTEGER NOT NULL DEFAULT 9419,
        username VARCHAR NOT NULL,
        encrypted_password VARCHAR NOT NULL,
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        last_connected_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE veeam_client_configs');
  }
}
```

- [ ] **Step 4: Crear migración VeeamDailySnapshots**

```typescript
// backend/src/migrations/1790100000000-CreateVeeamDailySnapshots.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVeeamDailySnapshots1790100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE veeam_daily_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        job_id VARCHAR NOT NULL,
        job_name VARCHAR NOT NULL,
        job_type VARCHAR NOT NULL,
        result VARCHAR,
        message TEXT,
        last_run_at TIMESTAMPTZ,
        hours_ago FLOAT,
        snapshot_date DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_veeam_snapshot UNIQUE (client_id, job_id, snapshot_date)
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE veeam_daily_snapshots');
  }
}
```

- [ ] **Step 5: Correr migraciones y verificar**

```bash
cd backend && npm run migration:run
```
Verificar con `\d veeam_client_configs` y `\d veeam_daily_snapshots` en psql.

- [ ] **Step 6: Commit**

```bash
git add backend/src/backups/entities/ backend/src/migrations/1790000000000* backend/src/migrations/1790100000000*
git commit -m "feat: entidades y migraciones para módulo backups Veeam"
```

---

## Task 2: Veeam Integration Service

**Files:**
- Create: `backend/src/integrations/veeam/dto/veeam-api.dto.ts`
- Create: `backend/src/integrations/veeam/veeam.service.ts`
- Create: `backend/src/integrations/veeam/veeam.service.spec.ts`
- Create: `backend/src/integrations/veeam/veeam.module.ts`

**Interfaces:**
- Consumes: `HttpService` de `@nestjs/axios`
- Produces: `VeeamService.getJobStatuses(host, port, username, password): Promise<BackupJobStatus[]>` — usado en Task 3

- [ ] **Step 1: Escribir el test (failing)**

```typescript
// backend/src/integrations/veeam/veeam.service.spec.ts
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';
import { VeeamService } from './veeam.service';

const mockHttpService = { post: jest.fn(), get: jest.fn() };

describe('VeeamService', () => {
  let svc: VeeamService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VeeamService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();
    svc = module.get(VeeamService);
    jest.clearAllMocks();
  });

  const mockAxios = <T>(data: T): AxiosResponse<T> =>
    ({ data, status: 200, statusText: 'OK', headers: {}, config: {} as any });

  it('debería autenticar y devolver token', async () => {
    mockHttpService.post.mockReturnValue(of(mockAxios({ access_token: 'tok123' })));
    const token = await (svc as any).authenticate('host', 9419, 'user', 'pass');
    expect(token).toBe('tok123');
    expect(mockHttpService.post).toHaveBeenCalledWith(
      'https://host:9419/api/oauth2/token',
      'grant_type=password&username=user&password=pass',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }) }),
    );
  });

  it('debería lanzar error si auth falla', async () => {
    mockHttpService.post.mockReturnValue(of(mockAxios({ error: 'invalid_grant' })));
    await expect((svc as any).authenticate('host', 9419, 'user', 'bad')).rejects.toThrow('Authentication failed');
  });

  it('debería filtrar sesiones BackupJob y no incluir ReplicaJob', async () => {
    const sessions = [
      { sessionType: 'BackupJob', jobId: 'j1', state: 'Stopped', endTime: new Date(Date.now() - 3600000).toISOString(), result: { result: 'Success', message: 'Success' } },
      { sessionType: 'ReplicaJob', jobId: 'j2', state: 'Stopped', endTime: new Date().toISOString(), result: { result: 'Success', message: '' } },
    ];
    mockHttpService.get.mockReturnValue(of(mockAxios({ data: sessions })));
    const result = await (svc as any).getBackupSessions('https://host:9419', 'tok');
    expect(result).toHaveLength(1);
    expect(result[0].sessionType).toBe('BackupJob');
  });

  it('debería marcar isStale cuando hoursAgo > 30', () => {
    const thirtyTwoHoursAgo = new Date(Date.now() - 32 * 3600000).toISOString();
    const status = (svc as any).buildJobStatus(
      { id: 'j1', name: 'DC', type: 'Backup', isDisabled: false },
      { sessionType: 'BackupJob', jobId: 'j1', state: 'Stopped', endTime: thirtyTwoHoursAgo, creationTime: thirtyTwoHoursAgo, result: { result: 'Success', message: '' } },
    );
    expect(status.isStale).toBe(true);
    expect(status.hoursAgo).toBeGreaterThan(30);
  });

  it('job sin sesiones → lastResult null, isStale false', () => {
    const status = (svc as any).buildJobStatus(
      { id: 'j1', name: 'DC', type: 'Backup', isDisabled: false },
      null,
    );
    expect(status.lastResult).toBeNull();
    expect(status.isStale).toBe(false);
    expect(status.hoursAgo).toBeNull();
  });

  it('job con endTime null (corriendo) → isRunning true, hoursAgo desde creationTime', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    const status = (svc as any).buildJobStatus(
      { id: 'j1', name: 'DC', type: 'Backup', isDisabled: false },
      { sessionType: 'BackupJob', jobId: 'j1', state: 'Working', endTime: null, creationTime: twoHoursAgo, result: { result: 'Success', message: '' } },
    );
    expect(status.isRunning).toBe(true);
    expect(status.hoursAgo).toBeGreaterThan(1.5);
  });
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
cd backend && npx jest veeam.service.spec --no-coverage
```
Expected: FAIL — `VeeamService` no existe.

- [ ] **Step 3: Crear DTOs de la API Veeam**

```typescript
// backend/src/integrations/veeam/dto/veeam-api.dto.ts

export interface VeeamJob {
  id: string;
  name: string;
  type: string;
  isDisabled: boolean;
}

export interface VeeamSessionResult {
  result: 'Success' | 'Warning' | 'Failed';
  message: string;
  isCanceled: boolean;
}

export interface VeeamSession {
  id: string;
  jobId: string;
  name: string;
  sessionType: string;
  state: string;
  creationTime: string;
  endTime: string | null;
  progressPercent: number;
  result: VeeamSessionResult;
}

export interface VeeamApiResponse<T> {
  data: T[];
}

export interface BackupJobStatus {
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: 'Success' | 'Warning' | 'Failed' | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
}
```

- [ ] **Step 4: Implementar VeeamService**

```typescript
// backend/src/integrations/veeam/veeam.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { VeeamJob, VeeamSession, VeeamApiResponse, BackupJobStatus } from './dto/veeam-api.dto';

@Injectable()
export class VeeamService {
  private readonly API_VERSION = '1.1-rev2';
  private readonly STALE_HOURS = 30;

  constructor(private readonly httpService: HttpService) {}

  private baseUrl(host: string, port: number): string {
    return `https://${host}:${port}`;
  }

  private apiHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'x-api-version': this.API_VERSION,
      Accept: 'application/json',
    };
  }

  private async authenticate(host: string, port: number, username: string, password: string): Promise<string> {
    const url = `${this.baseUrl(host, port)}/api/oauth2/token`;
    const body = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const res = await firstValueFrom(
      this.httpService.post<{ access_token?: string }>(url, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-version': this.API_VERSION,
        },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 15000,
      }),
    );
    if (!res.data.access_token) throw new Error('Authentication failed');
    return res.data.access_token;
  }

  private async getJobs(baseUrl: string, token: string): Promise<VeeamJob[]> {
    const res = await firstValueFrom(
      this.httpService.get<VeeamApiResponse<VeeamJob>>(`${baseUrl}/api/v1/jobs`, {
        headers: this.apiHeaders(token),
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 30000,
      }),
    );
    return res.data.data ?? [];
  }

  private async getBackupSessions(baseUrl: string, token: string): Promise<VeeamSession[]> {
    const res = await firstValueFrom(
      this.httpService.get<VeeamApiResponse<VeeamSession>>(`${baseUrl}/api/v1/sessions`, {
        headers: this.apiHeaders(token),
        params: { limit: 500, orderColumn: 'CreationTime', orderAsc: false },
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
        timeout: 30000,
      }),
    );
    return (res.data.data ?? []).filter(s => s.sessionType === 'BackupJob');
  }

  private hoursAgo(isoStr: string | null): number | null {
    if (!isoStr) return null;
    return (Date.now() - new Date(isoStr).getTime()) / 3600000;
  }

  private buildJobStatus(job: VeeamJob, lastSession: VeeamSession | null): BackupJobStatus {
    if (!lastSession) {
      return {
        jobId: job.id, jobName: job.name, jobType: job.type,
        isRunning: false, lastResult: null, lastMessage: null,
        lastRunAt: null, hoursAgo: null, isStale: false,
      };
    }
    const isRunning = lastSession.state === 'Working' || lastSession.state === 'Starting';
    const refTime = lastSession.endTime ?? lastSession.creationTime;
    const hours = this.hoursAgo(refTime);
    return {
      jobId: job.id,
      jobName: job.name,
      jobType: job.type,
      isRunning,
      lastResult: lastSession.result?.result ?? null,
      lastMessage: lastSession.result?.message ?? null,
      lastRunAt: refTime,
      hoursAgo: hours !== null ? Math.round(hours * 10) / 10 : null,
      isStale: hours !== null && !isRunning && hours > this.STALE_HOURS,
    };
  }

  async getJobStatuses(
    host: string, port: number, username: string, password: string,
  ): Promise<BackupJobStatus[]> {
    const base = this.baseUrl(host, port);
    const token = await this.authenticate(host, port, username, password);
    const [jobs, sessions] = await Promise.all([
      this.getJobs(base, token),
      this.getBackupSessions(base, token),
    ]);
    const lastByJob = new Map<string, VeeamSession>();
    for (const s of sessions) {
      if (!lastByJob.has(s.jobId)) lastByJob.set(s.jobId, s);
    }
    return jobs.map(j => this.buildJobStatus(j, lastByJob.get(j.id) ?? null));
  }

  async testConnection(
    host: string, port: number, username: string, password: string,
  ): Promise<{ success: boolean; message: string; jobCount?: number }> {
    try {
      const base = this.baseUrl(host, port);
      const token = await this.authenticate(host, port, username, password);
      const jobs = await this.getJobs(base, token);
      return { success: true, message: `Conectado. ${jobs.length} jobs encontrados.`, jobCount: jobs.length };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}
```

- [ ] **Step 5: Crear VeeamModule**

```typescript
// backend/src/integrations/veeam/veeam.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VeeamService } from './veeam.service';

@Module({
  imports: [HttpModule],
  providers: [VeeamService],
  exports: [VeeamService],
})
export class VeeamModule {}
```

- [ ] **Step 6: Correr tests — verificar que pasan**

```bash
cd backend && npx jest veeam.service.spec --no-coverage
```
Expected: 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/integrations/veeam/
git commit -m "feat: VeeamService — auth, jobs, sessions, cálculo de estado por job"
```

---

## Task 3: Backups Module — Service + Controller

**Files:**
- Create: `backend/src/backups/dto/backup-status.dto.ts`
- Create: `backend/src/backups/dto/veeam-config.dto.ts`
- Create: `backend/src/backups/backups.service.ts`
- Create: `backend/src/backups/backups.service.spec.ts`
- Create: `backend/src/backups/backups.controller.ts`
- Create: `backend/src/backups/backups.controller.spec.ts`
- Create: `backend/src/backups/backups.module.ts`

**Interfaces:**
- Consumes: `VeeamService.getJobStatuses()`, `VeeamService.testConnection()`, `VeeamClientConfig` entity, `VeeamDailySnapshot` entity, `encrypt`/`decrypt` de `crypto.util.ts`
- Produces: endpoints REST — ver sección DTOs abajo

**DTOs de respuesta:**

```typescript
// backup-status.dto.ts
export type JobResult = 'Success' | 'Warning' | 'Failed';
export type ClientStatus = 'ok' | 'warn' | 'crit' | 'no_data';

export class BackupJobStatusDto {
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: JobResult | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
}

export class ClientBackupStatusDto {
  clientId: string;
  clientName: string;
  status: ClientStatus;
  totalJobs: number;
  okCount: number;
  warnCount: number;
  critCount: number;
  hasRunningJob: boolean;
  lastReadAt: string;
  jobs: BackupJobStatusDto[];
}
```

```typescript
// veeam-config.dto.ts
export class VeeamClientConfigResponseDto {
  id: string;
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  username: string;
  isEnabled: boolean;
  lastConnectedAt: string | null;
}

export class CreateVeeamConfigDto {
  clientId: string;
  host: string;
  port: number;
  username: string;
  password: string;
  isEnabled: boolean;
}

export class UpdateVeeamConfigDto {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  isEnabled?: boolean;
}

export class TestConnectionResultDto {
  success: boolean;
  message: string;
  jobCount?: number;
}
```

- [ ] **Step 1: Escribir tests del servicio (failing)**

```typescript
// backend/src/backups/backups.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BackupsService } from './backups.service';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';

const mockConfigRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), delete: jest.fn(), create: jest.fn() };
const mockSnapshotRepo = { upsert: jest.fn() };
const mockVeeamService = { getJobStatuses: jest.fn(), testConnection: jest.fn() };
const mockConfigService = { get: jest.fn().mockReturnValue('a'.repeat(64)) };

describe('BackupsService', () => {
  let svc: BackupsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BackupsService,
        { provide: getRepositoryToken(VeeamClientConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(VeeamDailySnapshot), useValue: mockSnapshotRepo },
        { provide: VeeamService, useValue: mockVeeamService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    svc = module.get(BackupsService);
    jest.clearAllMocks();
  });

  it('debería calcular estado del cliente como el peor estado de sus jobs', () => {
    const jobs = [
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
      { lastResult: 'Warning', isRunning: false, isStale: false } as any,
    ];
    const status = (svc as any).deriveClientStatus(jobs);
    expect(status).toBe('warn');
  });

  it('debería devolver crit si hay al menos un job Failed', () => {
    const jobs = [
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
      { lastResult: 'Failed', isRunning: false, isStale: false } as any,
      { lastResult: 'Warning', isRunning: false, isStale: false } as any,
    ];
    expect((svc as any).deriveClientStatus(jobs)).toBe('crit');
  });

  it('debería devolver no_data si no hay jobs', () => {
    expect((svc as any).deriveClientStatus([])).toBe('no_data');
  });

  it('debería cifrar password al crear config', async () => {
    mockConfigRepo.create.mockReturnValue({});
    mockConfigRepo.save.mockResolvedValue({ id: 'uuid', clientId: 'c1', host: 'h', port: 9419, username: 'u', encryptedPassword: 'enc', isEnabled: true, lastConnectedAt: null, createdAt: new Date(), updatedAt: new Date() });
    await svc.createConfig({ clientId: 'c1', host: 'h', port: 9419, username: 'u', password: 'plain', isEnabled: true });
    const saveArg = mockConfigRepo.save.mock.calls[0][0];
    expect(saveArg.encryptedPassword).not.toBe('plain');
    expect(saveArg.encryptedPassword).toBeDefined();
  });

  it('testConnection debería devolver success false sin lanzar error', async () => {
    mockConfigRepo.findOne.mockResolvedValue({ host: 'h', port: 9419, username: 'u', encryptedPassword: 'enc', isEnabled: true });
    mockVeeamService.testConnection.mockResolvedValue({ success: false, message: 'Authentication failed' });
    const result = await svc.testConnection('config-id');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Authentication failed');
  });
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
cd backend && npx jest backups.service.spec --no-coverage
```
Expected: FAIL — `BackupsService` no existe.

- [ ] **Step 3: Crear DTOs**

Crear `backend/src/backups/dto/backup-status.dto.ts` y `backend/src/backups/dto/veeam-config.dto.ts` con el contenido de la sección DTOs de arriba.

- [ ] **Step 4: Implementar BackupsService**

```typescript
// backend/src/backups/backups.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { encrypt, decrypt } from '../integration-config/crypto.util';
import type { BackupJobStatus } from '../integrations/veeam/dto/veeam-api.dto';
import type { CreateVeeamConfigDto, UpdateVeeamConfigDto, VeeamClientConfigResponseDto, TestConnectionResultDto } from './dto/veeam-config.dto';
import type { ClientBackupStatusDto, ClientStatus } from './dto/backup-status.dto';

@Injectable()
export class BackupsService {
  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    @InjectRepository(VeeamDailySnapshot) private readonly snapshotRepo: Repository<VeeamDailySnapshot>,
    private readonly veeamService: VeeamService,
    private readonly configService: ConfigService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  private deriveClientStatus(jobs: BackupJobStatus[]): ClientStatus {
    if (!jobs.length) return 'no_data';
    if (jobs.some(j => j.lastResult === 'Failed')) return 'crit';
    if (jobs.some(j => j.lastResult === 'Warning')) return 'warn';
    return 'ok';
  }

  async getClientStatus(configId: string): Promise<ClientBackupStatusDto> {
    const config = await this.configRepo.findOne({ where: { id: configId } });
    if (!config) throw new NotFoundException('Config not found');
    const password = decrypt(config.encryptedPassword, this.encryptKey);
    const jobs = await this.veeamService.getJobStatuses(config.host, config.port, config.username, password);
    const status = this.deriveClientStatus(jobs);
    return {
      clientId: config.clientId,
      clientName: '',
      status,
      totalJobs: jobs.length,
      okCount: jobs.filter(j => j.lastResult === 'Success').length,
      warnCount: jobs.filter(j => j.lastResult === 'Warning').length,
      critCount: jobs.filter(j => j.lastResult === 'Failed').length,
      hasRunningJob: jobs.some(j => j.isRunning),
      lastReadAt: new Date().toISOString(),
      jobs,
    };
  }

  async getAllClientStatuses(): Promise<ClientBackupStatusDto[]> {
    const configs = await this.configRepo.find({ where: { isEnabled: true } });
    const results = await Promise.allSettled(
      configs.map(c => this.getClientStatus(c.id)),
    );
    return results
      .filter((r): r is PromiseFulfilledResult<ClientBackupStatusDto> => r.status === 'fulfilled')
      .map(r => r.value);
  }

  async saveSnapshot(clientId: string, jobs: BackupJobStatus[]): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const rows = jobs.map(j => ({
      clientId,
      jobId: j.jobId,
      jobName: j.jobName,
      jobType: j.jobType,
      result: j.lastResult,
      message: j.lastMessage,
      lastRunAt: j.lastRunAt ? new Date(j.lastRunAt) : null,
      hoursAgo: j.hoursAgo,
      snapshotDate: date,
    }));
    await this.snapshotRepo.upsert(rows, ['clientId', 'jobId', 'snapshotDate']);
  }

  async listConfigs(): Promise<VeeamClientConfigResponseDto[]> {
    const configs = await this.configRepo.find();
    return configs.map(c => ({
      id: c.id, clientId: c.clientId, clientName: '',
      host: c.host, port: c.port, username: c.username,
      isEnabled: c.isEnabled, lastConnectedAt: c.lastConnectedAt?.toISOString() ?? null,
    }));
  }

  async createConfig(dto: CreateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    const entity = this.configRepo.create({
      clientId: dto.clientId,
      host: dto.host,
      port: dto.port,
      username: dto.username,
      encryptedPassword: encrypt(dto.password, this.encryptKey),
      isEnabled: dto.isEnabled,
    });
    const saved = await this.configRepo.save(entity);
    return { id: saved.id, clientId: saved.clientId, clientName: '', host: saved.host, port: saved.port, username: saved.username, isEnabled: saved.isEnabled, lastConnectedAt: null };
  }

  async updateConfig(id: string, dto: UpdateVeeamConfigDto): Promise<VeeamClientConfigResponseDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    if (dto.host !== undefined) config.host = dto.host;
    if (dto.port !== undefined) config.port = dto.port;
    if (dto.username !== undefined) config.username = dto.username;
    if (dto.password !== undefined) config.encryptedPassword = encrypt(dto.password, this.encryptKey);
    if (dto.isEnabled !== undefined) config.isEnabled = dto.isEnabled;
    config.updatedAt = new Date();
    const saved = await this.configRepo.save(config);
    return { id: saved.id, clientId: saved.clientId, clientName: '', host: saved.host, port: saved.port, username: saved.username, isEnabled: saved.isEnabled, lastConnectedAt: saved.lastConnectedAt?.toISOString() ?? null };
  }

  async deleteConfig(id: string): Promise<void> {
    await this.configRepo.delete(id);
  }

  async testConnection(id: string): Promise<TestConnectionResultDto> {
    const config = await this.configRepo.findOne({ where: { id } });
    if (!config) throw new NotFoundException();
    const password = decrypt(config.encryptedPassword, this.encryptKey);
    return this.veeamService.testConnection(config.host, config.port, config.username, password);
  }
}
```

- [ ] **Step 5: Correr tests servicio — deben pasar**

```bash
cd backend && npx jest backups.service.spec --no-coverage
```
Expected: 5 tests PASS.

- [ ] **Step 6: Escribir tests del controller (failing)**

```typescript
// backend/src/backups/backups.controller.spec.ts
import { Test } from '@nestjs/testing';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

const mockSvc = {
  getAllClientStatuses: jest.fn(),
  getClientStatus: jest.fn(),
  listConfigs: jest.fn(),
  createConfig: jest.fn(),
  updateConfig: jest.fn(),
  deleteConfig: jest.fn(),
  testConnection: jest.fn(),
};

describe('BackupsController', () => {
  let ctrl: BackupsController;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BackupsController],
      providers: [{ provide: BackupsService, useValue: mockSvc }],
    }).compile();
    ctrl = module.get(BackupsController);
    jest.clearAllMocks();
  });

  it('GET /backups → llama getAllClientStatuses', async () => {
    mockSvc.getAllClientStatuses.mockResolvedValue([]);
    const result = await ctrl.getAll();
    expect(mockSvc.getAllClientStatuses).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('POST /backups/configs/:id/test → devuelve resultado sin lanzar error si falla', async () => {
    mockSvc.testConnection.mockResolvedValue({ success: false, message: 'err' });
    const result = await ctrl.testConnection('id');
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 7: Implementar BackupsController**

```typescript
// backend/src/backups/backups.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import type { CreateVeeamConfigDto, UpdateVeeamConfigDto } from './dto/veeam-config.dto';

@Controller('backups')
@UseGuards(JwtAuthGuard)
export class BackupsController {
  constructor(private readonly svc: BackupsService) {}

  @Get()
  getAll() { return this.svc.getAllClientStatuses(); }

  @Get(':clientId')
  getOne(@Param('clientId') clientId: string) { return this.svc.getClientStatus(clientId); }

  @Get('configs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  listConfigs() { return this.svc.listConfigs(); }

  @Post('configs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  createConfig(@Body() dto: CreateVeeamConfigDto) { return this.svc.createConfig(dto); }

  @Patch('configs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  updateConfig(@Param('id') id: string, @Body() dto: UpdateVeeamConfigDto) { return this.svc.updateConfig(id, dto); }

  @Delete('configs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  deleteConfig(@Param('id') id: string) { return this.svc.deleteConfig(id); }

  @Post('configs/:id/test')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  testConnection(@Param('id') id: string) { return this.svc.testConnection(id); }
}
```

- [ ] **Step 8: Correr todos los tests backups — deben pasar**

```bash
cd backend && npx jest backups --no-coverage
```
Expected: todos PASS.

- [ ] **Step 9: Crear BackupsModule**

```typescript
// backend/src/backups/backups.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamModule } from '../integrations/veeam/veeam.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VeeamClientConfig, VeeamDailySnapshot]),
    VeeamModule,
  ],
  controllers: [BackupsController],
  providers: [BackupsService],
  exports: [BackupsService],
})
export class BackupsModule {}
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/backups/
git commit -m "feat: BackupsModule — service, controller, DTOs"
```

---

## Task 4: Cron Diario + Registro en AppModule

**Files:**
- Create: `backend/src/backups/backups.cron.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/database/typeorm.config.ts` (o donde se registran entities/migrations)

**Interfaces:**
- Consumes: `BackupsService.getAllClientStatuses()`, `BackupsService.saveSnapshot()`

- [ ] **Step 1: Implementar BackupsCron**

```typescript
// backend/src/backups/backups.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { decrypt } from '../integration-config/crypto.util';

@Injectable()
export class BackupsCron {
  private readonly logger = new Logger(BackupsCron.name);

  constructor(
    @InjectRepository(VeeamClientConfig) private readonly configRepo: Repository<VeeamClientConfig>,
    @InjectRepository(VeeamDailySnapshot) private readonly snapshotRepo: Repository<VeeamDailySnapshot>,
    private readonly veeamService: VeeamService,
    private readonly configService: ConfigService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  @Cron('0 7 * * *')
  async runDailySnapshot(): Promise<void> {
    const configs = await this.configRepo.find({ where: { isEnabled: true } });
    this.logger.log(`Snapshot diario: ${configs.length} clientes`);
    const date = new Date().toISOString().split('T')[0];

    for (const config of configs) {
      try {
        const password = decrypt(config.encryptedPassword, this.encryptKey);
        const jobs = await this.veeamService.getJobStatuses(config.host, config.port, config.username, password);
        const rows = jobs.map(j => ({
          clientId: config.clientId,
          jobId: j.jobId,
          jobName: j.jobName,
          jobType: j.jobType,
          result: j.lastResult,
          message: j.lastMessage,
          lastRunAt: j.lastRunAt ? new Date(j.lastRunAt) : null,
          hoursAgo: j.hoursAgo,
          snapshotDate: date,
        }));
        await this.snapshotRepo.upsert(rows, ['clientId', 'jobId', 'snapshotDate']);
        this.logger.log(`Snapshot OK: clientId=${config.clientId} (${jobs.length} jobs)`);
      } catch (err) {
        this.logger.error(`Snapshot FAIL: clientId=${config.clientId} — ${(err as Error).message}`);
      }
    }
  }
}
```

- [ ] **Step 2: Registrar BackupsCron en BackupsModule**

En `backend/src/backups/backups.module.ts`, agregar `BackupsCron` al array `providers`:

```typescript
providers: [BackupsService, BackupsCron],
```

- [ ] **Step 3: Registrar BackupsModule en AppModule**

En `backend/src/app.module.ts`, agregar `BackupsModule` al array `imports`. Verificar que `ScheduleModule.forRoot()` ya está registrado (lo usa el cron de vencimientos); si no, agregarlo.

```typescript
import { BackupsModule } from './backups/backups.module';
// ...
imports: [
  // ... módulos existentes ...
  BackupsModule,
],
```

- [ ] **Step 4: Registrar entities en TypeORM config**

En el archivo donde se listan las entities para TypeORM (buscar `entities:` en `app.module.ts` o `typeorm.config.ts`), agregar:

```typescript
import { VeeamClientConfig } from './backups/entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './backups/entities/veeam-daily-snapshot.entity';
// Agregar al array entities: [..., VeeamClientConfig, VeeamDailySnapshot]
```

Y al array migrations:
```typescript
import { CreateVeeamClientConfigs1790000000000 } from './migrations/1790000000000-CreateVeeamClientConfigs';
import { CreateVeeamDailySnapshots1790100000000 } from './migrations/1790100000000-CreateVeeamDailySnapshots';
```

- [ ] **Step 5: Verificar que el backend compila y arranca**

```bash
cd backend && npm run start:dev
```
Verificar que no hay errores de compilación. Probar `GET /backups` (debe devolver `[]` si no hay configs).

- [ ] **Step 6: Commit**

```bash
git add backend/src/backups/backups.cron.ts backend/src/backups/backups.module.ts backend/src/app.module.ts
git commit -m "feat: BackupsCron diario a las 7am + registro en AppModule"
```

---

## Task 5: Frontend — Models + Service HTTP

**Files:**
- Create: `frontend/src/app/features/backups/models/backup.models.ts`
- Create: `frontend/src/app/features/backups/services/backups.service.ts`

**Interfaces:**
- Produces: `BackupsService` Angular con métodos usados en Tasks 6 y 7

- [ ] **Step 1: Crear modelos**

```typescript
// frontend/src/app/features/backups/models/backup.models.ts
export type BackupJobResult = 'Success' | 'Warning' | 'Failed';
export type ClientBackupStatus = 'ok' | 'warn' | 'crit' | 'no_data';

export interface BackupJobStatus {
  jobId: string;
  jobName: string;
  jobType: string;
  isRunning: boolean;
  lastResult: BackupJobResult | null;
  lastMessage: string | null;
  lastRunAt: string | null;
  hoursAgo: number | null;
  isStale: boolean;
}

export interface ClientBackup {
  clientId: string;
  clientName: string;
  status: ClientBackupStatus;
  totalJobs: number;
  okCount: number;
  warnCount: number;
  critCount: number;
  hasRunningJob: boolean;
  lastReadAt: string;
  jobs: BackupJobStatus[];
}

export interface VeeamClientConfig {
  id: string;
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  username: string;
  isEnabled: boolean;
  lastConnectedAt: string | null;
}

export interface CreateVeeamConfigRequest {
  clientId: string;
  host: string;
  port: number;
  username: string;
  password: string;
  isEnabled: boolean;
}

export interface UpdateVeeamConfigRequest {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  isEnabled?: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  jobCount?: number;
}
```

- [ ] **Step 2: Crear BackupsService Angular**

```typescript
// frontend/src/app/features/backups/services/backups.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { ClientBackup, VeeamClientConfig, CreateVeeamConfigRequest, UpdateVeeamConfigRequest, TestConnectionResult } from '../models/backup.models';

@Injectable({ providedIn: 'root' })
export class BackupsService {
  private readonly base = '/api/backups';

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<ClientBackup[]> {
    return this.http.get<ClientBackup[]>(this.base);
  }

  getOne(clientId: string): Observable<ClientBackup> {
    return this.http.get<ClientBackup>(`${this.base}/${clientId}`);
  }

  listConfigs(): Observable<VeeamClientConfig[]> {
    return this.http.get<VeeamClientConfig[]>(`${this.base}/configs`);
  }

  createConfig(dto: CreateVeeamConfigRequest): Observable<VeeamClientConfig> {
    return this.http.post<VeeamClientConfig>(`${this.base}/configs`, dto);
  }

  updateConfig(id: string, dto: UpdateVeeamConfigRequest): Observable<VeeamClientConfig> {
    return this.http.patch<VeeamClientConfig>(`${this.base}/configs/${id}`, dto);
  }

  deleteConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/configs/${id}`);
  }

  testConnection(id: string): Observable<TestConnectionResult> {
    return this.http.post<TestConnectionResult>(`${this.base}/configs/${id}/test`, {});
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/features/backups/models/ frontend/src/app/features/backups/services/
git commit -m "feat: modelos y servicio HTTP Angular para módulo backups"
```

---

## Task 6: Frontend — Vista /backups (componente principal + cards + drawer)

**Files:**
- Create: `frontend/src/app/features/backups/backups.module.ts`
- Create: `frontend/src/app/features/backups/backups-routing.module.ts`
- Create: `frontend/src/app/features/backups/backups.component.ts/html/scss/spec.ts`
- Create: `frontend/src/app/features/backups/components/backup-client-card/backup-client-card.component.ts/html/scss`
- Create: `frontend/src/app/features/backups/components/backup-client-drawer/backup-client-drawer.component.ts/html/scss`

**Interfaces:**
- Consumes: `BackupsService.getAll()`, `BackupsService.getOne()`
- Produce: vista `/backups` funcional con grid + drawer

**Referencia visual:** `docs/mockups/backups-v1.html` — respetar colores, estructura de KPI strip (`.kpi-strip`/`.kpi-block`), cards con borde izquierdo coloreado y drawer con tabla de jobs.

- [ ] **Step 1: Escribir test del componente principal (failing)**

```typescript
// frontend/src/app/features/backups/backups.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { BackupsComponent } from './backups.component';
import { BackupsService } from './services/backups.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';

const mockSvc = { getAll: jest.fn() };

describe('BackupsComponent', () => {
  let fixture: ComponentFixture<BackupsComponent>;
  let comp: BackupsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BackupsComponent],
      imports: [NoopAnimationsModule, MatProgressBarModule, MatSnackBarModule],
      providers: [{ provide: BackupsService, useValue: mockSvc }],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupsComponent);
    comp = fixture.componentInstance;
  });

  it('debería cargar clientes al init', () => {
    mockSvc.getAll.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(mockSvc.getAll).toHaveBeenCalled();
  });

  it('debería calcular KPI totales correctamente', () => {
    mockSvc.getAll.mockReturnValue(of([
      { status: 'ok', clientId: '1', clientName: 'A', totalJobs: 1, okCount: 1, warnCount: 0, critCount: 0, hasRunningJob: false, lastReadAt: '', jobs: [] },
      { status: 'warn', clientId: '2', clientName: 'B', totalJobs: 2, okCount: 1, warnCount: 1, critCount: 0, hasRunningJob: false, lastReadAt: '', jobs: [] },
      { status: 'crit', clientId: '3', clientName: 'C', totalJobs: 1, okCount: 0, warnCount: 0, critCount: 1, hasRunningJob: false, lastReadAt: '', jobs: [] },
    ]));
    fixture.detectChanges();
    expect(comp.kpi.total).toBe(3);
    expect(comp.kpi.ok).toBe(1);
    expect(comp.kpi.warn).toBe(1);
    expect(comp.kpi.crit).toBe(1);
  });

  it('seleccionar cliente abre el drawer', () => {
    mockSvc.getAll.mockReturnValue(of([]));
    fixture.detectChanges();
    const client = { clientId: 'x', clientName: 'X', status: 'ok' as const, totalJobs: 0, okCount: 0, warnCount: 0, critCount: 0, hasRunningJob: false, lastReadAt: '', jobs: [] };
    comp.selectClient(client);
    expect(comp.selectedClient).toBe(client);
    expect(comp.drawerOpen).toBe(true);
  });

  it('cerrar drawer limpia selectedClient', () => {
    mockSvc.getAll.mockReturnValue(of([]));
    fixture.detectChanges();
    comp.drawerOpen = true;
    comp.closeDrawer();
    expect(comp.drawerOpen).toBe(false);
    expect(comp.selectedClient).toBeNull();
  });
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
cd frontend && npx jest backups.component.spec --no-coverage
```

- [ ] **Step 3: Implementar BackupsComponent**

```typescript
// frontend/src/app/features/backups/backups.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BackupsService } from './services/backups.service';
import type { ClientBackup } from './models/backup.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-backups',
  templateUrl: './backups.component.html',
  styleUrl: './backups.component.scss',
})
export class BackupsComponent implements OnInit, OnDestroy {
  clients: ClientBackup[] = [];
  selectedClient: ClientBackup | null = null;
  drawerOpen = false;
  loading = false;
  kpi = { total: 0, ok: 0, warn: 0, crit: 0, noData: 0 };
  private sub?: Subscription;

  constructor(
    private readonly svc: BackupsService,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router,
    private readonly auth: AuthService,
  ) {}

  get isAdmin(): boolean { return this.auth.currentUser?.role === 'ADMIN'; }

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  load(): void {
    this.loading = true;
    this.sub = this.svc.getAll().subscribe({
      next: clients => {
        this.clients = clients;
        this.kpi = {
          total: clients.length,
          ok: clients.filter(c => c.status === 'ok').length,
          warn: clients.filter(c => c.status === 'warn').length,
          crit: clients.filter(c => c.status === 'crit').length,
          noData: clients.filter(c => c.status === 'no_data').length,
        };
        this.loading = false;
      },
      error: () => {
        this.snackBar.open('Error al cargar backups', 'Cerrar', { duration: 3000 });
        this.loading = false;
      },
    });
  }

  selectClient(client: ClientBackup): void {
    this.selectedClient = client;
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.selectedClient = null;
  }

  openConfig(): void { this.router.navigate(['/admin/backups']); }
}
```

- [ ] **Step 4: Implementar template y estilos**

El template y scss deben replicar `docs/mockups/backups-v1.html`:
- Nav-bar con título "Backups", botón "Actualizar", ícono engranaje (`*ngIf="isAdmin"`)
- KPI strip con clases `.kpi-strip` / `.kpi-block` / `.kpi-label` / `.kpi-val`
- Grid de `app-backup-client-card` con `*ngFor="let client of clients"`
- `app-backup-client-drawer` con `[client]="selectedClient"` y `(closed)="closeDrawer()"`

Para los estilos del KPI strip, copiar exactamente desde `frontend/src/styles/components.scss` el patrón de `.kpi-strip` que ya usan tasks y notifications. Si no existe como clase global, definirlo en el `scss` del componente.

- [ ] **Step 5: Implementar BackupClientCardComponent**

```typescript
// frontend/src/app/features/backups/components/backup-client-card/backup-client-card.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import type { ClientBackup } from '../../models/backup.models';

@Component({
  selector: 'app-backup-client-card',
  templateUrl: './backup-client-card.component.html',
  styleUrl: './backup-client-card.component.scss',
})
export class BackupClientCardComponent {
  @Input() client!: ClientBackup;
  @Input() selected = false;
  @Output() cardClick = new EventEmitter<ClientBackup>();

  get statusClass(): string {
    return `st-${this.client.status.replace('_', '-')}`;
  }
}
```

El template muestra: nombre cliente, dot de estado, chips ok/warn/crit, meta "N jobs · hace Xh", badge "N activo" si `hasRunningJob`. Ver mockup para estructura exacta.

- [ ] **Step 6: Implementar BackupClientDrawerComponent**

```typescript
// frontend/src/app/features/backups/components/backup-client-drawer/backup-client-drawer.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import type { ClientBackup, BackupJobStatus } from '../../models/backup.models';

@Component({
  selector: 'app-backup-client-drawer',
  templateUrl: './backup-client-drawer.component.html',
  styleUrl: './backup-client-drawer.component.scss',
})
export class BackupClientDrawerComponent {
  @Input() client: ClientBackup | null = null;
  @Input() open = false;
  @Output() closed = new EventEmitter<void>();

  get jobs(): BackupJobStatus[] { return this.client?.jobs ?? []; }

  resultClass(result: string | null): string {
    if (result === 'Success') return 'chip--ok';
    if (result === 'Warning') return 'chip--warn';
    if (result === 'Failed') return 'chip--crit';
    return 'chip--neutral';
  }

  hoursClass(job: BackupJobStatus): string {
    return job.isStale ? 'hours--stale' : '';
  }
}
```

El template muestra header (ícono + nombre cliente + botón cerrar), pills de resumen (N Success · N Warning), tabla de jobs con columnas Job / Estado / Resultado / Hace, y el mensaje de warning/error debajo de cada job que lo tenga. Ver mockup sección drawer.

- [ ] **Step 7: Crear BackupsModule y routing**

```typescript
// frontend/src/app/features/backups/backups-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BackupsComponent } from './backups.component';

const routes: Routes = [{ path: '', component: BackupsComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BackupsRoutingModule {}
```

```typescript
// frontend/src/app/features/backups/backups.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BackupsRoutingModule } from './backups-routing.module';
import { BackupsComponent } from './backups.component';
import { BackupClientCardComponent } from './components/backup-client-card/backup-client-card.component';
import { BackupClientDrawerComponent } from './components/backup-client-drawer/backup-client-drawer.component';

@NgModule({
  declarations: [BackupsComponent, BackupClientCardComponent, BackupClientDrawerComponent],
  imports: [CommonModule, BackupsRoutingModule, MatProgressBarModule, MatSnackBarModule, MatButtonModule, MatTooltipModule],
})
export class BackupsModule {}
```

- [ ] **Step 8: Correr tests — deben pasar**

```bash
cd frontend && npx jest backups --no-coverage
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/features/backups/
git commit -m "feat: vista /backups — grid de clientes y drawer de detalle"
```

---

## Task 7: Admin — Pestaña Backups Config

**Files:**
- Create: `frontend/src/app/features/admin/backups-config/backups-config.component.ts/html/scss/spec.ts`
- Create: `frontend/src/app/features/admin/backups-config/backups-config-dialog/backups-config-dialog.component.ts/html/spec.ts`
- Modify: `frontend/src/app/features/admin/admin-layout/admin-layout.component.ts`
- Modify: `frontend/src/app/features/admin/admin-routing.module.ts`
- Modify: `frontend/src/app/features/admin/admin.module.ts`

**Interfaces:**
- Consumes: `BackupsService.listConfigs()`, `createConfig()`, `updateConfig()`, `deleteConfig()`, `testConnection()`

- [ ] **Step 1: Escribir test (failing)**

```typescript
// frontend/src/app/features/admin/backups-config/backups-config.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { BackupsConfigComponent } from './backups-config.component';
import { BackupsService } from '../../../features/backups/services/backups.service';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

const mockSvc = { listConfigs: jest.fn(), deleteConfig: jest.fn(), testConnection: jest.fn() };

describe('BackupsConfigComponent', () => {
  let fixture: ComponentFixture<BackupsConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BackupsConfigComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatSnackBarModule, MatTableModule],
      providers: [{ provide: BackupsService, useValue: mockSvc }],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupsConfigComponent);
  });

  it('debería cargar configs al init', () => {
    mockSvc.listConfigs.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(mockSvc.listConfigs).toHaveBeenCalled();
  });

  it('testConnection debería mostrar resultado en snackBar', () => {
    mockSvc.listConfigs.mockReturnValue(of([]));
    mockSvc.testConnection.mockReturnValue(of({ success: true, message: 'Conectado. 12 jobs.' }));
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const snackSpy = jest.spyOn((comp as any).snackBar, 'open');
    comp.testConnection({ id: 'x' } as any);
    expect(snackSpy).toHaveBeenCalledWith('Conectado. 12 jobs.', 'Cerrar', expect.any(Object));
  });
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
cd frontend && npx jest backups-config.component.spec --no-coverage
```

- [ ] **Step 3: Implementar BackupsConfigComponent**

Tabla mat-table con columnas: Cliente · Host · Puerto · Usuario · Habilitado · Acciones (Probar / Editar / Eliminar).
Botón "Agregar cliente" abre `BackupsConfigDialogComponent`.

```typescript
// frontend/src/app/features/admin/backups-config/backups-config.component.ts
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BackupsService } from '../../../features/backups/services/backups.service';
import { BackupsConfigDialogComponent } from './backups-config-dialog/backups-config-dialog.component';
import type { VeeamClientConfig } from '../../../features/backups/models/backup.models';

@Component({
  selector: 'app-backups-config',
  templateUrl: './backups-config.component.html',
  styleUrl: './backups-config.component.scss',
})
export class BackupsConfigComponent implements OnInit {
  configs: VeeamClientConfig[] = [];
  loading = false;
  readonly displayedColumns = ['clientName', 'host', 'port', 'username', 'isEnabled', 'actions'];

  constructor(
    private readonly svc: BackupsService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.svc.listConfigs().subscribe({
      next: configs => { this.configs = configs; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openDialog(config?: VeeamClientConfig): void {
    this.dialog.open(BackupsConfigDialogComponent, { data: config ?? null, width: '520px' })
      .afterClosed().subscribe(saved => { if (saved) this.load(); });
  }

  testConnection(config: VeeamClientConfig): void {
    this.svc.testConnection(config.id).subscribe(result => {
      this.snackBar.open(result.message, 'Cerrar', { duration: 5000 });
    });
  }

  delete(config: VeeamClientConfig): void {
    if (!confirm(`¿Eliminar configuración de ${config.clientName || config.host}?`)) return;
    this.svc.deleteConfig(config.id).subscribe(() => this.load());
  }
}
```

- [ ] **Step 4: Implementar BackupsConfigDialogComponent**

Formulario reactivo con campos: selector de cliente (mat-select), host (input), puerto (input, default 9419), usuario (input), contraseña (input type=password), habilitado (mat-checkbox). Botón "Guardar" llama `createConfig` o `updateConfig` según si tiene `data.id`.

- [ ] **Step 5: Agregar pestaña al AdminLayout**

En `admin-layout.component.ts`, agregar al array `tabs`:
```typescript
{ path: '/admin/backups', label: 'Backups' },
```

- [ ] **Step 6: Agregar ruta al AdminRouting**

En `admin-routing.module.ts`:
```typescript
import { BackupsConfigComponent } from './backups-config/backups-config.component';
// En el array children:
{ path: 'backups', component: BackupsConfigComponent },
```

- [ ] **Step 7: Declarar en AdminModule**

En `admin.module.ts`, agregar `BackupsConfigComponent` y `BackupsConfigDialogComponent` a `declarations`, y los módulos Angular Material necesarios a `imports`: `MatTableModule`, `MatDialogModule`, `MatCheckboxModule`, `MatSelectModule`.

- [ ] **Step 8: Correr tests — deben pasar**

```bash
cd frontend && npx jest backups-config --no-coverage
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/features/admin/backups-config/ frontend/src/app/features/admin/admin-layout/ frontend/src/app/features/admin/admin-routing.module.ts frontend/src/app/features/admin/admin.module.ts
git commit -m "feat: Admin → pestaña Backups para gestión de configs Veeam por cliente"
```

---

## Task 8: Routing + Sidebar — Wiring Final

**Files:**
- Modify: `frontend/src/app/app-routing.module.ts`
- Modify: `frontend/src/app/core/shell/shell.component.ts`
- Modify: `frontend/src/app/core/shell/shell.component.html` (agregar SVG icon para backups)

- [ ] **Step 1: Agregar ruta /backups en AppRoutingModule**

En `frontend/src/app/app-routing.module.ts`, dentro del array `children` del ShellComponent, agregar:

```typescript
{
  path: 'backups',
  loadChildren: () =>
    import('./features/backups/backups.module').then(m => m.BackupsModule),
},
```

- [ ] **Step 2: Agregar backups a navItems del shell**

En `frontend/src/app/core/shell/shell.component.ts`, agregar al array `navItems` después de `notifications`:

```typescript
{ route: '/backups', label: 'Backups', icon: 'backups' },
```

- [ ] **Step 3: Agregar SVG del ícono backups en el shell template**

En `shell.component.html`, donde se itera `navItems` y se renderiza el SVG por `item.icon`, agregar el case `backups`:

```html
<svg *ngIf="item.icon === 'backups'" viewBox="0 0 24 24"
     style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="17 8 12 3 7 8"/>
  <line x1="12" y1="3" x2="12" y2="15"/>
</svg>
```

- [ ] **Step 4: Build y verificación manual**

```bash
cd frontend && npm run build
```
Sin errores de compilación. Luego `npm start` y verificar:
- `/backups` carga y muestra la página (lista vacía si no hay configs)
- El ícono en el sidebar navega correctamente
- `/admin/backups` muestra la tabla de configs (vacía inicialmente)
- El botón engranaje en `/backups` navega a `/admin/backups`
- Agregar una config en Admin → Probar conexión → debe mostrar resultado en snackbar

- [ ] **Step 5: Commit final**

```bash
git add frontend/src/app/app-routing.module.ts frontend/src/app/core/shell/
git commit -m "feat: routing y sidebar para módulo /backups"
```

---

## Notas para el implementador

**Collector script:** `collectors/veeam/veeam_backup.py` existe como spike de prueba. No borrarlo — sirve para debuggear conexiones a clientes nuevos desde la línea de comandos.

**SSL:** La API de Veeam usa certificados autofirmados. En el `VeeamService` NestJS se deshabilita la verificación TLS con `httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })`. Esto es intencional y está documentado.

**Nombres de cliente:** En `BackupsService.getClientStatus()` el `clientName` queda vacío — hay que cruzarlo con el repositorio de `clients` o recibirlo del frontend. Evaluar en implementación si conviene joinear en DB o recibir el nombre en el DTO de creación de config.

**Ruta del controller:** NestJS puede tener colisión entre `GET /backups/configs` y `GET /backups/:clientId` si `:clientId` captura "configs". Resolver registrando la ruta `/configs` antes que `/:clientId` en el controller, o usando un prefijo distinto como `/backups/admin/configs`.
