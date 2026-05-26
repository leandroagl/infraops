# Maintenance Logs — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo `maintenance-logs` con endpoints `POST/GET/PATCH /tasks/:taskId/log`, entidad `MaintenanceLog` con payload jsonb, y validación de perfil técnico del usuario autenticado.

**Architecture:** Módulo NestJS independiente con rutas anidadas bajo `/tasks/:taskId/log`. El service accede a los repositorios de `MaintenanceLog`, `Task` y `User` directamente vía `TypeOrmModule.forFeature`. El `technicianId` del creador se deriva del JWT — se busca el User por `sub` y se extrae su `technicianId`; si no tiene perfil técnico, se lanza `403`.

**Tech Stack:** NestJS · TypeORM · PostgreSQL (jsonb) · class-validator · class-transformer · Jest

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `backend/src/maintenance-logs/log-item.interface.ts` | Crear | Interfaz TypeScript `LogItem` |
| `backend/src/maintenance-logs/dto/log-item.dto.ts` | Crear | DTO con validaciones para `LogItem` |
| `backend/src/maintenance-logs/maintenance-log.entity.ts` | Crear | Entidad TypeORM `MaintenanceLog` |
| `backend/src/maintenance-logs/dto/create-log.dto.ts` | Crear | DTO para crear un log |
| `backend/src/maintenance-logs/dto/update-log.dto.ts` | Crear | DTO para actualizar un log |
| `backend/src/maintenance-logs/maintenance-logs.service.spec.ts` | Crear | Tests del service (TDD — rojo primero) |
| `backend/src/maintenance-logs/maintenance-logs.service.ts` | Crear | Lógica de negocio |
| `backend/src/maintenance-logs/maintenance-logs.controller.spec.ts` | Crear | Tests del controller (TDD — rojo primero) |
| `backend/src/maintenance-logs/maintenance-logs.controller.ts` | Crear | HTTP handler |
| `backend/src/maintenance-logs/maintenance-logs.module.ts` | Crear | Módulo NestJS |
| `backend/src/app.module.ts` | Modificar | Registrar `MaintenanceLogsModule` |

---

## Task 1: Interfaz LogItem + LogItemDto

**Files:**
- Create: `backend/src/maintenance-logs/log-item.interface.ts`
- Create: `backend/src/maintenance-logs/dto/log-item.dto.ts`

- [ ] **Step 1: Crear `log-item.interface.ts`**

```typescript
// backend/src/maintenance-logs/log-item.interface.ts
export interface LogItem {
  item: string;
  result: 'ok' | 'warn' | 'error';
  notes?: string;
}
```

- [ ] **Step 2: Crear `dto/log-item.dto.ts`**

```typescript
// backend/src/maintenance-logs/dto/log-item.dto.ts
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LogItemDto {
  @IsString()
  @IsNotEmpty()
  item: string;

  @IsIn(['ok', 'warn', 'error'])
  result: 'ok' | 'warn' | 'error';

  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/maintenance-logs/log-item.interface.ts backend/src/maintenance-logs/dto/log-item.dto.ts
git commit -m "feat(maintenance-logs): interfaz LogItem y LogItemDto"
```

---

## Task 2: Entidad MaintenanceLog

**Files:**
- Create: `backend/src/maintenance-logs/maintenance-log.entity.ts`

- [ ] **Step 1: Crear la entidad**

```typescript
// backend/src/maintenance-logs/maintenance-log.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Task } from '../tasks/task.entity';
import { Technician } from '../technicians/technician.entity';
import { LogItem } from './log-item.interface';

@Entity('maintenance_logs')
export class MaintenanceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', type: 'uuid', unique: true })
  taskId: string;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @Column({ name: 'technician_id', type: 'uuid' })
  technicianId: string;

  @ManyToOne(() => Technician)
  @JoinColumn({ name: 'technician_id' })
  technician: Technician;

  @Column({ type: 'jsonb' })
  payload: LogItem[];

  @Column({ type: 'text', nullable: true, default: null })
  notes: string | null;

  @CreateDateColumn()
  registeredAt: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/maintenance-logs/maintenance-log.entity.ts
git commit -m "feat(maintenance-logs): entidad MaintenanceLog"
```

---

## Task 3: DTOs CreateLogDto y UpdateLogDto

**Files:**
- Create: `backend/src/maintenance-logs/dto/create-log.dto.ts`
- Create: `backend/src/maintenance-logs/dto/update-log.dto.ts`

