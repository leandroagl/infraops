# Users Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el módulo Users con ABM completo de usuarios internos, accesible solo para el rol ADMIN.

**Architecture:** `UsersModule` pasa a ser el dueño de la entidad `User` (registra `TypeOrmModule.forFeature([User])` y lo exporta). `AuthModule` importa `UsersModule` en lugar de registrar el repositorio directamente. `UsersController` usa `JwtAuthGuard` y `RolesGuard` declaradas como providers en `UsersModule`, sin dependencia circular.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, bcrypt, class-validator, class-transformer, Jest

---

## Archivos

| Acción | Archivo |
|--------|---------|
| Modificar | `backend/src/users/user.entity.ts` |
| Modificar | `backend/src/auth/auth.module.ts` |
| Modificar | `backend/src/auth/auth.service.spec.ts` |
| Modificar | `backend/src/app.module.ts` |
| Crear | `backend/src/users/dto/create-user.dto.ts` |
| Crear | `backend/src/users/dto/update-user.dto.ts` |
| Crear | `backend/src/users/dto/update-user-status.dto.ts` |
| Crear | `backend/src/users/users.service.ts` |
| Crear | `backend/src/users/users.service.spec.ts` |
| Crear | `backend/src/users/users.controller.ts` |
| Crear | `backend/src/users/users.controller.spec.ts` |
| Crear | `backend/src/users/users.module.ts` |

---

## Task 1: Agregar campo `name` a la entidad User

**Files:**
- Modify: `backend/src/users/user.entity.ts`
- Modify: `backend/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Agregar la columna `name` a la entidad**

Reemplazar el contenido de `backend/src/users/user.entity.ts`:

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
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

  @CreateDateColumn()
  createdAt: Date;
}
```

- [ ] **Step 2: Actualizar `mockUser` en auth.service.spec.ts para incluir `name`**

En `backend/src/auth/auth.service.spec.ts`, localizar el objeto `mockUser` (línea ~20) y agregar el campo `name`:

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
  createdAt: new Date(),
};
```

- [ ] **Step 3: Verificar que los tests de auth siguen pasando**

```bash
cd backend && npx jest --no-coverage auth
```

Expected: todos los tests de `auth.service.spec.ts`, `auth.controller.spec.ts`, `roles.guard.spec.ts` y `jwt.strategy.spec.ts` en verde.

- [ ] **Step 4: Commit**

```bash
git add backend/src/users/user.entity.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(users): campo name en entidad User"
```

---

## Task 2: Crear DTOs

**Files:**
- Create: `backend/src/users/dto/create-user.dto.ts`
- Create: `backend/src/users/dto/update-user.dto.ts`
- Create: `backend/src/users/dto/update-user-status.dto.ts`

- [ ] **Step 1: Crear `create-user.dto.ts`**

```typescript
import { IsEmail, IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { UserRole } from '../user-role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(UserRole)
  role: UserRole;
}
```

- [ ] **Step 2: Crear `update-user.dto.ts`**

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {}
```

- [ ] **Step 3: Crear `update-user-status.dto.ts`**

```typescript
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @IsBoolean()
  isActive: boolean;
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/users/dto/
git commit -m "feat(users): DTOs de creación, edición y estado"
```

---

## Task 3: Escribir los tests de UsersService (deben fallar)

**Files:**
- Create: `backend/src/users/users.service.spec.ts`

- [ ] **Step 1: Crear el archivo de tests**

