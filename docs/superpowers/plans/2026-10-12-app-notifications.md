# App Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un sistema de notificaciones in-app por usuario que avisa cuando el cron de vencimientos crea tickets en Odoo — campana en el toolbar con badge, panel con lista descartable, polling cada 60s.

**Architecture:** Dos tablas nuevas (`app_notifications`, `user_notification_reads`) con módulo NestJS dedicado. `ExpirationTicketsService` llama a `AppNotificationsService.create()` fire-and-forget después de crear cada ticket. Frontend: servicio Angular con BehaviorSubject + polling via `interval`, `NotificationBellComponent` en el toolbar del shell.

**Tech Stack:** NestJS + TypeORM (backend) · Angular 17 + Angular Material (`MatBadgeModule`, `MatMenuModule`) · RxJS `interval/switchMap/startWith` · Jest + HttpClientTestingModule

**Spec:** `docs/superpowers/specs/2026-10-12-app-notifications-design.md`

## Global Constraints

- Sin standalone components Angular (regla del proyecto — usar NgModule)
- Todo elemento interactivo via Angular Material — sin `<button>` nativos
- Sin `::ng-deep` en componentes — estilos de overlay de `mat-menu` van en `styles/components.scss` global
- Sin cachear datos de InfraDoc en DB (no aplica a este módulo, pero mantener para contexto)
- `appearance="outline"` en todos los `mat-form-field` (no hay form fields en este módulo)
- TDD: test antes de implementación en cada tarea
- Un archivo a la vez, confirmar entre tareas
- Idioma del código: inglés · commits: español

## Review Focus

- **`PATCH /read-all` antes de `PATCH /:id/read`** en el controller: NestJS resuelve rutas en orden de declaración; si `:id/read` va primero, `read-all` se interpreta como el id `read-all` y falla el 404. Verificar que `markAllAsRead` esté declarado antes de `markAsRead` en el controller. → Test en Task 2: verificar que `PATCH /read-all` no lanza `NotFoundException`.
- **Optimistic update en frontend**: `markAsRead` y `markAllAsRead` actualizan el BehaviorSubject local antes de recibir confirmación del servidor. Si el request falla, el estado se restaura en el próximo poll (60s). → Test en Task 4: verificar que el subject se actualiza inmediatamente sin esperar la respuesta HTTP.
- **`startWith(0)` en el polling**: la primera request se dispara sincrónicamente al llamar `startPolling()`. Llamar `startPolling()` dos veces no debe crear dos suscripciones. → Test en Task 4: verificar que la segunda llamada a `startPolling()` no genera una segunda request.
- **Fire-and-forget de notificación**: si `appNotificationsService.create()` falla en `ExpirationTicketsService`, el ticket de Odoo ya fue creado y no debe fallar el flujo principal. El error se loggea pero no se relanza. → Test en Task 3: verificar que un error en `create()` no propaga excepción en `createTicketWithTask()`.
- **Panel mat-menu no se cierra al hacer dismiss**: el contenido dentro del `mat-menu` que no es `mat-menu-item` no cierra el menu automáticamente. Los botones de dismiss y "Limpiar todo" deben tener `(click)="$event.stopPropagation()"` en el wrapper padre para evitar que el menu se cierre accidentalmente. → Test en Task 5: verificar que `dismiss()` llama `markAsRead()` con el id correcto (el comportamiento de cierre se verifica manualmente).

---

## Task 1: Migración y entidades backend

**Files:**
- Create: `backend/src/migrations/1790800000000-CreateAppNotifications.ts`
- Create: `backend/src/app-notifications/app-notification.entity.ts`
- Create: `backend/src/app-notifications/user-notification-read.entity.ts`

**Interfaces:**
- Produces:
  - `AppNotification` entity con campos: `id: string`, `type: string`, `payload: Record<string, unknown>`, `createdAt: Date`
  - `UserNotificationRead` entity con campos: `id: string`, `userId: string`, `notificationId: string`, `readAt: Date`

- [ ] **Step 1: Crear la migración**

```typescript
// backend/src/migrations/1790800000000-CreateAppNotifications.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppNotifications1790800000000 implements MigrationInterface {
  name = 'CreateAppNotifications1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "app_notifications" (
        "id"        uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "type"      varchar     NOT NULL,
        "payload"   jsonb       NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "user_notification_reads" (
        "id"             uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "userId"         uuid        NOT NULL,
        "notificationId" uuid        NOT NULL,
        "readAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_notification_reads" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_notification_reads" UNIQUE ("userId", "notificationId"),
        CONSTRAINT "FK_unr_user" FOREIGN KEY ("userId")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_unr_notification" FOREIGN KEY ("notificationId")
          REFERENCES "app_notifications" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_notification_reads"`);
    await queryRunner.query(`DROP TABLE "app_notifications"`);
  }
}
```

- [ ] **Step 2: Crear entidad AppNotification**

```typescript
// backend/src/app-notifications/app-notification.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('app_notifications')
export class AppNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
```

- [ ] **Step 3: Crear entidad UserNotificationRead**

```typescript
// backend/src/app-notifications/user-notification-read.entity.ts
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('user_notification_reads')
@Unique(['userId', 'notificationId'])
export class UserNotificationRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  notificationId: string;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  readAt: Date;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/migrations/1790800000000-CreateAppNotifications.ts \
        backend/src/app-notifications/app-notification.entity.ts \
        backend/src/app-notifications/user-notification-read.entity.ts