- [ ] **Step 1: Crear `create-log.dto.ts`**

```typescript
// backend/src/maintenance-logs/dto/create-log.dto.ts
import { Type } from 'class-transformer';
import { ArrayMinSize, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LogItemDto } from './log-item.dto';

export class CreateLogDto {
  @ValidateNested({ each: true })
  @Type(() => LogItemDto)
  @ArrayMinSize(1)
  payload: LogItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 2: Crear `update-log.dto.ts`**

```typescript
// backend/src/maintenance-logs/dto/update-log.dto.ts
import { Type } from 'class-transformer';
import { ArrayMinSize, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LogItemDto } from './log-item.dto';

export class UpdateLogDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LogItemDto)
  @ArrayMinSize(1)
  payload?: LogItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/maintenance-logs/dto/create-log.dto.ts backend/src/maintenance-logs/dto/update-log.dto.ts
git commit -m "feat(maintenance-logs): CreateLogDto y UpdateLogDto"
```

---

## Task 4: MaintenanceLogsService — spec en rojo

**Files:**
- Create: `backend/src/maintenance-logs/maintenance-logs.service.spec.ts`

- [ ] **Step 1: Crear el spec con todos los tests en rojo**

```typescript
// backend/src/maintenance-logs/maintenance-logs.service.spec.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../tasks/task.entity';
import { TaskStatus } from '../tasks/task-status.enum';
import { TaskType } from '../tasks/task-type.enum';
import { Technician } from '../technicians/technician.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { MaintenanceLog } from './maintenance-log.entity';
import { MaintenanceLogsService } from './maintenance-logs.service';

describe('MaintenanceLogsService', () => {
  let service: MaintenanceLogsService;
  let logRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let taskRepository: { findOne: jest.Mock };
  let userRepository: { findOne: jest.Mock };

  const mockTechnician: Technician = {
    id: 'tech-1',
    createdAt: new Date('2026-01-01'),
  };

  const mockTask: Task = {
    id: 'task-1',
    clientId: 'client-1',
    client: null as any,
    technicianId: 'tech-1',
    technician: mockTechnician,
    type: TaskType.SERVER_MAINTENANCE,
    status: TaskStatus.IN_PROGRESS,
    scheduledDate: '2026-06-01',
    completedDate: null,
    odooTicketId: null,
    createdAt: new Date('2026-05-01'),
  };

  const mockUser: User = {
    id: 'user-1',
    name: 'Valen',
    email: 'valen@ondra.com.ar',
    passwordHash: 'hash',
    role: UserRole.TECHNICIAN,
    mustChangePassword: false,
    lastLogoutAt: null,
    isActive: true,
    technicianId: 'tech-1',
    technician: mockTechnician,
    createdAt: new Date('2026-01-01'),
  };

  const mockLog: MaintenanceLog = {
    id: 'log-1',
    taskId: 'task-1',
    task: mockTask,
    technicianId: 'tech-1',
    technician: mockTechnician,
    payload: [{ item: 'WinServer', result: 'ok' }],
    notes: null,
    registeredAt: new Date('2026-06-01'),
  };

  const createDto: CreateLogDto = {
    payload: [{ item: 'WinServer', result: 'ok' }],
  };

  beforeEach(async () => {
    logRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    taskRepository = { findOne: jest.fn() };
    userRepository = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        MaintenanceLogsService,
        { provide: getRepositoryToken(MaintenanceLog), useValue: logRepository },
        { provide: getRepositoryToken(Task), useValue: taskRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = module.get(MaintenanceLogsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crea y devuelve el log con relaciones cargadas', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne
        .mockResolvedValueOnce(null)     // comprueba duplicado
        .mockResolvedValueOnce(mockLog); // loadLog
      userRepository.findOne.mockResolvedValue(mockUser);
      logRepository.create.mockReturnValue(mockLog);
      logRepository.save.mockResolvedValue(mockLog);

      const result = await service.create('task-1', createDto, 'user-1');

      expect(taskRepository.findOne).toHaveBeenCalledWith({ where: { id: 'task-1' } });
      expect(logRepository.findOne).toHaveBeenCalledWith({ where: { taskId: 'task-1' } });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(logRepository.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        technicianId: 'tech-1',
        payload: createDto.payload,
        notes: null,
      });
      expect(result.id).toBe('log-1');
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.create('nonexistent', createDto, 'user-1')).rejects.toThrow(
        'Tarea no encontrada',
      );
    });

    it('lanza ConflictException si ya existe un log para la tarea', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(mockLog);

      await expect(service.create('task-1', createDto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lanza ForbiddenException si el usuario no tiene perfil técnico', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue({ ...mockUser, technicianId: null });

      await expect(service.create('task-1', createDto, 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findByTaskId', () => {
    it('devuelve el log de la tarea', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(mockLog);

      const result = await service.findByTaskId('task-1');

      expect(taskRepository.findOne).toHaveBeenCalledWith({ where: { id: 'task-1' } });
      expect(logRepository.findOne).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        relations: ['task', 'technician'],
      });
      expect(result.id).toBe('log-1');
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.findByTaskId('nonexistent')).rejects.toThrow('Tarea no encontrada');
    });

    it('lanza NotFoundException si la tarea no tiene log', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(null);

      await expect(service.findByTaskId('task-1')).rejects.toThrow(
        'Esta tarea no tiene log registrado',
      );
    });
  });

  describe('update', () => {
    it('actualiza payload y devuelve el log actualizado', async () => {
      const updatedLog = { ...mockLog, payload: [{ item: 'VMware', result: 'ok' as const }] };
      logRepository.findOne
        .mockResolvedValueOnce(mockLog)     // buscar por taskId
        .mockResolvedValueOnce(updatedLog); // loadLog
      logRepository.update.mockResolvedValue({ affected: 1 });

      const dto: UpdateLogDto = { payload: [{ item: 'VMware', result: 'ok' }] };
      const result = await service.update('task-1', dto);

      expect(logRepository.update).toHaveBeenCalledWith('log-1', { payload: dto.payload });
      expect(result.payload[0].item).toBe('VMware');
    });

    it('lanza BadRequestException si el body está vacío', async () => {
      await expect(service.update('task-1', {})).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la tarea no tiene log', async () => {
      logRepository.findOne.mockResolvedValue(null);

      await expect(service.update('task-1', { notes: 'test' })).rejects.toThrow(
        'Esta tarea no tiene log registrado',
      );
    });
  });
});
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

