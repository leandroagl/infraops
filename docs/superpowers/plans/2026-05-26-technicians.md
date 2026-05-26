# Technicians Module — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo `technicians` que convierte cualquier User en un técnico asignable, expone `GET /technicians` para dropdowns de asignación, y permite al ADMIN gestionar perfiles vía `POST /technicians` y `DELETE /technicians/:id`.

**Architecture:** Entidad `Technician(id, createdAt)` con FK inversa en `User.technicianId`. `TechniciansService` inyecta repositorios de `Technician` y `User` (vía `UsersModule`). El controlador aplica `JwtAuthGuard` para todos los endpoints y `@Roles(ADMIN)` en escritura.

**Tech Stack:** NestJS · TypeORM · PostgreSQL · class-validator · Jest (ts-jest)

---

## Archivos a crear

| Archivo | Responsabilidad |
|---------|----------------|
| `backend/src/technicians/technician.entity.ts` | Entidad TypeORM `Technician` |
| `backend/src/technicians/dto/assign-technician.dto.ts` | DTO para `POST /technicians` |
| `backend/src/technicians/technicians.service.ts` | Lógica de negocio |
| `backend/src/technicians/technicians.service.spec.ts` | Tests unitarios del service |
| `backend/src/technicians/technicians.controller.ts` | Capa HTTP |
| `backend/src/technicians/technicians.controller.spec.ts` | Tests unitarios del controller |
| `backend/src/technicians/technicians.module.ts` | Módulo NestJS |

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/users/user.entity.ts` | Agregar `technicianId` (columna FK) y `technician` (relación OneToOne) |
| `backend/src/users/users.service.ts` | Actualizar `toResponse` para excluir la relación `technician` |
| `backend/src/users/users.service.spec.ts` | Agregar `technicianId: null` al mockUser y a userResponse |
| `backend/src/app.module.ts` | Importar `TechniciansModule` |

---

## Task 1: Crear Technician entity

**Files:**
- Create: `backend/src/technicians/technician.entity.ts`

- [ ] **Step 1: Crear el archivo de entidad**

```typescript
// backend/src/technicians/technician.entity.ts
import { CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('technicians')
export class Technician {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 2: Commitear**

```bash
git add backend/src/technicians/technician.entity.ts
git commit -m "feat(technicians): entidad Technician"
```

---

## Task 2: Modificar User entity y ajustar UsersService

**Files:**
- Modify: `backend/src/users/user.entity.ts`
- Modify: `backend/src/users/users.service.ts`
- Modify: `backend/src/users/users.service.spec.ts`

- [ ] **Step 1: Agregar technicianId y relación OneToOne en user.entity.ts**

Agregar los imports faltantes al principio del archivo:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Technician } from '../technicians/technician.entity';
import { UserRole } from './user-role.enum';
```

Agregar estos dos campos dentro de la clase `User`, antes de `createdAt`:

```typescript
  @Column({ name: 'technician_id', type: 'uuid', nullable: true, default: null })
  technicianId: string | null;

  @OneToOne(() => Technician)
  @JoinColumn({ name: 'technician_id' })
  technician: Technician | null;
```

El archivo completo resultante:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Technician } from '../technicians/technician.entity';
import { UserRole } from './user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: '' })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ default: true })
  mustChangePassword: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  lastLogoutAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'technician_id', type: 'uuid', nullable: true, default: null })
  technicianId: string | null;

  @OneToOne(() => Technician)
  @JoinColumn({ name: 'technician_id' })
  technician: Technician | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 2: Actualizar toResponse en users.service.ts para excluir la relación technician**

El campo `technician` es una relación TypeORM — si no se carga explícitamente, su valor es `undefined`. Hay que excluirlo del response.

Cambiar el tipo `UserResponse` (línea 15):

```typescript
export type UserResponse = Omit<User, 'passwordHash' | 'lastLogoutAt' | 'technician'>;
```

Cambiar el método privado `toResponse` (al final de la clase):

```typescript
  private toResponse(user: User): UserResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, lastLogoutAt, technician, ...response } = user;
    return response;
  }