```typescript
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as passwordUtil from '../common/utils/password.util';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

jest.mock('bcrypt');
jest.mock('../common/utils/password.util');

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  const mockUser: User = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    passwordHash: 'hashed_password',
    role: UserRole.TL,
    mustChangePassword: false,
    lastLogoutAt: null,
    isActive: true,
    createdAt: new Date('2026-01-01'),
  };

  const userResponse = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    role: UserRole.TL,
    mustChangePassword: false,
    isActive: true,
    createdAt: mockUser.createdAt,
  };

  beforeEach(async () => {
    userRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('devuelve lista de usuarios sin passwordHash ni lastLogoutAt', async () => {
      userRepository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toEqual([userResponse]);
      expect(userRepository.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' } });
    });
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      name: 'Valen López',
      email: 'valen@ondra.com',
      role: UserRole.TECHNICIAN,
    };

    const savedUser: User = {
      ...mockUser,
      id: 'user-2',
      name: 'Valen López',
      email: 'valen@ondra.com',
      role: UserRole.TECHNICIAN,
      passwordHash: 'hashed_plain123',
      mustChangePassword: true,
    };

    it('crea usuario, hashea la contraseña y devuelve plainPassword', async () => {
      userRepository.findOne.mockResolvedValue(null);
      (passwordUtil.generateRandomPassword as jest.Mock).mockReturnValue('plain123');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_plain123');
      userRepository.create.mockReturnValue(savedUser);
      userRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(dto);

      expect(result.plainPassword).toBe('plain123');
      expect(result.email).toBe('valen@ondra.com');
      expect(result).not.toHaveProperty('passwordHash');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Valen López',
          email: 'valen@ondra.com',
          role: UserRole.TECHNICIAN,
          passwordHash: 'hashed_plain123',
          mustChangePassword: true,
        }),
      );
    });

    it('lanza ConflictException si el email ya existe', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const dto: UpdateUserDto = { email: 'nuevo@ondra.com' };

    it('actualiza campos y devuelve usuario sin passwordHash', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      userRepository.findOne.mockResolvedValueOnce(null); // sin conflicto de email
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('user-1', 'admin-id', dto);

      expect(result).toEqual({ ...userResponse, email: 'nuevo@ondra.com' });
      expect(userRepository.update).toHaveBeenCalledWith('user-1', dto);
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(service.update('user-1', 'user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', 'admin-id', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza ConflictException si el email ya pertenece a otro usuario', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      userRepository.findOne.mockResolvedValueOnce({ ...mockUser, id: 'other-user' });

      await expect(service.update('user-1', 'admin-id', dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateStatus', () => {
    it('actualiza isActive y devuelve el usuario actualizado', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus('user-1', 'admin-id', false);

      expect(result.isActive).toBe(false);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { isActive: false });
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(service.updateStatus('user-1', 'user-1', false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'admin-id', false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('genera nueva contraseña, setea mustChangePassword y devuelve solo el texto plano', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (passwordUtil.generateRandomPassword as jest.Mock).mockReturnValue('newplain456');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_newplain456');
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.resetPassword('user-1', 'admin-id');

      expect(result).toEqual({ plainPassword: 'newplain456' });
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        passwordHash: 'hashed_newplain456',
        mustChangePassword: true,
      });
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(service.resetPassword('user-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.resetPassword('nonexistent', 'admin-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan (el service no existe aún)**

```bash
cd backend && npx jest --no-coverage users.service.spec
```

Expected: error `Cannot find module './users.service'`.

---

## Task 4: Implementar UsersService

**Files:**
- Create: `backend/src/users/users.service.ts`

- [ ] **Step 1: Crear el service**

```typescript
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Not, Repository } from 'typeorm';
import { generateRandomPassword } from '../common/utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