Desde `backend/`:
```bash
npx jest maintenance-logs.service --no-coverage
```

Resultado esperado: FAIL — `Cannot find module './maintenance-logs.service'`

- [ ] **Step 3: Commit**

```bash
git add backend/src/maintenance-logs/maintenance-logs.service.spec.ts
git commit -m "test(maintenance-logs): spec MaintenanceLogsService en rojo"
```

---

## Task 5: MaintenanceLogsService — implementación

**Files:**
- Create: `backend/src/maintenance-logs/maintenance-logs.service.ts`

- [ ] **Step 1: Implementar el service**

```typescript
// backend/src/maintenance-logs/maintenance-logs.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { MaintenanceLog } from './maintenance-log.entity';

@Injectable()
export class MaintenanceLogsService {
  constructor(
    @InjectRepository(MaintenanceLog)
    private readonly logRepository: Repository<MaintenanceLog>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(taskId: string, dto: CreateLogDto, userId: string): Promise<MaintenanceLog> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const existing = await this.logRepository.findOne({ where: { taskId } });
    if (existing) throw new ConflictException('Esta tarea ya tiene un log registrado');

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.technicianId) throw new ForbiddenException('El usuario no tiene perfil técnico');

    const log = this.logRepository.create({
      taskId,
      technicianId: user.technicianId,
      payload: dto.payload,
      notes: dto.notes ?? null,
    });
    const saved = await this.logRepository.save(log);
    return this.loadLog(saved.id);
  }

  async findByTaskId(taskId: string): Promise<MaintenanceLog> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const log = await this.logRepository.findOne({
      where: { taskId },
      relations: ['task', 'technician'],
    });
    if (!log) throw new NotFoundException('Esta tarea no tiene log registrado');
    return log;
  }

  async update(taskId: string, dto: UpdateLogDto): Promise<MaintenanceLog> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Se debe proveer al menos un campo para actualizar');
    }

    const log = await this.logRepository.findOne({ where: { taskId } });
    if (!log) throw new NotFoundException('Esta tarea no tiene log registrado');

    const updates: Partial<MaintenanceLog> = {};
    if (dto.payload !== undefined) updates.payload = dto.payload;
    if (dto.notes !== undefined) updates.notes = dto.notes;

    await this.logRepository.update(log.id, updates);
    return this.loadLog(log.id);
  }

  private async loadLog(id: string): Promise<MaintenanceLog> {
    const log = await this.logRepository.findOne({
      where: { id },
      relations: ['task', 'technician'],
    });
    if (!log) throw new NotFoundException('Log no encontrado');
    return log;
  }
}
```