git commit -m "feat: entidades y migración app_notifications + user_notification_reads"
```

---

## Task 2: AppNotificationsModule — service, controller, módulo y registro

**Files:**
- Create: `backend/src/app-notifications/dto/app-notification.dto.ts`
- Create: `backend/src/app-notifications/app-notifications.service.ts`
- Create: `backend/src/app-notifications/app-notifications.service.spec.ts`
- Create: `backend/src/app-notifications/app-notifications.controller.ts`
- Create: `backend/src/app-notifications/app-notifications.controller.spec.ts`
- Create: `backend/src/app-notifications/app-notifications.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `AppNotification` y `UserNotificationRead` de Task 1
- Produces:
  - `AppNotificationsService.create(type: string, payload: Record<string, unknown>): Promise<AppNotification>`
  - `AppNotificationsService.getUnreadForUser(userId: string): Promise<AppNotification[]>`
  - `AppNotificationsService.markAsRead(userId: string, notificationId: string): Promise<void>`
  - `AppNotificationsService.markAllAsRead(userId: string): Promise<void>`
  - Endpoints: `GET /app-notifications`, `PATCH /app-notifications/read-all`, `PATCH /app-notifications/:id/read`

- [ ] **Step 1: Crear DTO de respuesta**

```typescript
// backend/src/app-notifications/dto/app-notification.dto.ts
export class AppNotificationPayloadDto {
  clientName?: string;
  expirationType?: string;
  itemName?: string;
  daysUntil?: number;
  odooTicketId?: number;
}

export class AppNotificationResponseDto {
  id: string;
  type: string;
  payload: AppNotificationPayloadDto;
  createdAt: Date;
}
```

- [ ] **Step 2: Escribir los tests del service**

```typescript
// backend/src/app-notifications/app-notifications.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotification } from './app-notification.entity';
import { UserNotificationRead } from './user-notification-read.entity';

const makeQb = (getMany: any[] = []) => {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getMany),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  return qb;
};

const makeNotif = (id: string) => ({
  id, type: 'EXPIRATION_TICKET_CREATED',
  payload: { clientName: 'ACME' }, createdAt: new Date(),
});

describe('AppNotificationsService', () => {
  let service: AppNotificationsService;
  let notifRepo: { save: jest.Mock; findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let readRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    notifRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    readRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppNotificationsService,
        { provide: getRepositoryToken(AppNotification), useValue: notifRepo },
        { provide: getRepositoryToken(UserNotificationRead), useValue: readRepo },
      ],
    }).compile();

    service = module.get<AppNotificationsService>(AppNotificationsService);
  });

  describe('create', () => {
    it('persiste tipo y payload y devuelve la notificación guardada', async () => {
      const saved = makeNotif('n-1');
      notifRepo.save.mockResolvedValue(saved);

      const result = await service.create('EXPIRATION_TICKET_CREATED', { clientName: 'ACME' });

      expect(notifRepo.save).toHaveBeenCalledWith({
        type: 'EXPIRATION_TICKET_CREATED',
        payload: { clientName: 'ACME' },
      });
      expect(result).toEqual(saved);
    });
  });

  describe('getUnreadForUser', () => {
    it('devuelve las notificaciones del QueryBuilder para el userId dado', async () => {
      const notifications = [makeNotif('n-1')];
      const qb = makeQb(notifications);
      notifRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getUnreadForUser('user-1');

      expect(notifRepo.createQueryBuilder).toHaveBeenCalledWith('n');
      expect(qb.where).toHaveBeenCalledWith('unr.id IS NULL');
      expect(result).toEqual(notifications);
    });

    it('devuelve array vacío si no hay no leídas', async () => {
      notifRepo.createQueryBuilder.mockReturnValue(makeQb([]));
      expect(await service.getUnreadForUser('user-1')).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('lanza NotFoundException si la notificación no existe', async () => {
      notifRepo.findOne.mockResolvedValue(null);
      await expect(service.markAsRead('user-1', 'n-missing')).rejects.toThrow(NotFoundException);
    });

    it('inserta la lectura cuando la notificación existe', async () => {
      notifRepo.findOne.mockResolvedValue({ id: 'n-1' });
      const qb = makeQb();
      readRepo.createQueryBuilder.mockReturnValue(qb);

      await service.markAsRead('user-1', 'n-1');

      expect(qb.values).toHaveBeenCalledWith({ userId: 'user-1', notificationId: 'n-1' });
      expect(qb.orIgnore).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('no inserta nada si no hay no leídas', async () => {
      notifRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      await service.markAllAsRead('user-1');

      expect(readRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('inserta una fila por cada notificación no leída', async () => {
      const notifications = [makeNotif('n-1'), makeNotif('n-2')];
      notifRepo.createQueryBuilder.mockReturnValue(makeQb(notifications));
      const qb = makeQb();
      readRepo.createQueryBuilder.mockReturnValue(qb);

      await service.markAllAsRead('user-1');

      expect(qb.values).toHaveBeenCalledWith([
        { userId: 'user-1', notificationId: 'n-1' },
        { userId: 'user-1', notificationId: 'n-2' },
      ]);
      expect(qb.orIgnore).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Ejecutar tests — deben fallar (el service no existe aún)**

```bash
cd backend && npx jest app-notifications.service.spec --no-coverage
```

Expected: FAIL — `Cannot find module './app-notifications.service'`

- [ ] **Step 4: Implementar AppNotificationsService**

```typescript
// backend/src/app-notifications/app-notifications.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppNotification } from './app-notification.entity';
import { UserNotificationRead } from './user-notification-read.entity';