export type UserResponse = Omit<User, 'passwordHash' | 'lastLogoutAt'>;
export type CreateUserResponse = UserResponse & { plainPassword: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<UserResponse[]> {
    const users = await this.userRepository.find({ order: { createdAt: 'ASC' } });
    return users.map((u) => this.toResponse(u));
  }

  async create(dto: CreateUserDto): Promise<CreateUserResponse> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('El email ya está en uso');
    }

    const plainPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      role: dto.role,
      passwordHash,
      mustChangePassword: true,
    });

    const saved = await this.userRepository.save(user);
    return { ...this.toResponse(saved), plainPassword };
  }

  async update(
    id: string,
    currentUserId: string,
    dto: UpdateUserDto,
  ): Promise<UserResponse> {
    if (id === currentUserId) {
      throw new ForbiddenException('No podés editar tu propio usuario');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.email) {
      const conflict = await this.userRepository.findOne({
        where: { email: dto.email, id: Not(id) },
      });
      if (conflict) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    await this.userRepository.update(id, dto);
    return this.toResponse({ ...user, ...dto } as User);
  }

  async updateStatus(
    id: string,
    currentUserId: string,
    isActive: boolean,
  ): Promise<UserResponse> {
    if (id === currentUserId) {
      throw new ForbiddenException('No podés editar tu propio usuario');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.userRepository.update(id, { isActive });
    return this.toResponse({ ...user, isActive });
  }

  async resetPassword(
    id: string,
    currentUserId: string,
  ): Promise<{ plainPassword: string }> {
    if (id === currentUserId) {
      throw new ForbiddenException('No podés editar tu propio usuario');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const plainPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await this.userRepository.update(id, { passwordHash, mustChangePassword: true });
    return { plainPassword };
  }

  private toResponse(user: User): UserResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, lastLogoutAt, ...response } = user;
    return response;
  }
}
```

- [ ] **Step 2: Correr los tests y verificar que pasan**

```bash
cd backend && npx jest --no-coverage users.service.spec
```

Expected: 11 tests en verde.

- [ ] **Step 3: Commit**

```bash
git add backend/src/users/users.service.ts backend/src/users/users.service.spec.ts
git commit -m "feat(users): UsersService con TDD — findAll, create, update, updateStatus, resetPassword"
```

---

## Task 5: Escribir los tests de UsersController (deben fallar)

**Files:**
- Create: `backend/src/users/users.controller.spec.ts`

- [ ] **Step 1: Crear el archivo de tests**

```typescript
import { Test } from '@nestjs/testing';
import { UserRole } from '../user-role.enum';
import { JwtPayload } from '../auth/auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    resetPassword: jest.Mock;
  };

  const currentUser: JwtPayload = {
    sub: 'admin-id',
    email: 'admin@ondra.com',
    role: UserRole.ADMIN,
    mustChangePassword: false,
  };

  beforeEach(async () => {
    usersService = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      resetPassword: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get(UsersController);
  });

  describe('findAll', () => {
    it('llama a usersService.findAll y devuelve el resultado', async () => {
      const mockList = [{ id: 'user-1', name: 'Lea' }];
      usersService.findAll.mockResolvedValue(mockList);

      const result = await controller.findAll();

      expect(usersService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockList);
    });
  });

  describe('create', () => {
    it('llama a usersService.create con el dto y devuelve el resultado', async () => {
      const dto: CreateUserDto = {
        name: 'Valen López',
        email: 'valen@ondra.com',
        role: UserRole.TECHNICIAN,
      };
      const mockResult = { ...dto, id: 'user-2', plainPassword: 'abc123' };
      usersService.create.mockResolvedValue(mockResult);

      const result = await controller.create(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('update', () => {
    it('llama a usersService.update con id, sub del usuario actual y dto', async () => {
      const dto: UpdateUserDto = { email: 'nuevo@ondra.com' };
      const mockResult = { id: 'user-1', email: 'nuevo@ondra.com' };
      usersService.update.mockResolvedValue(mockResult);

      const result = await controller.update('user-1', currentUser, dto);

      expect(usersService.update).toHaveBeenCalledWith('user-1', 'admin-id', dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateStatus', () => {
    it('llama a usersService.updateStatus con id, sub del usuario actual e isActive', async () => {
      const dto: UpdateUserStatusDto = { isActive: false };
      const mockResult = { id: 'user-1', isActive: false };
      usersService.updateStatus.mockResolvedValue(mockResult);

      const result = await controller.updateStatus('user-1', currentUser, dto);

      expect(usersService.updateStatus).toHaveBeenCalledWith('user-1', 'admin-id', false);
      expect(result).toEqual(mockResult);
    });
  });

  describe('resetPassword', () => {
    it('llama a usersService.resetPassword con id y sub del usuario actual', async () => {
      const mockResult = { plainPassword: 'newpass123' };
      usersService.resetPassword.mockResolvedValue(mockResult);

      const result = await controller.resetPassword('user-1', currentUser);

      expect(usersService.resetPassword).toHaveBeenCalledWith('user-1', 'admin-id');
      expect(result).toEqual(mockResult);
    });
  });
});
```

- [ ] **Step 2: Verificar que los tests fallan (el controller no existe aún)**

```bash
cd backend && npx jest --no-coverage users.controller.spec
```

Expected: error `Cannot find module './users.controller'`.

---

## Task 6: Implementar UsersController

**Files:**
- Create: `backend/src/users/users.controller.ts`

- [ ] **Step 1: Crear el controller**

```typescript
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { UserRole } from './user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import {
  CreateUserResponse,
  UserResponse,
  UsersService,
} from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(): Promise<UserResponse[]> {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto): Promise<CreateUserResponse> {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.usersService.update(id, currentUser.sub, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponse> {
    return this.usersService.updateStatus(id, currentUser.sub, dto.isActive);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ plainPassword: string }> {
    return this.usersService.resetPassword(id, currentUser.sub);
  }
}
```

- [ ] **Step 2: Correr los tests y verificar que pasan**

```bash
cd backend && npx jest --no-coverage users.controller.spec
```

Expected: 5 tests en verde.

- [ ] **Step 3: Commit**

```bash
git add backend/src/users/users.controller.ts backend/src/users/users.controller.spec.ts
git commit -m "feat(users): UsersController con TDD — 5 endpoints ADMIN"
```

---

## Task 7: Crear UsersModule y cablear AuthModule + AppModule

**Files:**
- Create: `backend/src/users/users.module.ts`
- Modify: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Crear `users.module.ts`**

`UsersModule` registra la entidad `User`, exporta el repositorio (vía `TypeOrmModule`), y provee los guards para que `UsersController` pueda usarlos.

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, JwtAuthGuard, RolesGuard],
  exports: [TypeOrmModule],
})
export class UsersModule {}
```

- [ ] **Step 2: Actualizar `auth.module.ts` para importar UsersModule**

Reemplazar el contenido de `backend/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is not set');
        }
        return { secret, signOptions: { expiresIn: '24h' } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard, AuthService],
})
export class AuthModule {}
```

> Nota: se elimina `TypeOrmModule.forFeature([User])` de AuthModule — el repositorio de `User` ahora llega importando `UsersModule` (que exporta `TypeOrmModule`).

- [ ] **Step 3: Actualizar `app.module.ts` para importar UsersModule**

Reemplazar el contenido de `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

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
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Correr todos los tests**

```bash
cd backend && npx jest --no-coverage
```

Expected: todos los tests en verde (auth + users).

- [ ] **Step 5: Commit final**

```bash
git add backend/src/users/users.module.ts backend/src/auth/auth.module.ts backend/src/app.module.ts
git commit -m "feat(users): módulo users completo — wiring con AuthModule y AppModule"
```