- [ ] **Step 2: Ejecutar los tests y verificar que pasan**

```bash
npx jest maintenance-logs.service --no-coverage
```

Resultado esperado: PASS — 8 tests pasando

- [ ] **Step 3: Commit**

```bash
git add backend/src/maintenance-logs/maintenance-logs.service.ts
git commit -m "feat(maintenance-logs): MaintenanceLogsService con TDD — create, findByTaskId y update"
```

---

## Task 6: MaintenanceLogsController — spec en rojo

**Files:**
- Create: `backend/src/maintenance-logs/maintenance-logs.controller.spec.ts`

- [ ] **Step 1: Crear el spec del controller**

```typescript
// backend/src/maintenance-logs/maintenance-logs.controller.spec.ts
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtPayload } from '../auth/auth.types';
import { Task } from '../tasks/task.entity';
import { TaskStatus } from '../tasks/task-status.enum';
import { TaskType } from '../tasks/task-type.enum';
import { Technician } from '../technicians/technician.entity';
import { UserRole } from '../users/user-role.enum';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { MaintenanceLog } from './maintenance-log.entity';
import { MaintenanceLogsController } from './maintenance-logs.controller';
import { MaintenanceLogsService } from './maintenance-logs.service';

describe('MaintenanceLogsController', () => {
  let controller: MaintenanceLogsController;
  let maintenanceLogsService: {
    create: jest.Mock;
    findByTaskId: jest.Mock;
    update: jest.Mock;
  };

  const mockTechnician: Technician = {
    id: 'tech-1',
    createdAt: new Date('2026-01-01'),
  };

  const mockTask: Task = {
    id: 'task-1',
    clientId: 'client-1',
    client: null as any,
    technicianId: 'tech-1',
    technician: mockTechnician,
    type: TaskType.SERVER_MAINTENANCE,
    status: TaskStatus.IN_PROGRESS,
    scheduledDate: '2026-06-01',
    completedDate: null,
    odooTicketId: null,
    createdAt: new Date('2026-05-01'),
  };

  const mockLog: MaintenanceLog = {
    id: 'log-1',
    taskId: 'task-1',
    task: mockTask,
    technicianId: 'tech-1',
    technician: mockTechnician,
    payload: [{ item: 'WinServer', result: 'ok' }],
    notes: null,
    registeredAt: new Date('2026-06-01'),
  };

  const mockUser: JwtPayload = {
    sub: 'user-1',
    email: 'valen@ondra.com.ar',
    role: UserRole.TECHNICIAN,
    mustChangePassword: false,
  };

  beforeEach(async () => {
    maintenanceLogsService = {
      create: jest.fn(),
      findByTaskId: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [MaintenanceLogsController],
      providers: [{ provide: MaintenanceLogsService, useValue: maintenanceLogsService }],
    }).compile();

    controller = module.get(MaintenanceLogsController);
  });

  describe('create', () => {
    const dto: CreateLogDto = {
      payload: [{ item: 'WinServer', result: 'ok' }],
    };

    it('llama a maintenanceLogsService.create con taskId, dto y userId, devuelve el log', async () => {
      maintenanceLogsService.create.mockResolvedValue(mockLog);

      const result = await controller.create('task-1', dto, mockUser);

      expect(maintenanceLogsService.create).toHaveBeenCalledWith('task-1', dto, 'user-1');
      expect(result).toEqual(mockLog);
    });

    it('propaga NotFoundException si la tarea no existe', async () => {
      maintenanceLogsService.create.mockRejectedValue(new NotFoundException());

      await expect(controller.create('nonexistent', dto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propaga ConflictException si ya existe un log', async () => {
      maintenanceLogsService.create.mockRejectedValue(new ConflictException());

      await expect(controller.create('task-1', dto, mockUser)).rejects.toThrow(ConflictException);
    });

    it('propaga ForbiddenException si el usuario no tiene perfil técnico', async () => {
      maintenanceLogsService.create.mockRejectedValue(new ForbiddenException());

      await expect(controller.create('task-1', dto, mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByTaskId', () => {
    it('llama a maintenanceLogsService.findByTaskId y devuelve el log', async () => {
      maintenanceLogsService.findByTaskId.mockResolvedValue(mockLog);

      const result = await controller.findByTaskId('task-1');

      expect(maintenanceLogsService.findByTaskId).toHaveBeenCalledWith('task-1');
      expect(result).toEqual(mockLog);
    });

    it('propaga NotFoundException si la tarea no existe o no tiene log', async () => {
      maintenanceLogsService.findByTaskId.mockRejectedValue(new NotFoundException());

      await expect(controller.findByTaskId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateLogDto = { notes: 'notas actualizadas' };

    it('llama a maintenanceLogsService.update con taskId y dto, devuelve el log actualizado', async () => {
      const updated = { ...mockLog, notes: 'notas actualizadas' };
      maintenanceLogsService.update.mockResolvedValue(updated);

      const result = await controller.update('task-1', dto);

      expect(maintenanceLogsService.update).toHaveBeenCalledWith('task-1', dto);
      expect(result.notes).toBe('notas actualizadas');
    });

    it('propaga NotFoundException si la tarea no tiene log', async () => {
      maintenanceLogsService.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update('task-1', dto)).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

```bash
npx jest maintenance-logs.controller --no-coverage
```

Resultado esperado: FAIL — `Cannot find module './maintenance-logs.controller'`

- [ ] **Step 3: Commit**

```bash
git add backend/src/maintenance-logs/maintenance-logs.controller.spec.ts
git commit -m "test(maintenance-logs): spec MaintenanceLogsController en rojo"
```

---

## Task 7: MaintenanceLogsController — implementación

**Files:**
- Create: `backend/src/maintenance-logs/maintenance-logs.controller.ts`

- [ ] **Step 1: Implementar el controller**

```typescript
// backend/src/maintenance-logs/maintenance-logs.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/auth.types';
import { UserRole } from '../users/user-role.enum';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { MaintenanceLog } from './maintenance-log.entity';
import { MaintenanceLogsService } from './maintenance-logs.service';