@Injectable()
export class AppNotificationsService {
  constructor(
    @InjectRepository(AppNotification)
    private readonly notifRepo: Repository<AppNotification>,
    @InjectRepository(UserNotificationRead)
    private readonly readRepo: Repository<UserNotificationRead>,
  ) {}

  async create(type: string, payload: Record<string, unknown>): Promise<AppNotification> {
    return this.notifRepo.save({ type, payload });
  }

  async getUnreadForUser(userId: string): Promise<AppNotification[]> {
    return this.notifRepo
      .createQueryBuilder('n')
      .leftJoin(
        UserNotificationRead,
        'unr',
        'unr."notificationId" = n.id AND unr."userId" = :userId',
        { userId },
      )
      .where('unr.id IS NULL')
      .orderBy('n."createdAt"', 'DESC')
      .getMany();
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const exists = await this.notifRepo.findOne({ where: { id: notificationId } });
    if (!exists) throw new NotFoundException(`Notification ${notificationId} not found`);
    await this.readRepo
      .createQueryBuilder()
      .insert()
      .into(UserNotificationRead)
      .values({ userId, notificationId })
      .orIgnore()
      .execute();
  }

  async markAllAsRead(userId: string): Promise<void> {
    const unread = await this.getUnreadForUser(userId);
    if (unread.length === 0) return;
    await this.readRepo
      .createQueryBuilder()
      .insert()
      .into(UserNotificationRead)
      .values(unread.map(n => ({ userId, notificationId: n.id })))
      .orIgnore()
      .execute();
  }
}
```

- [ ] **Step 5: Ejecutar tests — deben pasar**

```bash
cd backend && npx jest app-notifications.service.spec --no-coverage
```

Expected: PASS (todos los tests en verde)

- [ ] **Step 6: Escribir los tests del controller**

```typescript
// backend/src/app-notifications/app-notifications.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppNotificationsController } from './app-notifications.controller';
import { AppNotificationsService } from './app-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const mockUser = {
  sub: 'user-uuid-1',
  email: 'user@ondra.com.ar',
  role: 'TECHNICIAN',
  mustChangePassword: false,
};

const mockService = {
  getUnreadForUser: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
};

describe('AppNotificationsController', () => {
  let controller: AppNotificationsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppNotificationsController],
      providers: [{ provide: AppNotificationsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .compile();
    controller = module.get<AppNotificationsController>(AppNotificationsController);
  });

  it('GET / llama getUnreadForUser con el sub del JWT', async () => {
    const notifs = [{ id: 'n-1', type: 'EXPIRATION_TICKET_CREATED', payload: {}, createdAt: new Date() }];
    mockService.getUnreadForUser.mockResolvedValue(notifs);

    const result = await controller.getUnread(mockUser as any);

    expect(mockService.getUnreadForUser).toHaveBeenCalledWith('user-uuid-1');
    expect(result).toEqual(notifs);
  });

  it('PATCH /read-all llama markAllAsRead con el sub del JWT', async () => {
    mockService.markAllAsRead.mockResolvedValue(undefined);

    await controller.markAllAsRead(mockUser as any);

    expect(mockService.markAllAsRead).toHaveBeenCalledWith('user-uuid-1');
  });

  it('PATCH /:id/read llama markAsRead con sub del JWT e id de la ruta', async () => {
    mockService.markAsRead.mockResolvedValue(undefined);

    await controller.markAsRead('n-42', mockUser as any);

    expect(mockService.markAsRead).toHaveBeenCalledWith('user-uuid-1', 'n-42');
  });

  it('PATCH /read-all no lanza NotFoundException — la ruta literal tiene precedencia sobre :id', async () => {
    mockService.markAllAsRead.mockResolvedValue(undefined);

    await expect(controller.markAllAsRead(mockUser as any)).resolves.not.toThrow();
  });

  it('tiene JwtAuthGuard aplicado', () => {
    const guards = Reflect.getMetadata('__guards__', AppNotificationsController);
    expect(guards).toContain(JwtAuthGuard);
  });
});
```

- [ ] **Step 7: Ejecutar tests del controller — deben fallar**

```bash
cd backend && npx jest app-notifications.controller.spec --no-coverage
```

Expected: FAIL — `Cannot find module './app-notifications.controller'`

- [ ] **Step 8: Implementar el controller**

IMPORTANTE: `read-all` DEBE declararse ANTES de `:id/read` para que NestJS lo resuelva como ruta literal.

```typescript
// backend/src/app-notifications/app-notifications.controller.ts
import { Controller, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotification } from './app-notification.entity';

@Controller('app-notifications')
@UseGuards(JwtAuthGuard)
export class AppNotificationsController {
  constructor(private readonly service: AppNotificationsService) {}