```

Con este cambio, `technicianId` (columna FK) SÍ aparece en el response de `/users` — es útil para saber si un usuario tiene perfil técnico. La relación `technician` (objeto Technician completo) NO aparece.

- [ ] **Step 3: Actualizar mockUser y userResponse en users.service.spec.ts**

Agregar `technicianId: null` al `mockUser` (buscar el objeto literal y agregar el campo):

```typescript
  const mockUser: User = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    passwordHash: 'hashed_password',
    role: UserRole.TL,
    mustChangePassword: false,
    lastLogoutAt: null,
    isActive: true,
    technicianId: null,
    technician: null,
    createdAt: new Date('2026-01-01'),
  };
```

Agregar `technicianId: null` al objeto `userResponse`:

```typescript
  const userResponse = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    role: UserRole.TL,
    mustChangePassword: false,
    isActive: true,
    technicianId: null,
    createdAt: mockUser.createdAt,
  };
```

- [ ] **Step 4: Correr los tests de users y verificar que pasan**

```bash
npm test -- --testPathPattern=users
```

Expected: todos los tests de `users.service.spec.ts` y `users.controller.spec.ts` en verde.

- [ ] **Step 5: Commitear**

```bash
git add backend/src/users/user.entity.ts backend/src/users/users.service.ts backend/src/users/users.service.spec.ts
git commit -m "feat(technicians): agregar technicianId y relación OneToOne en User"
```

---

## Task 3: Crear AssignTechnicianDto

**Files:**
- Create: `backend/src/technicians/dto/assign-technician.dto.ts`

- [ ] **Step 1: Crear el DTO**

```typescript
// backend/src/technicians/dto/assign-technician.dto.ts
import { IsUUID } from 'class-validator';

export class AssignTechnicianDto {
  @IsUUID()
  userId: string;
}
```

- [ ] **Step 2: Commitear**

```bash
git add backend/src/technicians/dto/assign-technician.dto.ts
git commit -m "feat(technicians): AssignTechnicianDto"
```

---

## Task 4: Escribir tests del TechnicianService (en rojo)

**Files:**
- Create: `backend/src/technicians/technicians.service.spec.ts`

- [ ] **Step 1: Crear el archivo de spec**

```typescript
// backend/src/technicians/technicians.service.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Not } from 'typeorm';
import { Technician } from './technician.entity';
import { TechniciansService } from './technicians.service';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';