@Controller('tasks/:taskId/log')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceLogsController {
  constructor(private readonly maintenanceLogsService: MaintenanceLogsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TL, UserRole.TECHNICIAN)
  create(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateLogDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MaintenanceLog> {
    return this.maintenanceLogsService.create(taskId, dto, user.sub);
  }

  @Get()
  findByTaskId(
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<MaintenanceLog> {
    return this.maintenanceLogsService.findByTaskId(taskId);
  }

  @Patch()
  @Roles(UserRole.ADMIN, UserRole.TL, UserRole.TECHNICIAN)
  update(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateLogDto,
  ): Promise<MaintenanceLog> {
    return this.maintenanceLogsService.update(taskId, dto);
  }
}
```

- [ ] **Step 2: Ejecutar los tests y verificar que pasan**

```bash
npx jest maintenance-logs.controller --no-coverage
```

Resultado esperado: PASS — 7 tests pasando

- [ ] **Step 3: Commit**

```bash
git add backend/src/maintenance-logs/maintenance-logs.controller.ts
git commit -m "feat(maintenance-logs): MaintenanceLogsController con TDD — POST, GET y PATCH /tasks/:taskId/log"
```

---

## Task 8: MaintenanceLogsModule + wiring en AppModule

**Files:**
- Create: `backend/src/maintenance-logs/maintenance-logs.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Crear el módulo**

```typescript
// backend/src/maintenance-logs/maintenance-logs.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { MaintenanceLog } from './maintenance-log.entity';
import { MaintenanceLogsController } from './maintenance-logs.controller';
import { MaintenanceLogsService } from './maintenance-logs.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceLog, Task, User])],
  controllers: [MaintenanceLogsController],
  providers: [MaintenanceLogsService, JwtAuthGuard, RolesGuard],
})
export class MaintenanceLogsModule {}
```

- [ ] **Step 2: Registrar en AppModule**

En `backend/src/app.module.ts`, agregar el import:

```typescript
import { MaintenanceLogsModule } from './maintenance-logs/maintenance-logs.module';
```

Y agregar `MaintenanceLogsModule` al array `imports`:

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
  MaintenanceLogsModule,  // ← agregar
],
```

- [ ] **Step 3: Ejecutar la suite completa y verificar que todos los tests pasan**

```bash
npx jest --no-coverage
```

Resultado esperado: PASS — 119 tests pasando (101 anteriores + 18 nuevos)

- [ ] **Step 4: Commit**

```bash
git add backend/src/maintenance-logs/maintenance-logs.module.ts backend/src/app.module.ts
git commit -m "feat(maintenance-logs): módulo maintenance-logs completo — wiring con AppModule"
```