  @Get()
  getUnread(@CurrentUser() user: JwtPayload): Promise<AppNotification[]> {
    return this.service.getUnreadForUser(user.sub);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllAsRead(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.service.markAllAsRead(user.sub);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.service.markAsRead(user.sub, id);
  }
}
```

- [ ] **Step 9: Ejecutar tests del controller — deben pasar**

```bash
cd backend && npx jest app-notifications.controller.spec --no-coverage
```

Expected: PASS

- [ ] **Step 10: Crear el módulo y registrar en AppModule**

```typescript
// backend/src/app-notifications/app-notifications.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppNotification } from './app-notification.entity';
import { UserNotificationRead } from './user-notification-read.entity';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotificationsController } from './app-notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AppNotification, UserNotificationRead])],
  controllers: [AppNotificationsController],
  providers: [AppNotificationsService],
  exports: [AppNotificationsService],
})
export class AppNotificationsModule {}
```

Agregar `AppNotificationsModule` al array `imports` de `backend/src/app.module.ts`:

```typescript
// backend/src/app.module.ts — agregar import al top y al array
import { AppNotificationsModule } from './app-notifications/app-notifications.module';

// En @Module({ imports: [...] }):
AppNotificationsModule,
```

- [ ] **Step 11: Ejecutar todos los tests del backend — no deben romperse tests existentes**

```bash
cd backend && npx jest --no-coverage
```

Expected: todos en verde

- [ ] **Step 12: Commit**

```bash
git add backend/src/app-notifications/ backend/src/app.module.ts
git commit -m "feat: AppNotificationsModule — service, controller, módulo y registro en AppModule"
```

---

## Task 3: Integración con ExpirationTicketsService

**Files:**
- Modify: `backend/src/notifications/expiration-tickets.service.ts`
- Modify: `backend/src/notifications/expiration-tickets.service.spec.ts`
- Modify: `backend/src/notifications/notifications.module.ts`

**Interfaces:**
- Consumes: `AppNotificationsService.create(type, payload)` de Task 2
- Produces: después de cada ticket creado exitosamente, se inserta una `AppNotification` de tipo `EXPIRATION_TICKET_CREATED`

- [ ] **Step 1: Agregar test de integración al spec existente**

En `backend/src/notifications/expiration-tickets.service.spec.ts`, agregar al setup del módulo el mock de `AppNotificationsService` y los tests correspondientes.

En el bloque `beforeEach`, agregar a las variables declaradas:
```typescript
let appNotificationsService: { create: jest.Mock };
```

En el cuerpo del `beforeEach`, agregar:
```typescript
appNotificationsService = { create: jest.fn().mockResolvedValue({ id: 'notif-1' }) };
```

En `Test.createTestingModule({ providers: [...] })`, agregar:
```typescript
{ provide: AppNotificationsService, useValue: appNotificationsService },
```

Agregar el import al top del spec:
```typescript
import { AppNotificationsService } from '../app-notifications/app-notifications.service';
```

Agregar en el `describe('createPendingExpirationTickets')` (o crear describe nuevo si no existe):
```typescript
it('llama appNotificationsService.create con los datos del ticket creado', async () => {
  const item = makeItem({ type: 'domain', clientId: 1 });
  notificationsService.getExpirations.mockResolvedValue([item]);
  clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1', infradocId: 1 });
  odooService.createExpirationTicket.mockResolvedValue(999);
  ticketRepo.save.mockResolvedValue({ id: 'ticket-row-1' });
  tasksService.createFromExistingTicket.mockResolvedValue({ id: 'task-1' });

  await service.createPendingExpirationTickets();

  expect(appNotificationsService.create).toHaveBeenCalledWith(
    'EXPIRATION_TICKET_CREATED',
    expect.objectContaining({
      clientName: item.clientName,
      expirationType: item.type,
      itemName: item.itemName,
      daysUntil: item.daysUntil,
      odooTicketId: 999,
    }),
  );
});

it('no propaga la excepción si appNotificationsService.create falla', async () => {
  const item = makeItem({ type: 'domain', clientId: 1 });
  notificationsService.getExpirations.mockResolvedValue([item]);
  clientRepo.findOne.mockResolvedValue({ id: 'client-uuid-1', infradocId: 1 });
  odooService.createExpirationTicket.mockResolvedValue(999);
  ticketRepo.save.mockResolvedValue({ id: 'ticket-row-1' });
  tasksService.createFromExistingTicket.mockResolvedValue({ id: 'task-1' });
  appNotificationsService.create.mockRejectedValue(new Error('DB error'));

  await expect(service.createPendingExpirationTickets()).resolves.not.toThrow();
});
```

- [ ] **Step 2: Ejecutar el spec — los tests nuevos deben fallar**

```bash
cd backend && npx jest expiration-tickets.service.spec --no-coverage
```

Expected: los tests nuevos fallan, los existentes siguen en verde

- [ ] **Step 3: Modificar ExpirationTicketsService para inyectar AppNotificationsService**

En `backend/src/notifications/expiration-tickets.service.ts`:

Agregar import:
```typescript
import { AppNotificationsService } from '../app-notifications/app-notifications.service';
```

Agregar al constructor (después de `TasksService`):
```typescript
private readonly appNotificationsService: AppNotificationsService,
```

En el método privado `createTicketWithTask`, después de la línea `const odooTicketId = await this.odooService.createExpirationTicket(...)` y antes del bloque que guarda en el repo, agregar:

```typescript
try {
  await this.appNotificationsService.create('EXPIRATION_TICKET_CREATED', {
    clientName: item.clientName,
    expirationType: item.type,
    itemName: item.itemName,
    daysUntil: item.daysUntil,
    odooTicketId,
  });
} catch (err: unknown) {
  this.logger.error(
    `Notificación fallida para ticket ${odooTicketId}: ${(err as Error).message}`,
  );
}
```

- [ ] **Step 4: Actualizar NotificationsModule para importar AppNotificationsModule**

En `backend/src/notifications/notifications.module.ts`, agregar:

```typescript
import { AppNotificationsModule } from '../app-notifications/app-notifications.module';