describe('TechniciansService', () => {
  let service: TechniciansService;
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
  };
  let technicianRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const mockTechnician: Technician = {
    id: 'tech-1',
    createdAt: new Date('2026-01-01'),
  };

  const mockUser: User = {
    id: 'user-1',
    name: 'Valen López',
    email: 'valen@ondra.com',
    passwordHash: 'hashed',
    role: UserRole.TECHNICIAN,
    mustChangePassword: false,
    lastLogoutAt: null,
    isActive: true,
    technicianId: null,
    technician: null,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };
    technicianRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        TechniciansService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(Technician), useValue: technicianRepository },
      ],
    }).compile();

    service = module.get(TechniciansService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('retorna todos los usuarios con perfil técnico sin passwordHash ni technician', async () => {
      const userWithTech = { ...mockUser, technicianId: 'tech-1', technician: mockTechnician };
      userRepository.find.mockResolvedValue([userWithTech]);

      const result = await service.findAll();

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { technicianId: Not(IsNull()) },
        relations: ['technician'],
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tech-1');
      expect(result[0].createdAt).toEqual(mockTechnician.createdAt);
      expect(result[0].user.id).toBe('user-1');
      expect(result[0].user).not.toHaveProperty('passwordHash');
      expect(result[0].user).not.toHaveProperty('technicianId');
      expect(result[0].user).not.toHaveProperty('technician');
    });
  });

  describe('assign', () => {
    it('crea perfil técnico, actualiza technicianId en el user y devuelve el resultado', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      technicianRepository.create.mockReturnValue(mockTechnician);
      technicianRepository.save.mockResolvedValue(mockTechnician);
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.assign('user-1');

      expect(technicianRepository.create).toHaveBeenCalled();
      expect(technicianRepository.save).toHaveBeenCalledWith(mockTechnician);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { technicianId: 'tech-1' });
      expect(result.id).toBe('tech-1');
      expect(result.user.id).toBe('user-1');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('lanza NotFoundException si el user no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.assign('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException si el user ya tiene perfil técnico', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, technicianId: 'tech-existing' });

      await expect(service.assign('user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('limpia technicianId del user y elimina el Technician', async () => {
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      userRepository.update.mockResolvedValue({ affected: 1 });
      technicianRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('tech-1');

      expect(userRepository.update).toHaveBeenCalledWith(
        { technicianId: 'tech-1' },
        { technicianId: null },
      );
      expect(technicianRepository.delete).toHaveBeenCalledWith('tech-1');
    });

    it('lanza NotFoundException si el Technician no existe', async () => {
      technicianRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan por razón correcta**

```bash
npm test -- --testPathPattern=technicians.service.spec
```

Expected: FAIL — `Cannot find module './technicians.service'`

- [ ] **Step 3: Commitear el spec en rojo**

```bash
git add backend/src/technicians/technicians.service.spec.ts
git commit -m "test(technicians): spec TechniciansService en rojo"
```

---

## Task 5: Implementar TechniciansService

**Files:**
- Create: `backend/src/technicians/technicians.service.ts`

- [ ] **Step 1: Crear el service**

```typescript
// backend/src/technicians/technicians.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Technician } from './technician.entity';

export type TechnicianUserResponse = {
  id: string;
  createdAt: Date;
  user: Omit<User, 'passwordHash' | 'lastLogoutAt' | 'technician' | 'technicianId'>;
};

@Injectable()
export class TechniciansService {
  constructor(
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<TechnicianUserResponse[]> {
    const users = await this.userRepository.find({
      where: { technicianId: Not(IsNull()) },
      relations: ['technician'],
      order: { name: 'ASC' },
    });
    return users.map((u) => this.toResponse(u));
  }

  async assign(userId: string): Promise<TechnicianUserResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.technicianId) throw new ConflictException('Este usuario ya tiene perfil técnico');

    const technician = await this.technicianRepository.save(
      this.technicianRepository.create(),
    );
    await this.userRepository.update(userId, { technicianId: technician.id });

    const { passwordHash, lastLogoutAt, technician: _t, technicianId: _tid, ...userFields } = user;
    return { id: technician.id, createdAt: technician.createdAt, user: userFields };
  }

  async remove(id: string): Promise<void> {
    const technician = await this.technicianRepository.findOne({ where: { id } });
    if (!technician) throw new NotFoundException('Perfil técnico no encontrado');

    await this.userRepository.update({ technicianId: id }, { technicianId: null });
    await this.technicianRepository.delete(id);
  }

  private toResponse(user: User): TechnicianUserResponse {
    const { passwordHash, lastLogoutAt, technician, technicianId, ...userFields } = user;
    return {
      id: technicianId!,
      createdAt: technician!.createdAt,
      user: userFields,
    };
  }
}
```

- [ ] **Step 2: Correr los tests y verificar que todos pasan**

```bash
npm test -- --testPathPattern=technicians.service.spec
```

Expected: todos los tests en verde (6 passing).

- [ ] **Step 3: Commitear**

```bash
git add backend/src/technicians/technicians.service.ts
git commit -m "feat(technicians): TechniciansService con TDD — findAll, assign y remove"
```

---

## Task 6: Escribir tests del TechniciansController (en rojo)

**Files:**
- Create: `backend/src/technicians/technicians.controller.spec.ts`

- [ ] **Step 1: Crear el archivo de spec**

```typescript
// backend/src/technicians/technicians.controller.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '../users/user-role.enum';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

describe('TechniciansController', () => {
  let controller: TechniciansController;
  let techniciansService: {
    findAll: jest.Mock;
    assign: jest.Mock;
    remove: jest.Mock;
  };

  const mockResult = {
    id: 'tech-1',
    createdAt: new Date('2026-01-01'),
    user: {
      id: 'user-1',
      name: 'Valen López',
      email: 'valen@ondra.com',
      role: UserRole.TECHNICIAN,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date('2026-01-01'),
    },
  };

  beforeEach(async () => {
    techniciansService = {
      findAll: jest.fn(),
      assign: jest.fn(),
      remove: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [TechniciansController],
      providers: [{ provide: TechniciansService, useValue: techniciansService }],
    }).compile();

    controller = module.get(TechniciansController);
  });

  describe('findAll', () => {
    it('llama a techniciansService.findAll y devuelve el resultado', async () => {
      techniciansService.findAll.mockResolvedValue([mockResult]);

      const result = await controller.findAll();

      expect(techniciansService.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockResult]);
    });
  });

  describe('assign', () => {
    const dto: AssignTechnicianDto = { userId: 'user-1' };

    it('llama a techniciansService.assign con el userId y devuelve 201 con resultado', async () => {
      techniciansService.assign.mockResolvedValue(mockResult);

      const result = await controller.assign(dto);

      expect(techniciansService.assign).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResult);
    });

    it('propaga NotFoundException si el user no existe', async () => {
      techniciansService.assign.mockRejectedValue(new NotFoundException());

      await expect(controller.assign(dto)).rejects.toThrow(NotFoundException);
    });

    it('propaga ConflictException si el user ya tiene perfil técnico', async () => {
      techniciansService.assign.mockRejectedValue(new ConflictException());

      await expect(controller.assign(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('llama a techniciansService.remove con el id y devuelve ok: true', async () => {
      techniciansService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('tech-1');

      expect(techniciansService.remove).toHaveBeenCalledWith('tech-1');
      expect(result).toEqual({ ok: true });
    });

    it('propaga NotFoundException si el id no existe', async () => {
      techniciansService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan por razón correcta**

```bash
npm test -- --testPathPattern=technicians.controller.spec
```

Expected: FAIL — `Cannot find module './technicians.controller'`

- [ ] **Step 3: Commitear el spec en rojo**

```bash
git add backend/src/technicians/technicians.controller.spec.ts
git commit -m "test(technicians): spec TechniciansController en rojo"
```

---

## Task 7: Implementar TechniciansController

**Files:**
- Create: `backend/src/technicians/technicians.controller.ts`

- [ ] **Step 1: Crear el controller**

```typescript
// backend/src/technicians/technicians.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { TechniciansService, TechnicianUserResponse } from './technicians.service';

@Controller('technicians')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Get()
  findAll(): Promise<TechnicianUserResponse[]> {
    return this.techniciansService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  assign(@Body() dto: AssignTechnicianDto): Promise<TechnicianUserResponse> {
    return this.techniciansService.assign(dto.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ ok: true }> {
    await this.techniciansService.remove(id);
    return { ok: true };
  }
}
```

Nota: `@Get()` no tiene `@Roles` — el `RolesGuard` permite el acceso a todos los usuarios autenticados cuando no hay `@Roles` definido en handler ni en clase.

- [ ] **Step 2: Correr los tests y verificar que todos pasan**

```bash
npm test -- --testPathPattern=technicians.controller.spec
```

Expected: todos los tests en verde (5 passing).

- [ ] **Step 3: Correr toda la suite para verificar que nada se rompió**

```bash
npm test
```

Expected: todos los tests en verde.

- [ ] **Step 4: Commitear**

```bash
git add backend/src/technicians/technicians.controller.ts
git commit -m "feat(technicians): TechniciansController con TDD — GET /technicians, POST /technicians y DELETE /technicians/:id"
```

---

## Task 8: Crear TechniciansModule y wiring con AppModule

**Files:**
- Create: `backend/src/technicians/technicians.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Crear el módulo**

```typescript
// backend/src/technicians/technicians.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { Technician } from './technician.entity';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

@Module({
  imports: [TypeOrmModule.forFeature([Technician]), UsersModule],
  controllers: [TechniciansController],
  providers: [TechniciansService, JwtAuthGuard, RolesGuard],
  exports: [TechniciansService],
})
export class TechniciansModule {}
```

`UsersModule` ya exporta `TypeOrmModule` (con el repositorio de `User`), por lo que `TechniciansService` puede inyectar `UserRepository` sin conflictos.

- [ ] **Step 2: Agregar TechniciansModule a AppModule**

En `backend/src/app.module.ts`, agregar el import:

```typescript
import { TechniciansModule } from './technicians/technicians.module';
```

Y en el array `imports` del `@Module`:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? 'infraops',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    ClientsModule,
    TechniciansModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Correr toda la suite de tests**

```bash
npm test
```

Expected: todos los tests en verde.

- [ ] **Step 4: Commitear**

```bash
git add backend/src/technicians/technicians.module.ts backend/src/app.module.ts
git commit -m "feat(technicians): módulo technicians completo — wiring con AppModule"
```