// En imports del @Module:
AppNotificationsModule,
```

- [ ] **Step 5: Ejecutar el spec completo — todos los tests deben pasar**

```bash
cd backend && npx jest expiration-tickets.service.spec --no-coverage
```

Expected: PASS (todos los tests, incluyendo los nuevos)

- [ ] **Step 6: Ejecutar toda la suite backend**

```bash
cd backend && npx jest --no-coverage
```

Expected: todos en verde

- [ ] **Step 7: Commit**

```bash
git add backend/src/notifications/expiration-tickets.service.ts \
        backend/src/notifications/expiration-tickets.service.spec.ts \
        backend/src/notifications/notifications.module.ts
git commit -m "feat: ExpirationTicketsService dispara AppNotification al crear ticket de vencimiento"
```

---

## Task 4: Frontend — modelo y AppNotificationsService

**Files:**
- Create: `frontend/src/app/core/models/app-notification.models.ts`
- Create: `frontend/src/app/core/services/app-notifications.service.ts`
- Create: `frontend/src/app/core/services/app-notifications.service.spec.ts`

**Interfaces:**
- Produces:
  - `AppNotification` interface con campos: `id: string`, `type: string`, `payload: AppNotificationPayload`, `createdAt: string`
  - `AppNotificationsService.notifications: Observable<AppNotification[]>` (getter)
  - `AppNotificationsService.unreadCount$: Observable<number>`
  - `AppNotificationsService.startPolling(): void`
  - `AppNotificationsService.stopPolling(): void`
  - `AppNotificationsService.markAsRead(id: string): void`
  - `AppNotificationsService.markAllAsRead(): void`

- [ ] **Step 1: Crear el modelo**

```typescript
// frontend/src/app/core/models/app-notification.models.ts
export interface AppNotificationPayload {
  clientName?: string;
  expirationType?: string;
  itemName?: string;
  daysUntil?: number;
  odooTicketId?: number;
}

export interface AppNotification {
  id: string;
  type: string;
  payload: AppNotificationPayload;
  createdAt: string;
}
```

- [ ] **Step 2: Escribir los tests del service frontend**

```typescript
// frontend/src/app/core/services/app-notifications.service.spec.ts
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotification } from '../models/app-notification.models';
import { environment } from '../../../environments/environment';

const makeNotif = (id: string): AppNotification => ({
  id,
  type: 'EXPIRATION_TICKET_CREATED',
  payload: { clientName: 'ACME', expirationType: 'domain', itemName: 'acme.com', daysUntil: 5, odooTicketId: 100 },
  createdAt: '2026-10-12T08:00:00Z',
});

describe('AppNotificationsService', () => {
  let service: AppNotificationsService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/app-notifications`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AppNotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopPolling();
    httpMock.verify();
  });

  it('emite la lista recibida al iniciar el polling (primera request inmediata)', fakeAsync(() => {
    const notifications = [makeNotif('n-1')];
    service.startPolling();

    httpMock.expectOne(url).flush(notifications);

    let result: AppNotification[] | undefined;
    service.notifications.subscribe(n => (result = n));
    expect(result).toEqual(notifications);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
  }));

  it('no lanza un segundo polling si startPolling ya está activo', fakeAsync(() => {
    service.startPolling();
    service.startPolling();

    const reqs = httpMock.match(url);
    expect(reqs.length).toBe(1);
    reqs[0].flush([]);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
  }));

  it('stopPolling detiene las requests periódicas', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).flush([]);
    service.stopPolling();

    tick(60_000);
    httpMock.expectNone(url);
  }));

  it('markAsRead filtra la notificación del subject local antes de recibir respuesta HTTP', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).flush([makeNotif('n-1'), makeNotif('n-2')]);

    service.markAsRead('n-1');
    httpMock.expectOne(`${url}/n-1/read`).flush(null);

    let result: AppNotification[] | undefined;
    service.notifications.subscribe(n => (result = n));
    expect(result!.map(n => n.id)).toEqual(['n-2']);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
  }));

  it('markAllAsRead vacía el subject local antes de recibir respuesta HTTP', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).flush([makeNotif('n-1'), makeNotif('n-2')]);

    service.markAllAsRead();
    httpMock.expectOne(`${url}/read-all`).flush(null);

    let result: AppNotification[] | undefined;
    service.notifications.subscribe(n => (result = n));
    expect(result).toEqual([]);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
  }));

  it('unreadCount$ emite el número de notificaciones actuales', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).flush([makeNotif('n-1'), makeNotif('n-2')]);

    let count: number | undefined;
    service.unreadCount$.subscribe(c => (count = c));
    expect(count).toBe(2);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
  }));

  it('un error HTTP en el poll no rompe la suscripción — próximo tick sigue funcionando', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).error(new ErrorEvent('network error'));

    let result: AppNotification[] | undefined;
    service.notifications.subscribe(n => (result = n));
    expect(result).toEqual([]);

    tick(60_000);
    httpMock.expectOne(url).flush([makeNotif('n-1')]);
    expect(result!.length).toBe(1);
  }));
});
```

- [ ] **Step 3: Ejecutar los tests — deben fallar**

```bash
cd frontend && npx jest app-notifications.service.spec --no-coverage
```

Expected: FAIL — `Cannot find module './app-notifications.service'`

- [ ] **Step 4: Implementar el service**

```typescript
// frontend/src/app/core/services/app-notifications.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, Subscription } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/app-notification.models';

@Injectable({ providedIn: 'root' })
export class AppNotificationsService {
  private readonly notifications$ = new BehaviorSubject<AppNotification[]>([]);
  readonly unreadCount$: Observable<number> = this.notifications$.pipe(map(n => n.length));

  private pollSub?: Subscription;

  constructor(private readonly http: HttpClient) {}

  get notifications(): Observable<AppNotification[]> {
    return this.notifications$.asObservable();
  }

  startPolling(): void {
    if (this.pollSub) return;
    this.pollSub = interval(60_000).pipe(
      startWith(0),
      switchMap(() =>
        this.http.get<AppNotification[]>(`${environment.apiUrl}/app-notifications`).pipe(
          catchError(() => of(null)),
        ),
      ),
    ).subscribe(notifications => {
      if (notifications !== null) this.notifications$.next(notifications);
    });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  markAsRead(id: string): void {
    this.notifications$.next(this.notifications$.getValue().filter(n => n.id !== id));
    this.http.patch<void>(`${environment.apiUrl}/app-notifications/${id}/read`, null).subscribe({
      error: () => { /* próximo poll restaura si el request falla */ },
    });
  }

  markAllAsRead(): void {
    this.notifications$.next([]);
    this.http.patch<void>(`${environment.apiUrl}/app-notifications/read-all`, null).subscribe({
      error: () => { /* próximo poll restaura si el request falla */ },
    });
  }
}
```

- [ ] **Step 5: Ejecutar los tests — deben pasar**

```bash
cd frontend && npx jest app-notifications.service.spec --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/core/models/app-notification.models.ts \
        frontend/src/app/core/services/app-notifications.service.ts \
        frontend/src/app/core/services/app-notifications.service.spec.ts
git commit -m "feat: AppNotificationsService frontend — polling 60s, markAsRead optimista"
```

---

## Task 5: NotificationBellComponent e integración en Shell

**Files:**
- Create: `frontend/src/app/core/shell/notification-bell/notification-bell.component.ts`
- Create: `frontend/src/app/core/shell/notification-bell/notification-bell.component.html`
- Create: `frontend/src/app/core/shell/notification-bell/notification-bell.component.scss`
- Create: `frontend/src/app/core/shell/notification-bell/notification-bell.component.spec.ts`
- Modify: `frontend/src/app/core/shell/shell.module.ts`
- Modify: `frontend/src/app/core/shell/shell.component.html`
- Modify: `frontend/src/app/core/shell/shell.component.ts`
- Modify: `frontend/src/styles/components.scss` (estilos globales del panel `mat-menu`)

**Interfaces:**
- Consumes: `AppNotificationsService.notifications`, `AppNotificationsService.unreadCount$`, `markAsRead(id)`, `markAllAsRead()` de Task 4

- [ ] **Step 1: Escribir los tests del componente**

```typescript
// frontend/src/app/core/shell/notification-bell/notification-bell.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { NotificationBellComponent } from './notification-bell.component';
import { AppNotificationsService } from '../../services/app-notifications.service';
import { AppNotification } from '../../models/app-notification.models';

const makeNotif = (id: string, daysUntil: number): AppNotification => ({
  id,
  type: 'EXPIRATION_TICKET_CREATED',
  payload: { clientName: 'ACME', expirationType: 'domain', itemName: 'acme.com', daysUntil },
  createdAt: '2026-10-12T08:00:00Z',
});

describe('NotificationBellComponent', () => {
  let fixture: ComponentFixture<NotificationBellComponent>;
  let component: NotificationBellComponent;
  let notifications$: BehaviorSubject<AppNotification[]>;
  let mockService: jest.Mocked<Pick<AppNotificationsService, 'markAsRead' | 'markAllAsRead'>> & {
    notifications: BehaviorSubject<AppNotification[]>;
    unreadCount$: any;
  };
  let mockRouter: { navigate: jest.Mock };

  beforeEach(async () => {
    notifications$ = new BehaviorSubject<AppNotification[]>([]);
    mockService = {
      notifications: notifications$,
      unreadCount$: notifications$.pipe(map(n => n.length)),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };
    mockRouter = { navigate: jest.fn() };

    await TestBed.configureTestingModule({
      declarations: [NotificationBellComponent],
      imports: [NoopAnimationsModule, CommonModule, MatButtonModule, MatBadgeModule, MatMenuModule],
      providers: [
        { provide: AppNotificationsService, useValue: mockService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationBellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('urgencyClass', () => {
    it('devuelve chip--crit para daysUntil negativo', () => {
      expect(component.urgencyClass(makeNotif('n-1', -1))).toBe('chip--crit');
    });
    it('devuelve chip--crit para daysUntil = 0', () => {
      expect(component.urgencyClass(makeNotif('n-1', 0))).toBe('chip--crit');
    });
    it('devuelve chip--crit para daysUntil = 7', () => {
      expect(component.urgencyClass(makeNotif('n-1', 7))).toBe('chip--crit');
    });
    it('devuelve chip--warn para daysUntil = 8', () => {
      expect(component.urgencyClass(makeNotif('n-1', 8))).toBe('chip--warn');
    });
    it('devuelve chip--warn para daysUntil = 20', () => {
      expect(component.urgencyClass(makeNotif('n-1', 20))).toBe('chip--warn');
    });
    it('devuelve chip--accent para daysUntil > 20', () => {
      expect(component.urgencyClass(makeNotif('n-1', 21))).toBe('chip--accent');
    });
  });

  describe('itemText', () => {
    it('para vencimiento futuro incluye "en N días", tipo, nombre e item', () => {
      const text = component.itemText(makeNotif('n-1', 5));
      expect(text).toContain('Dominio');
      expect(text).toContain('acme.com');
      expect(text).toContain('ACME');
      expect(text).toContain('en 5 días');
    });
    it('para vencimiento pasado incluye "vencido hace N días"', () => {
      expect(component.itemText(makeNotif('n-1', -3))).toContain('vencido hace 3 días');
    });
    it('typeLabel para tipo desconocido devuelve el tipo sin transformar', () => {
      expect(component.typeLabel('custom_type')).toBe('custom_type');
    });
  });

  describe('acciones', () => {
    it('dismiss llama markAsRead con el id correcto', () => {
      component.dismiss('n-5');
      expect(mockService.markAsRead).toHaveBeenCalledWith('n-5');
    });
    it('dismissAll llama markAllAsRead', () => {
      component.dismissAll();
      expect(mockService.markAllAsRead).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Ejecutar tests — deben fallar**

```bash
cd frontend && npx jest notification-bell.component.spec --no-coverage
```

Expected: FAIL — `Cannot find module './notification-bell.component'`

- [ ] **Step 3: Crear el componente TypeScript**

```typescript
// frontend/src/app/core/shell/notification-bell/notification-bell.component.ts
import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { MatMenuTrigger } from '@angular/material/menu';
import { AppNotificationsService } from '../../services/app-notifications.service';
import { AppNotification } from '../../models/app-notification.models';

@Component({
  selector: 'app-notification-bell',
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent {
  readonly notifications$: Observable<AppNotification[]>;
  readonly unreadCount$: Observable<number>;

  @ViewChild(MatMenuTrigger) menuTrigger!: MatMenuTrigger;

  constructor(
    private readonly appNotifications: AppNotificationsService,
    private readonly router: Router,
  ) {
    this.notifications$ = this.appNotifications.notifications;
    this.unreadCount$ = this.appNotifications.unreadCount$;
  }

  dismiss(id: string): void {
    this.appNotifications.markAsRead(id);
  }

  dismissAll(): void {
    this.appNotifications.markAllAsRead();
  }

  navigate(): void {
    this.menuTrigger.closeMenu();
    this.router.navigate(['/notifications']);
  }

  urgencyClass(n: AppNotification): string {
    const d = n.payload.daysUntil;
    if (d === undefined || d <= 7) return 'chip--crit';
    if (d <= 20) return 'chip--warn';
    return 'chip--accent';
  }

  typeLabel(expirationType?: string): string {
    const map: Record<string, string> = {
      domain:         'Dominio',
      software:       'Licencia',
      asset_warranty: 'Garantía',
      certificate:    'Certificado',
    };
    return expirationType ? (map[expirationType] ?? expirationType) : 'Vencimiento';
  }

  itemText(n: AppNotification): string {
    const { clientName, expirationType, itemName, daysUntil } = n.payload;
    const type = this.typeLabel(expirationType);
    const name = itemName ?? '—';
    const client = clientName ?? '—';
    const days = daysUntil !== undefined
      ? (daysUntil < 0 ? `vencido hace ${Math.abs(daysUntil)} días` : `en ${daysUntil} días`)
      : '';
    return [type + ': ' + name, client, days].filter(Boolean).join(' · ');
  }
}
```

- [ ] **Step 4: Crear el template HTML**

```html
<!-- frontend/src/app/core/shell/notification-bell/notification-bell.component.html -->
<button mat-icon-button
        class="toolbar__bell-btn"
        [matMenuTriggerFor]="bellMenu"
        [matBadge]="(unreadCount$ | async) ?? 0"
        [matBadgeHidden]="(unreadCount$ | async) === 0"
        matBadgeColor="warn"
        matBadgeSize="small"
        title="Notificaciones">
  <svg viewBox="0 0 24 24"
       style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
</button>

<mat-menu #bellMenu="matMenu" class="bell-panel">
  <div class="bell-panel__header" (click)="$event.stopPropagation()">Notificaciones</div>

  <ng-container *ngIf="notifications$ | async as notifications">
    <ng-container *ngIf="notifications.length > 0; else emptyState">
      <div class="bell-panel__list" (click)="$event.stopPropagation()">
        <div *ngFor="let n of notifications" class="bell-item">
          <span class="bell-item__chip" [ngClass]="urgencyClass(n)"></span>
          <span class="bell-item__text" (click)="navigate()">{{ itemText(n) }}</span>
          <button mat-icon-button class="bell-item__dismiss" (click)="dismiss(n.id)">
            <svg viewBox="0 0 24 24"
                 style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="bell-panel__footer" (click)="$event.stopPropagation()">
        <button mat-stroked-button (click)="dismissAll()">Limpiar todo</button>
      </div>
    </ng-container>
    <ng-template #emptyState>
      <div class="bell-panel__empty" (click)="$event.stopPropagation()">Sin notificaciones nuevas</div>
    </ng-template>
  </ng-container>
</mat-menu>
```

- [ ] **Step 5: Crear los estilos del componente**

```scss
// frontend/src/app/core/shell/notification-bell/notification-bell.component.scss
.toolbar__bell-btn {
  color: var(--tx-md);
  width: 34px;
  height: 34px;

  &:hover {
    color: var(--tx-hi);
  }
}
```

- [ ] **Step 6: Agregar estilos globales del panel en components.scss**

En `frontend/src/styles/components.scss`, al final del archivo, agregar:

```scss
// ── Notification bell panel ────────────────────────────────────
.bell-panel {
  min-width: 320px !important;
  max-width: 380px !important;
}

.bell-panel__header {
  padding: 10px 16px 6px;
  font-size: 9px;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--tx-lo);
}

.bell-panel__list {
  max-height: 320px;
  overflow-y: auto;
}

.bell-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid var(--border-lo);

  &__chip {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    &.chip--crit   { background: var(--crit); }
    &.chip--warn   { background: var(--warn); }
    &.chip--accent { background: var(--accent); }
  }

  &__text {
    flex: 1;
    font-size: 12px;
    font-family: var(--font-ui);
    color: var(--tx-md);
    cursor: pointer;
    line-height: 1.4;

    &:hover { color: var(--tx-hi); }
  }

  &__dismiss {
    width: 24px !important;
    height: 24px !important;
    line-height: 24px;
    flex-shrink: 0;
    color: var(--tx-lo);

    &:hover { color: var(--tx-hi); }
  }
}

.bell-panel__footer {
  padding: 8px 16px;
  border-top: 1px solid var(--border-lo);
  display: flex;
  justify-content: flex-end;
}

.bell-panel__empty {
  padding: 16px;
  font-size: 12px;
  color: var(--tx-lo);
  font-family: var(--font-ui);
  text-align: center;
}
```

- [ ] **Step 7: Ejecutar los tests del componente — deben pasar**

```bash
cd frontend && npx jest notification-bell.component.spec --no-coverage
```

Expected: PASS

- [ ] **Step 8: Actualizar ShellModule**

En `frontend/src/app/core/shell/shell.module.ts`, agregar `NotificationBellComponent` a `declarations` y los módulos Material que necesita:

```typescript
import { MatBadgeModule } from '@angular/material/badge';
import { NotificationBellComponent } from './notification-bell/notification-bell.component';

// En declarations:
declarations: [ShellComponent, NotificationBellComponent],

// En imports (agregar MatBadgeModule — MatMenuModule y MatButtonModule ya están):
imports: [
  CommonModule, RouterModule,
  MatButtonModule, MatDividerModule, MatMenuModule, MatSidenavModule, MatToolbarModule,
  MatBadgeModule,
  SharedModule,
],
```

- [ ] **Step 9: Actualizar ShellComponent — inyectar servicio y ciclo de vida**

En `frontend/src/app/core/shell/shell.component.ts`:

Agregar import:
```typescript
import { AppNotificationsService } from '../services/app-notifications.service';
```

Agregar al constructor:
```typescript
private readonly appNotifications: AppNotificationsService,
```

En `ngOnInit()`, agregar al final:
```typescript
this.appNotifications.startPolling();
this.destroyRef.onDestroy(() => this.appNotifications.stopPolling());
```

- [ ] **Step 10: Actualizar shell.component.html — agregar la campana al toolbar**

En `frontend/src/app/core/shell/shell.component.html`, entre `<span class="toolbar__spacer"></span>` y el `<button mat-button class="toolbar__user-btn" ...>`, insertar:

```html
<app-notification-bell></app-notification-bell>
```

- [ ] **Step 11: Ejecutar todos los tests del frontend**

```bash
cd frontend && npx jest --no-coverage
```

Expected: todos en verde, sin errores de compilación

- [ ] **Step 12: Commit final**

```bash
git add frontend/src/app/core/shell/notification-bell/ \
        frontend/src/app/core/shell/shell.module.ts \
        frontend/src/app/core/shell/shell.component.ts \
        frontend/src/app/core/shell/shell.component.html \
        frontend/src/styles/components.scss
git commit -m "feat: NotificationBellComponent en toolbar — campana con badge y panel de notificaciones"
```
