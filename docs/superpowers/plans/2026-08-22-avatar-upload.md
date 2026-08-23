# Avatar Upload — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir a cada usuario subir una foto de perfil y mostrarla consistentemente en toolbar, perfil, admin y selects de técnico; con validación de seguridad en 5 capas.

**Architecture:** El backend almacena solo el filename UUID en la columna `avatar_path`, sirve los archivos como estáticos desde `/avatars/`, y construye la URL completa en capa de servicio. El frontend tiene un `UserAvatarComponent` compartido con fallback a inicial; `AuthService` usa un `BehaviorSubject` para propagar cambios sin recarga.

**Tech Stack:** NestJS, TypeORM, Multer (memoryStorage), file-type@16, @nestjs/serve-static, Angular, Angular Material, RxJS BehaviorSubject

**Spec:** `docs/superpowers/specs/2026-08-22-avatar-upload-design.md`

## Global Constraints

- Idioma del código: inglés. Idioma de commits: español.
- TDD obligatorio: test antes que implementación.
- Sin standalone components en Angular.
- Solo `appearance="outline"` en `mat-form-field`.
- Sin elementos HTML nativos (`<button>`, `<input>` fuera de `matInput`) en templates Angular.
- `file-type@16` (CJS compatible) — no instalar v17+ (ESM-only).
- `multer` usa `memoryStorage()`, nunca `diskStorage()` para el avatar — la validación de magic bytes necesita el buffer antes de escribir en disco.
- El directorio de uploads se crea programáticamente con `fs.mkdir(..., { recursive: true })`.

---

## Mapa de archivos

### Backend — crear
- `backend/src/migrations/1787500000000-AddAvatarPathToUser.ts`

### Backend — modificar
- `backend/src/users/user.entity.ts` — columna `avatarPath`
- `backend/src/users/users.service.ts` — tipo `UserResponse` explícito, `toResponse()`, `getMe()`, `uploadAvatar()`
- `backend/src/users/users.service.spec.ts` — tests nuevos
- `backend/src/users/users.controller.ts` — endpoints GET y POST /users/me/avatar
- `backend/src/users/users.controller.spec.ts` — tests nuevos
- `backend/src/users/users.module.ts` — MulterModule
- `backend/src/auth/dto/login-response.dto.ts` — agrega `name`, `avatarUrl`
- `backend/src/auth/auth.service.ts` — incluye `name` y `avatarUrl` en login response
- `backend/src/auth/auth.service.spec.ts` — test login response
- `backend/src/technicians/technicians.service.ts` — `toResponse()` con `avatarUrl`
- `backend/src/technicians/technicians.service.spec.ts` — test `avatarUrl` en response
- `backend/src/app.module.ts` — ServeStaticModule

### Frontend — crear
- `frontend/src/app/shared/components/user-avatar/user-avatar.component.ts`
- `frontend/src/app/shared/components/user-avatar/user-avatar.component.html`
- `frontend/src/app/shared/components/user-avatar/user-avatar.component.scss`
- `frontend/src/app/shared/components/user-avatar/user-avatar.component.spec.ts`

### Frontend — modificar
- `frontend/src/app/core/models/auth.models.ts` — `AuthUser` agrega `name`, `avatarUrl`
- `frontend/src/app/core/models/user.models.ts` — `User` agrega `avatarUrl`
- `frontend/src/app/core/models/task.models.ts` — `Task.technician.user` agrega `avatarUrl`
- `frontend/src/app/core/models/technician.models.ts` — `Technician.user` agrega `avatarUrl`
- `frontend/src/app/core/services/auth.service.ts` — BehaviorSubject, `user$`, `refreshCurrentUser()`
- `frontend/src/app/core/services/auth.service.spec.ts` — tests nuevos
- `frontend/src/app/core/services/users.service.ts` — `getMe()`, `uploadAvatar()`
- `frontend/src/app/core/services/users.service.spec.ts` — tests nuevos
- `frontend/src/app/shared/shared.module.ts` — declara y exporta `UserAvatarComponent`
- `frontend/src/app/features/profile/profile.component.ts` — upload logic
- `frontend/src/app/features/profile/profile.component.html` — upload UI
- `frontend/src/app/features/profile/profile.component.scss` — estilos
- `frontend/src/app/features/profile/profile.component.spec.ts`
- `frontend/src/app/features/profile/profile.module.ts` — imports
- `frontend/src/app/core/shell/shell.component.ts` — suscribe a `user$`
- `frontend/src/app/core/shell/shell.component.html` — `<app-user-avatar>`
- `frontend/src/app/core/shell/shell.component.spec.ts`
- `frontend/src/app/core/shell/shell.module.ts` — importa SharedModule
- `frontend/src/app/features/admin/users/users.component.ts` — columna avatar
- `frontend/src/app/features/admin/users/users.component.html` — columna avatar
- `frontend/src/app/features/tasks/cycle-table/cycle-table.component.html` — reemplaza `.avatar` span
- `frontend/src/app/features/tasks/tasks-unified.component.html` — select técnico con avatar
- `frontend/src/app/features/tasks/tasks-unified.component.ts` — getter `selectedTechnicianObj`
- `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.html`
- `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.ts`
- `frontend/src/app/features/schedules/config-tab/config-tab.component.html`
- `frontend/src/app/features/schedules/config-tab/config-tab.component.ts`

---

## Task 1: Backend — Entity + Migration + UserResponse + LoginResponse

**Files:**
- Modify: `backend/src/users/user.entity.ts`
- Create: `backend/src/migrations/1787500000000-AddAvatarPathToUser.ts`
- Modify: `backend/src/users/users.service.ts`
- Modify: `backend/src/users/users.service.spec.ts`
- Modify: `backend/src/auth/dto/login-response.dto.ts`
- Modify: `backend/src/auth/auth.service.ts`
- Modify: `backend/src/auth/auth.service.spec.ts`

**Interfaces:**
- Produces: `UserResponse` con `avatarUrl: string | null`, sin `avatarPath`; `LoginResponseDto.user` con `name` y `avatarUrl`

---

- [ ] **Step 1: Escribir test — login response incluye name y avatarUrl**

En `backend/src/auth/auth.service.spec.ts`, agregar caso:

```typescript
it('should include name and avatarUrl in login user response', async () => {
  // Arrange: el mock de userRepository.findOne retorna user con name y avatarPath
  const mockUser = {
    id: 'uuid-1', name: 'Leandro Aguilera', email: 'test@test.com',
    passwordHash: await bcrypt.hash('pass', 1), role: UserRole.ADMIN,
    mustChangePassword: false, isActive: true,
    technicianId: null, avatarPath: 'abc123.jpg',
    lastLogoutAt: null, odooUserId: null, odooSyncedAt: null, odooEmployeeId: null,
    createdAt: new Date(),
  };
  jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
  jest.spyOn(jwtService, 'sign').mockReturnValue('token');

  // Act
  const result = await service.login({ email: 'test@test.com', password: 'pass' });

  // Assert
  expect(result.user.name).toBe('Leandro Aguilera');
  expect(result.user.avatarUrl).toBe('/avatars/abc123.jpg');
});

it('should set avatarUrl to null when avatarPath is null', async () => {
  const mockUser = {
    id: 'uuid-1', name: 'Sin Foto', email: 'test@test.com',
    passwordHash: await bcrypt.hash('pass', 1), role: UserRole.ADMIN,
    mustChangePassword: false, isActive: true,
    technicianId: null, avatarPath: null,
    lastLogoutAt: null, odooUserId: null, odooSyncedAt: null, odooEmployeeId: null,
    createdAt: new Date(),
  };
  jest.spyOn(userRepo, 'findOne').mockResolvedValue(mockUser as any);
  jest.spyOn(jwtService, 'sign').mockReturnValue('token');

  const result = await service.login({ email: 'test@test.com', password: 'pass' });

  expect(result.user.avatarUrl).toBeNull();
});
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
cd backend && npx jest auth.service.spec --no-coverage
```
Expected: FAIL con "result.user.name is undefined"

- [ ] **Step 3: Agregar columna avatarPath en User entity**

En `backend/src/users/user.entity.ts`, después del campo `odooEmployeeId`:

```typescript
@Column({ name: 'avatar_path', type: 'varchar', nullable: true, default: null })
avatarPath: string | null;
```

- [ ] **Step 4: Crear migración**

Crear `backend/src/migrations/1787500000000-AddAvatarPathToUser.ts`:

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAvatarPathToUser1787500000000 implements MigrationInterface {
  name = 'AddAvatarPathToUser1787500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "avatar_path" character varying DEFAULT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_path"`);
  }
}
```

- [ ] **Step 5: Reemplazar UserResponse por tipo explícito y actualizar toResponse()**

En `backend/src/users/users.service.ts`, reemplazar el tipo y el método:

```typescript
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { join } from 'path';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

export type UserResponse = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  isActive: boolean;
  technicianId: string | null;
  odooUserId: number | null;
  odooSyncedAt: Date | null;
  odooEmployeeId: number | null;
  avatarUrl: string | null;
  createdAt: Date;
};

export type CreateUserResponse = UserResponse & { plainPassword: string };

// Dentro de UsersService:
private toResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
    technicianId: user.technicianId,
    odooUserId: user.odooUserId,
    odooSyncedAt: user.odooSyncedAt,
    odooEmployeeId: user.odooEmployeeId,
    avatarUrl: user.avatarPath ? `/avatars/${user.avatarPath}` : null,
    createdAt: user.createdAt,
  };
}
```

- [ ] **Step 6: Actualizar LoginResponseDto**

En `backend/src/auth/dto/login-response.dto.ts`:

```typescript
import { UserRole } from '../../users/user-role.enum';

export class LoginResponseDto {
  accessToken: string;
  mustChangePassword: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    technicianId: string | null;
    avatarUrl: string | null;
  };
}
```

- [ ] **Step 7: Actualizar auth.service.ts — login incluye name y avatarUrl**

En `backend/src/auth/auth.service.ts`, dentro de `login()`:

```typescript
return {
  accessToken: this.jwtService.sign(payload),
  mustChangePassword: user.mustChangePassword,
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    technicianId: user.technicianId ?? null,
    avatarUrl: user.avatarPath ? `/avatars/${user.avatarPath}` : null,
  },
};
```

- [ ] **Step 8: Correr tests — verificar que pasan**

```bash
cd backend && npx jest auth.service.spec --no-coverage
```
Expected: PASS

- [ ] **Step 9: Test — toResponse expone avatarUrl y NO expone avatarPath**

En `backend/src/users/users.service.spec.ts`:

```typescript
describe('toResponse (via findAll)', () => {
  it('construye avatarUrl desde avatarPath', async () => {
    const mockUser = buildMockUser({ avatarPath: 'uuid-file.jpg' });
    jest.spyOn(repo, 'find').mockResolvedValue([mockUser]);

    const [result] = await service.findAll();

    expect(result.avatarUrl).toBe('/avatars/uuid-file.jpg');
    expect((result as any).avatarPath).toBeUndefined();
  });

  it('retorna avatarUrl null cuando avatarPath es null', async () => {
    const mockUser = buildMockUser({ avatarPath: null });
    jest.spyOn(repo, 'find').mockResolvedValue([mockUser]);

    const [result] = await service.findAll();

    expect(result.avatarUrl).toBeNull();
  });
});

// Helper al final del archivo de spec:
function buildMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'uuid-1', name: 'Test User', email: 'test@test.com',
    passwordHash: 'hash', role: UserRole.ADMIN, mustChangePassword: false,
    isActive: true, technicianId: null, avatarPath: null, lastLogoutAt: null,
    odooUserId: null, odooSyncedAt: null, odooEmployeeId: null,
    createdAt: new Date(), technician: null,
    ...overrides,
  } as User;
}
```

- [ ] **Step 10: Correr tests del users.service — verificar que pasan**

```bash
cd backend && npx jest users.service.spec --no-coverage
```
Expected: PASS

- [ ] **Step 11: Correr migración**

```bash
cd backend && npx typeorm migration:run -d src/data-source.ts
```
(o el comando equivalente configurado en el proyecto — verificar `package.json` scripts)

- [ ] **Step 12: Commit**

```bash
git add backend/src/users/user.entity.ts \
        backend/src/migrations/1787500000000-AddAvatarPathToUser.ts \
        backend/src/users/users.service.ts \
        backend/src/users/users.service.spec.ts \
        backend/src/auth/dto/login-response.dto.ts \
        backend/src/auth/auth.service.ts \
        backend/src/auth/auth.service.spec.ts
git commit -m "feat(users): agregar columna avatarPath y exponer avatarUrl en respuestas"
```

---

## Task 2: Backend — GET /users/me

**Files:**
- Modify: `backend/src/users/users.service.ts` — método `getMe()`
- Modify: `backend/src/users/users.controller.ts` — endpoint GET /users/me
- Modify: `backend/src/users/users.service.spec.ts`
- Modify: `backend/src/users/users.controller.spec.ts`

**Interfaces:**
- Consumes: `UserResponse` de Task 1
- Produces: `GET /users/me` accesible para todos los roles, retorna `UserResponse`

---

- [ ] **Step 1: Escribir test — getMe retorna el usuario correcto**

En `backend/src/users/users.service.spec.ts`:

```typescript
describe('getMe', () => {
  it('retorna UserResponse del usuario autenticado', async () => {
    const mockUser = buildMockUser({ id: 'my-uuid', name: 'Yo', avatarPath: null });
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockUser);

    const result = await service.getMe('my-uuid');

    expect(result.id).toBe('my-uuid');
    expect(result.name).toBe('Yo');
    expect(result.avatarUrl).toBeNull();
  });

  it('lanza NotFoundException si el usuario no existe', async () => {
    jest.spyOn(repo, 'findOne').mockResolvedValue(null);
    await expect(service.getMe('no-existe')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Correr test — verificar que falla**

```bash
cd backend && npx jest users.service.spec --no-coverage
```
Expected: FAIL con "service.getMe is not a function"

- [ ] **Step 3: Implementar getMe en UsersService**

En `backend/src/users/users.service.ts`:

```typescript
async getMe(userId: string): Promise<UserResponse> {
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) throw new NotFoundException('Usuario no encontrado');
  return this.toResponse(user);
}
```

- [ ] **Step 4: Correr test — verificar que pasa**

```bash
cd backend && npx jest users.service.spec --no-coverage
```
Expected: PASS

- [ ] **Step 5: Escribir test del controller para GET /users/me**

En `backend/src/users/users.controller.spec.ts`:

```typescript
describe('GET /users/me', () => {
  it('llama a usersService.getMe con el userId del token', async () => {
    const mockUser: UserResponse = {
      id: 'uuid-1', name: 'Test', email: 'test@test.com', role: UserRole.ADMIN,
      mustChangePassword: false, isActive: true, technicianId: null,
      odooUserId: null, odooSyncedAt: null, odooEmployeeId: null,
      avatarUrl: null, createdAt: new Date(),
    };
    const getMeSpy = jest.spyOn(service, 'getMe').mockResolvedValue(mockUser);

    const result = await controller.getMe({ sub: 'uuid-1', email: 'test@test.com', role: UserRole.ADMIN, mustChangePassword: false, iat: 0, exp: 0 });

    expect(getMeSpy).toHaveBeenCalledWith('uuid-1');
    expect(result).toEqual(mockUser);
  });
});
```

- [ ] **Step 6: Agregar endpoint al controller**

En `backend/src/users/users.controller.ts`, agregar imports y método:

```typescript
import { Get, Post, ... } from '@nestjs/common';
// Agregar UserRole al import existente
import { UserRole } from './user-role.enum';

// Dentro de UsersController, ANTES de los métodos existentes:
@Get('me')
@Roles(UserRole.ADMIN, UserRole.TL, UserRole.COORDINATOR, UserRole.TECHNICIAN)
getMe(@CurrentUser() currentUser: JwtPayload): Promise<UserResponse> {
  return this.usersService.getMe(currentUser.sub);
}
```

**Nota:** `@Roles` a nivel de método sobreescribe el `@Roles(UserRole.ADMIN)` de clase gracias a `getAllAndOverride` del RolesGuard.

- [ ] **Step 7: Correr todos los tests del módulo users**

```bash
cd backend && npx jest users --no-coverage
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/users/users.service.ts \
        backend/src/users/users.service.spec.ts \
        backend/src/users/users.controller.ts \
        backend/src/users/users.controller.spec.ts
git commit -m "feat(users): agregar endpoint GET /users/me para todos los roles"
```

---

## Task 3: Backend — POST /users/me/avatar

**Files:**
- Modify: `backend/src/users/users.service.ts` — `uploadAvatar()`
- Modify: `backend/src/users/users.service.spec.ts`
- Modify: `backend/src/users/users.controller.ts` — endpoint POST /users/me/avatar
- Modify: `backend/src/users/users.controller.spec.ts`
- Modify: `backend/src/users/users.module.ts` — MulterModule

**Interfaces:**
- Consumes: `UserResponse` de Task 1, `getMe` de Task 2
- Produces: `POST /users/me/avatar` con validación 5 capas, retorna `UserResponse`

---

- [ ] **Step 1: Instalar dependencias**

```bash
cd backend && npm install file-type@16
# Verificar que @types/multer está instalado — multer viene con @nestjs/platform-express
npx tsc --version  # verificar que compila luego del install
```

- [ ] **Step 2: Escribir tests de uploadAvatar**

En `backend/src/users/users.service.spec.ts`:

```typescript
// Importar al tope del archivo:
// import * as fileType from 'file-type';
// jest.mock('file-type');

describe('uploadAvatar', () => {
  const mockPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // magic bytes PNG

  beforeEach(() => {
    jest.mock('file-type', () => ({
      fromBuffer: jest.fn(),
    }));
  });

  it('lanza BadRequestException si el tipo detectado no está en la whitelist', async () => {
    const { fromBuffer } = await import('file-type');
    (fromBuffer as jest.Mock).mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });

    const file = { buffer: Buffer.from('fake'), originalname: 'doc.pdf' } as Express.Multer.File;

    await expect(service.uploadAvatar('uuid-1', file)).rejects.toThrow(BadRequestException);
  });

  it('lanza BadRequestException si file-type no reconoce el archivo', async () => {
    const { fromBuffer } = await import('file-type');
    (fromBuffer as jest.Mock).mockResolvedValue(undefined);

    const file = { buffer: Buffer.from('not-an-image'), originalname: 'x.png' } as Express.Multer.File;

    await expect(service.uploadAvatar('uuid-1', file)).rejects.toThrow(BadRequestException);
  });

  it('guarda el archivo y retorna UserResponse con avatarUrl actualizado', async () => {
    const { fromBuffer } = await import('file-type');
    (fromBuffer as jest.Mock).mockResolvedValue({ mime: 'image/png', ext: 'png' });

    const mockUser = buildMockUser({ id: 'uuid-1', avatarPath: null });
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockUser);
    jest.spyOn(repo, 'update').mockResolvedValue({ affected: 1 } as any);

    // Mock fs
    jest.spyOn(require('fs/promises'), 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(require('fs/promises'), 'rm').mockResolvedValue(undefined);

    const file = { buffer: mockPngBuffer, originalname: 'photo.png' } as Express.Multer.File;

    const result = await service.uploadAvatar('uuid-1', file);

    expect(result.avatarUrl).toMatch(/^\/avatars\/.+\.png$/);
    expect(repo.update).toHaveBeenCalledWith('uuid-1', expect.objectContaining({ avatarPath: expect.stringMatching(/\.png$/) }));
  });

  it('elimina el avatar anterior antes de guardar el nuevo', async () => {
    const { fromBuffer } = await import('file-type');
    (fromBuffer as jest.Mock).mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });

    const mockUser = buildMockUser({ id: 'uuid-1', avatarPath: 'old-uuid.jpg' });
    jest.spyOn(repo, 'findOne').mockResolvedValue(mockUser);
    jest.spyOn(repo, 'update').mockResolvedValue({ affected: 1 } as any);

    const rmSpy = jest.spyOn(require('fs/promises'), 'rm').mockResolvedValue(undefined);
    jest.spyOn(require('fs/promises'), 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(require('fs/promises'), 'writeFile').mockResolvedValue(undefined);

    const file = { buffer: Buffer.from('jpg-data'), originalname: 'new.jpg' } as Express.Multer.File;
    await service.uploadAvatar('uuid-1', file);

    expect(rmSpy).toHaveBeenCalledWith(expect.stringContaining('old-uuid.jpg'), { force: true });
  });
});
```

- [ ] **Step 3: Correr tests — verificar que fallan**

```bash
cd backend && npx jest users.service.spec --no-coverage
```
Expected: FAIL con "service.uploadAvatar is not a function"

- [ ] **Step 4: Implementar uploadAvatar en UsersService**

En `backend/src/users/users.service.ts`, agregar imports al tope y el método:

```typescript
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { join } from 'path';

// Dentro de UsersService:
async uploadAvatar(userId: string, file: Express.Multer.File): Promise<UserResponse> {
  const { fromBuffer } = await import('file-type');
  const detected = await fromBuffer(file.buffer);
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!detected || !allowedMimes.includes(detected.mime)) {
    throw new BadRequestException('Tipo de archivo no permitido');
  }

  const filename = `${randomUUID()}.${detected.ext}`;
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) throw new NotFoundException('Usuario no encontrado');

  if (user.avatarPath) {
    await fs.rm(
      join(process.cwd(), 'uploads', 'avatars', user.avatarPath),
      { force: true },
    );
  }

  const dir = join(process.cwd(), 'uploads', 'avatars');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, filename), file.buffer);
  await this.userRepository.update(userId, { avatarPath: filename });

  return this.toResponse({ ...user, avatarPath: filename });
}
```

- [ ] **Step 5: Correr tests — verificar que pasan**

```bash
cd backend && npx jest users.service.spec --no-coverage
```
Expected: PASS

- [ ] **Step 6: Agregar endpoint al controller**

En `backend/src/users/users.controller.ts`:

```typescript
import {
  Body, Controller, Get, Param, ParseUUIDPipe,
  Patch, Post, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

// Dentro de UsersController:
@Post('me/avatar')
@Roles(UserRole.ADMIN, UserRole.TL, UserRole.COORDINATOR, UserRole.TECHNICIAN)
@UseInterceptors(FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new BadRequestException('Tipo de archivo no permitido'), false);
    }
    cb(null, true);
  },
}))
uploadAvatar(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() currentUser: JwtPayload,
): Promise<UserResponse> {
  return this.usersService.uploadAvatar(currentUser.sub, file);
}
```

- [ ] **Step 7: Agregar test del controller**

En `backend/src/users/users.controller.spec.ts`:

```typescript
describe('POST /users/me/avatar', () => {
  it('llama a usersService.uploadAvatar con userId y file', async () => {
    const mockResponse: UserResponse = {
      id: 'uuid-1', name: 'Test', email: 'test@test.com', role: UserRole.ADMIN,
      mustChangePassword: false, isActive: true, technicianId: null,
      odooUserId: null, odooSyncedAt: null, odooEmployeeId: null,
      avatarUrl: '/avatars/new-uuid.jpg', createdAt: new Date(),
    };
    const uploadSpy = jest.spyOn(service, 'uploadAvatar').mockResolvedValue(mockResponse);
    const mockFile = { buffer: Buffer.from('data'), originalname: 'photo.jpg' } as Express.Multer.File;
    const mockJwt = { sub: 'uuid-1', email: 'test@test.com', role: UserRole.ADMIN, mustChangePassword: false, iat: 0, exp: 0 };

    const result = await controller.uploadAvatar(mockFile, mockJwt);

    expect(uploadSpy).toHaveBeenCalledWith('uuid-1', mockFile);
    expect(result.avatarUrl).toBe('/avatars/new-uuid.jpg');
  });
});
```

- [ ] **Step 8: Actualizar UsersModule para importar MulterModule**

En `backend/src/users/users.module.ts`:

```typescript
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

// En imports del @NgModule:
MulterModule.register({ storage: memoryStorage() }),
```

- [ ] **Step 9: Correr todos los tests de users**

```bash
cd backend && npx jest users --no-coverage
```
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add backend/src/users/users.service.ts \
        backend/src/users/users.service.spec.ts \
        backend/src/users/users.controller.ts \
        backend/src/users/users.controller.spec.ts \
        backend/src/users/users.module.ts \
        package.json package-lock.json
git commit -m "feat(users): agregar endpoint POST /users/me/avatar con validación de seguridad en 5 capas"
```

---

## Task 4: Backend — Static serving + TechnicianUserResponse con avatarUrl

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/technicians/technicians.service.ts`
- Modify: `backend/src/technicians/technicians.service.spec.ts`

**Interfaces:**
- Consumes: `UserResponse` de Task 1 (patrón `avatarUrl` de `avatarPath`)
- Produces: `/avatars/:filename` accesible como HTTP; `TechnicianUserResponse.user` incluye `avatarUrl`

---

- [ ] **Step 1: Instalar @nestjs/serve-static**

```bash
cd backend && npm install @nestjs/serve-static
```

- [ ] **Step 2: Configurar ServeStaticModule en app.module.ts**

En `backend/src/app.module.ts`:

```typescript
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// En el array imports, agregar antes de los módulos de dominio:
ServeStaticModule.forRoot({
  rootPath: join(process.cwd(), 'uploads', 'avatars'),
  serveRoot: '/avatars',
  serveStaticOptions: { index: false },
}),
```

- [ ] **Step 3: Escribir test — TechnicianUserResponse incluye avatarUrl**

En `backend/src/technicians/technicians.service.spec.ts`:

```typescript
it('incluye avatarUrl en el user del response', async () => {
  const mockUser = {
    id: 'u1', name: 'Val', email: 'val@test.com', role: UserRole.TECHNICIAN,
    mustChangePassword: false, isActive: true, technicianId: 'tech-1',
    avatarPath: 'photo.jpg', lastLogoutAt: null,
    odooUserId: null, odooSyncedAt: null, odooEmployeeId: null,
    createdAt: new Date(),
    technician: { id: 'tech-1', createdAt: new Date() },
  };
  jest.spyOn(userRepo, 'find').mockResolvedValue([mockUser] as any);

  const [result] = await service.findAll();

  expect(result.user.avatarUrl).toBe('/avatars/photo.jpg');
  expect((result.user as any).avatarPath).toBeUndefined();
});

it('retorna avatarUrl null cuando avatarPath es null', async () => {
  const mockUser = {
    id: 'u1', name: 'Sin Foto', email: 'sf@test.com', role: UserRole.TECHNICIAN,
    mustChangePassword: false, isActive: true, technicianId: 'tech-2',
    avatarPath: null, lastLogoutAt: null,
    odooUserId: null, odooSyncedAt: null, odooEmployeeId: null,
    createdAt: new Date(),
    technician: { id: 'tech-2', createdAt: new Date() },
  };
  jest.spyOn(userRepo, 'find').mockResolvedValue([mockUser] as any);

  const [result] = await service.findAll();

  expect(result.user.avatarUrl).toBeNull();
});
```

- [ ] **Step 4: Correr test — verificar que falla**

```bash
cd backend && npx jest technicians.service.spec --no-coverage
```
Expected: FAIL

- [ ] **Step 5: Actualizar TechnicianUserResponse y toResponse() en technicians.service.ts**

En `backend/src/technicians/technicians.service.ts`:

```typescript
export type TechnicianUserResponse = {
  id: string;
  createdAt: Date;
  user: Omit<
    User,
    'passwordHash' | 'lastLogoutAt' | 'technician' | 'technicianId' | 'avatarPath'
  > & { avatarUrl: string | null };
};

// Actualizar toResponse():
private toResponse(user: User): TechnicianUserResponse {
  const { passwordHash, lastLogoutAt, technician, technicianId, avatarPath, ...userFields } = user;
  return {
    id: technicianId!,
    createdAt: technician!.createdAt,
    user: {
      ...userFields,
      avatarUrl: avatarPath ? `/avatars/${avatarPath}` : null,
    },
  };
}
```

- [ ] **Step 6: Correr tests — verificar que pasan**

```bash
cd backend && npx jest technicians --no-coverage
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/app.module.ts \
        backend/src/technicians/technicians.service.ts \
        backend/src/technicians/technicians.service.spec.ts \
        package.json package-lock.json
git commit -m "feat(technicians): incluir avatarUrl en response y configurar serving estático de avatares"
```

---

## Task 5: Frontend — Models + AuthService + UsersService

**Files:**
- Modify: `frontend/src/app/core/models/auth.models.ts`
- Modify: `frontend/src/app/core/models/user.models.ts`
- Modify: `frontend/src/app/core/models/task.models.ts`
- Modify: `frontend/src/app/core/models/technician.models.ts`
- Modify: `frontend/src/app/core/services/auth.service.ts`
- Modify: `frontend/src/app/core/services/auth.service.spec.ts`
- Modify: `frontend/src/app/core/services/users.service.ts`
- Modify: `frontend/src/app/core/services/users.service.spec.ts`

**Interfaces:**
- Produces: `AuthUser` con `name` y `avatarUrl`; `AuthService.user$`; `UsersService.uploadAvatar()`, `getMe()`

---

- [ ] **Step 1: Actualizar interfaces de modelos**

`frontend/src/app/core/models/auth.models.ts`:

```typescript
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  technicianId?: string | null;
  avatarUrl: string | null;
}
// LoginResponse y JwtPayload no cambian
```

`frontend/src/app/core/models/user.models.ts` — agregar `avatarUrl: string | null` a la interfaz `User`.

`frontend/src/app/core/models/task.models.ts` — en la interfaz `Task`:
```typescript
technician?: { id: string; user: { id: string; name: string; email: string; avatarUrl: string | null } };
```

`frontend/src/app/core/models/technician.models.ts` — `Technician.user` ya usa `Omit<User, 'technicianId'>` que heredará `avatarUrl` automáticamente al actualizar `User`.

- [ ] **Step 2: Escribir tests de AuthService**

En `frontend/src/app/core/services/auth.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from './auth.service';
import { AuthUser } from '../models/auth.models';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [AuthService],
    });
    service = TestBed.inject(AuthService);
    localStorage.clear();
  });

  it('user$ emite null cuando no hay usuario en localStorage', (done) => {
    service.user$.subscribe(user => {
      expect(user).toBeNull();
      done();
    });
  });

  it('refreshCurrentUser actualiza localStorage y emite el nuevo usuario', (done) => {
    const updated: AuthUser = {
      id: 'u1', name: 'Leandro', email: 'l@test.com',
      role: 'ADMIN', technicianId: null, avatarUrl: '/avatars/uuid.jpg',
    };
    service.refreshCurrentUser(updated);

    service.user$.subscribe(user => {
      expect(user).toEqual(updated);
      expect(JSON.parse(localStorage.getItem('user')!)).toEqual(updated);
      done();
    });
  });

  it('user$ emite null luego de logout()', (done) => {
    const mockUser: AuthUser = {
      id: 'u1', name: 'X', email: 'x@test.com',
      role: 'ADMIN', technicianId: null, avatarUrl: null,
    };
    service.refreshCurrentUser(mockUser);

    service.logout();

    service.user$.subscribe(user => {
      expect(user).toBeNull();
      done();
    });
  });
});
```

- [ ] **Step 3: Correr tests — verificar que fallan**

```bash
cd frontend && npx ng test --include="**/auth.service.spec.ts" --watch=false
```
Expected: FAIL con "service.refreshCurrentUser is not a function"

- [ ] **Step 4: Actualizar AuthService**

En `frontend/src/app/core/services/auth.service.ts`:

```typescript
import { BehaviorSubject, Observable, tap } from 'rxjs';

// Dentro del servicio, agregar propiedades:
private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(
  this.getCurrentUser(),
);
readonly user$: Observable<AuthUser | null> = this.currentUserSubject.asObservable();

refreshCurrentUser(user: AuthUser): void {
  localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  this.currentUserSubject.next(user);
}

// Actualizar login() — en el tap, agregar:
this.currentUserSubject.next(res.user);

// Actualizar logout() — agregar antes de navigate:
this.currentUserSubject.next(null);
```

- [ ] **Step 5: Correr tests — verificar que pasan**

```bash
cd frontend && npx ng test --include="**/auth.service.spec.ts" --watch=false
```
Expected: PASS

- [ ] **Step 6: Escribir tests de UsersService**

En `frontend/src/app/core/services/users.service.spec.ts`:

```typescript
describe('uploadAvatar', () => {
  it('envía POST a /users/me/avatar con FormData', () => {
    const mockResponse: AuthUser = {
      id: 'u1', name: 'Test', email: 't@t.com',
      role: 'ADMIN', technicianId: null, avatarUrl: '/avatars/new.jpg',
    };
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' });

    service.uploadAvatar(file).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/users/me/avatar`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(mockResponse);
  });
});

describe('getMe', () => {
  it('llama a GET /users/me', () => {
    const mockResponse: AuthUser = {
      id: 'u1', name: 'Test', email: 't@t.com',
      role: 'ADMIN', technicianId: null, avatarUrl: null,
    };

    service.getMe().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/users/me`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});
```

- [ ] **Step 7: Implementar getMe y uploadAvatar en UsersService**

En `frontend/src/app/core/services/users.service.ts`:

```typescript
getMe(): Observable<AuthUser> {
  return this.http.get<AuthUser>(`${environment.apiUrl}/users/me`);
}

uploadAvatar(file: File): Observable<AuthUser> {
  const form = new FormData();
  form.append('file', file);
  return this.http.post<AuthUser>(`${environment.apiUrl}/users/me/avatar`, form);
}
```

Import `AuthUser` desde `../models/auth.models`.

- [ ] **Step 8: Correr tests del users.service**

```bash
cd frontend && npx ng test --include="**/users.service.spec.ts" --watch=false
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/core/models/ \
        frontend/src/app/core/services/auth.service.ts \
        frontend/src/app/core/services/auth.service.spec.ts \
        frontend/src/app/core/services/users.service.ts \
        frontend/src/app/core/services/users.service.spec.ts
git commit -m "feat(frontend): actualizar modelos y servicios con soporte de avatarUrl"
```

---

## Task 6: Frontend — UserAvatarComponent

**Files:**
- Create: `frontend/src/app/shared/components/user-avatar/user-avatar.component.ts`
- Create: `frontend/src/app/shared/components/user-avatar/user-avatar.component.html`
- Create: `frontend/src/app/shared/components/user-avatar/user-avatar.component.scss`
- Create: `frontend/src/app/shared/components/user-avatar/user-avatar.component.spec.ts`
- Modify: `frontend/src/app/shared/shared.module.ts`

**Interfaces:**
- Produces: `<app-user-avatar [name]="..." [avatarUrl]="..." size="sm|md|lg">` usado en Tasks 7-10

---

- [ ] **Step 1: Escribir tests del componente**

Crear `frontend/src/app/shared/components/user-avatar/user-avatar.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  let fixture: ComponentFixture<UserAvatarComponent>;
  let component: UserAvatarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      declarations: [UserAvatarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UserAvatarComponent);
    component = fixture.componentInstance;
  });

  it('muestra <img> cuando avatarUrl está definida', () => {
    component.name = 'Leandro';
    component.avatarUrl = '/avatars/photo.jpg';
    fixture.detectChanges();

    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeTruthy();
    expect(img.nativeElement.src).toContain('/avatars/photo.jpg');
  });

  it('muestra inicial cuando avatarUrl es null', () => {
    component.name = 'Valentín';
    component.avatarUrl = null;
    fixture.detectChanges();

    const span = fixture.debugElement.query(By.css('.av__initial'));
    expect(span).toBeTruthy();
    expect(span.nativeElement.textContent.trim()).toBe('V');
  });

  it('muestra inicial cuando la imagen falla al cargar', () => {
    component.name = 'Test';
    component.avatarUrl = '/avatars/broken.jpg';
    fixture.detectChanges();

    component.onImageError();
    fixture.detectChanges();

    const img = fixture.debugElement.query(By.css('img'));
    const span = fixture.debugElement.query(By.css('.av__initial'));
    expect(img).toBeNull();
    expect(span).toBeTruthy();
  });

  it('aplica la clase de tamaño correcta', () => {
    component.name = 'X';
    component.avatarUrl = null;
    component.size = 'md';
    fixture.detectChanges();

    const el = fixture.debugElement.query(By.css('.av'));
    expect(el.nativeElement.classList).toContain('av--md');
  });

  it('genera la misma clase de color para el mismo nombre', () => {
    component.name = 'Leandro';
    fixture.detectChanges();
    const firstColor = component.colorClass;

    component.name = 'Leandro';
    expect(component.colorClass).toBe(firstColor);
  });

  it('retorna ? como inicial cuando name está vacío', () => {
    component.name = '';
    component.avatarUrl = null;
    fixture.detectChanges();

    expect(component.initials).toBe('?');
  });
});
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
cd frontend && npx ng test --include="**/user-avatar.component.spec.ts" --watch=false
```
Expected: FAIL con "Cannot find module"

- [ ] **Step 3: Crear user-avatar.component.ts**

```typescript
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-user-avatar',
  templateUrl: './user-avatar.component.html',
  styleUrls: ['./user-avatar.component.scss'],
})
export class UserAvatarComponent {
  @Input() name  = '';
  @Input() avatarUrl: string | null = null;
  @Input() size: 'sm' | 'md' | 'lg' = 'sm';

  showFallback = false;

  get initials(): string {
    return this.name?.trim().charAt(0).toUpperCase() || '?';
  }

  get colorClass(): string {
    const palette = ['cyan', 'blue', 'purple', 'ok', 'warn'];
    return `av--${palette[(this.name?.charCodeAt(0) ?? 0) % palette.length]}`;
  }

  onImageError(): void {
    this.showFallback = true;
  }
}
```

- [ ] **Step 4: Crear user-avatar.component.html**

```html
<div class="av" [ngClass]="['av--' + size, colorClass]">
  <img
    *ngIf="avatarUrl && !showFallback"
    [src]="avatarUrl"
    [alt]="name"
    (error)="onImageError()"
  />
  <span class="av__initial" *ngIf="!avatarUrl || showFallback">{{ initials }}</span>
</div>
```

- [ ] **Step 5: Crear user-avatar.component.scss**

```scss
.av {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-family: var(--font-ui);
  flex-shrink: 0;
  overflow: hidden;
  border: 1.5px solid var(--border-md);

  img { width: 100%; height: 100%; object-fit: cover; display: block; }

  &--sm { width: 24px; height: 24px; font-size: 9px; }
  &--md { width: 32px; height: 32px; font-size: 12px; }
  &--lg { width: 80px; height: 80px; font-size: 28px; }

  &--cyan   { background: var(--accent-bg);  color: var(--accent);  border-color: var(--accent-bd);  }
  &--blue   { background: var(--srv-bg);     color: var(--srv);     border-color: var(--srv-bd);     }
  &--purple { background: var(--purple-bg);  color: var(--purple);  border-color: var(--purple-bd);  }
  &--ok     { background: var(--ok-bg);      color: var(--ok);      border-color: var(--ok-bd);      }
  &--warn   { background: var(--warn-bg);    color: var(--warn);    border-color: var(--warn-bd);    }
}
```

- [ ] **Step 6: Actualizar SharedModule**

En `frontend/src/app/shared/shared.module.ts`:

```typescript
import { UserAvatarComponent } from './components/user-avatar/user-avatar.component';

// En declarations y exports, agregar UserAvatarComponent
```

- [ ] **Step 7: Correr tests — verificar que pasan**

```bash
cd frontend && npx ng test --include="**/user-avatar.component.spec.ts" --watch=false
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/shared/components/user-avatar/ \
        frontend/src/app/shared/shared.module.ts
git commit -m "feat(shared): agregar UserAvatarComponent con fallback a inicial"
```

---

## Task 7: Frontend — Profile page — upload de avatar

**Files:**
- Modify: `frontend/src/app/features/profile/profile.component.ts`
- Modify: `frontend/src/app/features/profile/profile.component.html`
- Modify: `frontend/src/app/features/profile/profile.component.scss`
- Modify: `frontend/src/app/features/profile/profile.component.spec.ts`
- Modify: `frontend/src/app/features/profile/profile.module.ts`

**Interfaces:**
- Consumes: `UserAvatarComponent` de Task 6, `UsersService.uploadAvatar()` de Task 5, `AuthService.refreshCurrentUser()` de Task 5

---

- [ ] **Step 1: Actualizar profile.module.ts con imports necesarios**

```typescript
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedModule } from '../../shared/shared.module';

// En imports del NgModule:
CommonModule, ReactiveFormsModule, MatButtonModule,
MatProgressSpinnerModule, MatSnackBarModule, SharedModule,
```

- [ ] **Step 2: Escribir tests del ProfileComponent**

En `frontend/src/app/features/profile/profile.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/platform-browser/animations';
import { ProfileComponent } from './profile.component';
import { SharedModule } from '../../shared/shared.module';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { AuthUser } from '../../core/models/auth.models';

const mockUser: AuthUser = {
  id: 'u1', name: 'Leandro', email: 'l@test.com',
  role: 'ADMIN', technicianId: null, avatarUrl: null,
};

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: ProfileComponent;
  let authService: jasmine.SpyObj<AuthService>;
  let usersService: jasmine.SpyObj<UsersService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'refreshCurrentUser'], {
      user$: of(mockUser),
    });
    authService.getCurrentUser.and.returnValue(mockUser);
    usersService = jasmine.createSpyObj('UsersService', ['uploadAvatar']);

    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule, HttpClientTestingModule, RouterTestingModule,
        MatButtonModule, MatProgressSpinnerModule, SharedModule,
      ],
      declarations: [ProfileComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('rechaza archivos con tipo no permitido', () => {
    const file = new File(['data'], 'malware.exe', { type: 'application/x-msdownload' });
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileSelected(event);
    expect(component.uploadState).toBe('error');
    expect(usersService.uploadAvatar).not.toHaveBeenCalled();
  });

  it('rechaza archivos mayores a 2MB', () => {
    const bigContent = new Uint8Array(2 * 1024 * 1024 + 1);
    const file = new File([bigContent], 'big.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileSelected(event);
    expect(component.uploadState).toBe('error');
  });

  it('llama a uploadAvatar y refreshCurrentUser con un archivo válido', () => {
    const updatedUser: AuthUser = { ...mockUser, avatarUrl: '/avatars/new.jpg' };
    usersService.uploadAvatar.and.returnValue(of(updatedUser));

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileSelected(event);

    expect(usersService.uploadAvatar).toHaveBeenCalledWith(file);
    expect(authService.refreshCurrentUser).toHaveBeenCalledWith(updatedUser);
    expect(component.uploadState).toBe('success');
  });

  it('pone estado error si el upload falla', () => {
    usersService.uploadAvatar.and.returnValue(throwError(() => new Error('fail')));
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
    const event = { target: { files: [file] } } as unknown as Event;
    component.onFileSelected(event);
    expect(component.uploadState).toBe('error');
  });
});
```

- [ ] **Step 3: Correr tests — verificar que fallan**

```bash
cd frontend && npx ng test --include="**/profile.component.spec.ts" --watch=false
```
Expected: FAIL

- [ ] **Step 4: Actualizar profile.component.ts**

```typescript
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { UsersService } from '../../core/services/users.service';
import { AuthUser } from '../../core/models/auth.models';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  user: AuthUser | null;
  uploadState: 'idle' | 'uploading' | 'success' | 'error' = 'idle';
  uploadError = '';

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly auth: AuthService,
    private readonly usersService: UsersService,
  ) {
    this.user = auth.getCurrentUser();
    this.auth.user$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(u => { this.user = u; });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.uploadState = 'error';
      this.uploadError = 'Solo se permiten archivos JPG, PNG o WEBP.';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.uploadState = 'error';
      this.uploadError = 'El archivo no puede superar los 2 MB.';
      return;
    }

    this.uploadState = 'uploading';
    this.uploadError = '';
    this.usersService.uploadAvatar(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedUser) => {
          this.uploadState = 'success';
          this.auth.refreshCurrentUser(updatedUser);
        },
        error: () => {
          this.uploadState = 'error';
          this.uploadError = 'No se pudo subir la imagen. Intentá de nuevo.';
        },
      });
  }
}
```

- [ ] **Step 5: Actualizar profile.component.html**

```html
<div class="profile-page" *ngIf="user">
  <div class="page-header">
    <h2>Mi perfil</h2>
    <p class="subtitle">Configuración de tu cuenta</p>
  </div>

  <div class="profile-section">
    <div class="section-header">
      <span class="section-title">Foto de perfil</span>
    </div>
    <div class="section-body avatar-section">
      <div class="avatar-wrap">
        <app-user-avatar [name]="user.name" [avatarUrl]="user.avatarUrl" size="lg"></app-user-avatar>
        <input type="file" hidden #fileInput accept=".jpg,.jpeg,.png,.webp"
               (change)="onFileSelected($event)" />
      </div>
      <div class="avatar-actions">
        <button mat-stroked-button (click)="fileInput.click()" [disabled]="uploadState === 'uploading'">
          <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;margin-right:5px;vertical-align:middle">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          Cambiar foto
        </button>
        <span class="upload-hint">JPG, PNG o WEBP · máx. 2 MB</span>
        <div *ngIf="uploadState === 'uploading'" class="upload-status upload-status--uploading">
          <mat-spinner diameter="14"></mat-spinner> Subiendo…
        </div>
        <div *ngIf="uploadState === 'success'" class="upload-status upload-status--success">
          ✓ Foto actualizada
        </div>
        <div *ngIf="uploadState === 'error'" class="upload-status upload-status--error">
          {{ uploadError }}
        </div>
      </div>
    </div>
  </div>

  <div class="profile-section">
    <div class="section-header">
      <span class="section-title">Cuenta InfraOps</span>
    </div>
    <div class="section-body">
      <div class="kv-row"><span class="kv-label">Nombre</span><span class="kv-value">{{ user.name }}</span></div>
      <div class="kv-row"><span class="kv-label">Email</span><span class="kv-value">{{ user.email }}</span></div>
      <div class="kv-row"><span class="kv-label">Rol</span><span class="kv-value">{{ user.role }}</span></div>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Agregar estilos en profile.component.scss**

```scss
.avatar-section {
  display: flex;
  align-items: center;
  gap: 20px;
}
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.upload-hint {
  font-size: 10px;
  color: var(--tx-lo);
}
.upload-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;

  &--uploading { color: var(--accent); }
  &--success   { color: var(--ok); }
  &--error     { color: var(--crit); }
}
```

- [ ] **Step 7: Correr tests — verificar que pasan**

```bash
cd frontend && npx ng test --include="**/profile.component.spec.ts" --watch=false
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/profile/
git commit -m "feat(profile): agregar UI de upload de avatar con validación client-side"
```

---

## Task 8: Frontend — Shell toolbar reactivo con avatar

**Files:**
- Modify: `frontend/src/app/core/shell/shell.component.ts`
- Modify: `frontend/src/app/core/shell/shell.component.html`
- Modify: `frontend/src/app/core/shell/shell.component.spec.ts`
- Modify: `frontend/src/app/core/shell/shell.module.ts`

**Interfaces:**
- Consumes: `AuthService.user$` de Task 5, `UserAvatarComponent` de Task 6

---

- [ ] **Step 1: Agregar SharedModule a ShellModule**

En `frontend/src/app/core/shell/shell.module.ts`:

```typescript
import { SharedModule } from '../../shared/shared.module';

// En imports del NgModule, agregar SharedModule
```

- [ ] **Step 2: Escribir test de ShellComponent**

En `frontend/src/app/core/shell/shell.component.spec.ts`, agregar:

```typescript
it('renderiza app-user-avatar con los datos del usuario autenticado', () => {
  const mockUser: AuthUser = {
    id: 'u1', name: 'Leandro', email: 'l@test.com',
    role: 'ADMIN', technicianId: null, avatarUrl: '/avatars/photo.jpg',
  };
  // Asegurar que authService.user$ emita mockUser en el test setup
  // Verificar que app-user-avatar está en el DOM con [name]="mockUser.name"
  const avatarEl = fixture.debugElement.query(By.css('app-user-avatar'));
  expect(avatarEl).toBeTruthy();
});
```

(Adaptar al setup existente del spec file)

- [ ] **Step 3: Actualizar shell.component.ts — currentUser reactivo**

En `frontend/src/app/core/shell/shell.component.ts`:

```typescript
// Reemplazar la línea: readonly currentUser: AuthUser | null;
currentUser: AuthUser | null = null;

// En el constructor, reemplazar:
// this.currentUser = this.auth.getCurrentUser();
// por:
this.auth.user$
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(user => { this.currentUser = user; });
```

- [ ] **Step 4: Actualizar shell.component.html — reemplazar SVG de usuario por app-user-avatar**

Localizar el bloque del botón de usuario en la toolbar y reemplazar el SVG genérico de persona:

```html
<!-- Reemplazar: -->
<svg viewBox="0 0 24 24"
     style="width:20px;height:20px;stroke:var(--tx-lo);fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0">
  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
</svg>

<!-- Con: -->
<app-user-avatar
  [name]="currentUser?.name ?? ''"
  [avatarUrl]="currentUser?.avatarUrl ?? null"
  size="md">
</app-user-avatar>
```

También actualizar el header del user-menu para mostrar `currentUser?.name`:

```html
<span class="user-menu__email">{{ currentUser?.name }}</span>
<span class="user-menu__role">{{ currentUser?.email }} · {{ currentUser?.role }}</span>
```

- [ ] **Step 5: Correr tests del shell**

```bash
cd frontend && npx ng test --include="**/shell.component.spec.ts" --watch=false
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/core/shell/
git commit -m "feat(shell): mostrar avatar del usuario en toolbar, reactivo via BehaviorSubject"
```

---

## Task 9: Frontend — Admin → Usuarios con columna avatar

**Files:**
- Modify: `frontend/src/app/features/admin/users/users.component.ts`
- Modify: `frontend/src/app/features/admin/users/users.component.html`
- Modify: `frontend/src/app/features/admin/users/users.component.spec.ts`

**Interfaces:**
- Consumes: `UserAvatarComponent` de Task 6, `User.avatarUrl` de Task 5

**Nota:** Verificar si `AdminModule` ya importa `SharedModule`. Si no, agregar.

---

- [ ] **Step 1: Agregar 'avatar' a displayedColumns**

En `frontend/src/app/features/admin/users/users.component.ts`:

```typescript
readonly displayedColumns = ['avatar', 'user', 'role', 'status', 'actions'];
```

- [ ] **Step 2: Agregar columna avatar al template**

En `frontend/src/app/features/admin/users/users.component.html`, antes de `matColumnDef="user"`:

```html
<ng-container matColumnDef="avatar">
  <th mat-header-cell *matHeaderCellDef style="width:40px"></th>
  <td mat-cell *matCellDef="let user" style="width:40px;padding:0 8px">
    <app-user-avatar [name]="user.name" [avatarUrl]="user.avatarUrl" size="sm"></app-user-avatar>
  </td>
</ng-container>
```

- [ ] **Step 3: Verificar y agregar SharedModule al AdminModule**

Buscar el archivo del módulo admin (probablemente `admin.module.ts` o similar). Si `SharedModule` no está en imports, agregarlo.

- [ ] **Step 4: Correr tests**

```bash
cd frontend && npx ng test --include="**/admin/users/users.component.spec.ts" --watch=false
```
Expected: PASS (agregar `SharedModule` al TestBed si falla por `app-user-avatar` desconocido)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/admin/users/
git commit -m "feat(admin/users): agregar columna de avatar en tabla de usuarios"
```

---

## Task 10: Frontend — Tasks cycle-table + technician selects

**Files:**
- Modify: `frontend/src/app/features/tasks/cycle-table/cycle-table.component.html`
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.html`
- Modify: `frontend/src/app/features/tasks/tasks-unified.component.ts`
- Modify: `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.html`
- Modify: `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.ts`
- Modify: `frontend/src/app/features/schedules/config-tab/config-tab.component.html`
- Modify: `frontend/src/app/features/schedules/config-tab/config-tab.component.ts`

**Interfaces:**
- Consumes: `UserAvatarComponent` de Task 6, modelos con `avatarUrl` de Task 5

---

- [ ] **Step 1: Reemplazar .avatar span en cycle-table**

En `frontend/src/app/features/tasks/cycle-table/cycle-table.component.html`, localizar:

```html
<span class="avatar">{{ task.technician?.user?.name?.slice(0,1) ?? '?' }}</span>
{{ task.technician?.user?.name ?? '—' }}
```

Reemplazar por:

```html
<app-user-avatar
  [name]="task.technician?.user?.name ?? ''"
  [avatarUrl]="task.technician?.user?.avatarUrl ?? null"
  size="sm">
</app-user-avatar>
{{ task.technician?.user?.name ?? '—' }}
```

Eliminar el estilo CSS `.avatar` del `cycle-table.component.scss` si existe.

- [ ] **Step 2: Actualizar tasks-unified.component.ts — getter para el select de técnico**

En `frontend/src/app/features/tasks/tasks-unified.component.ts`:

```typescript
import { Technician } from '../../core/models/technician.models';

// Agregar getter:
get selectedTechnicianObj(): Technician | null {
  if (!this.techFilter) return null;
  return this.technicians.find(t => t.id === this.techFilter) ?? null;
}
```

- [ ] **Step 3: Actualizar select de técnico en tasks-unified.component.html**

Localizar el select de técnico (líneas ~50-55) y reemplazar:

```html
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-field">
  <mat-label>Técnico</mat-label>
  <mat-select [(value)]="techFilter" (selectionChange)="onFilterChange()">
    <mat-select-trigger>
      <ng-container *ngIf="selectedTechnicianObj as t">
        <app-user-avatar [name]="t.user.name" [avatarUrl]="t.user.avatarUrl" size="sm"></app-user-avatar>
        {{ t.user.name }}
      </ng-container>
      <span *ngIf="!selectedTechnicianObj" style="color:var(--tx-lo)">Todos</span>
    </mat-select-trigger>
    <mat-option [value]="null">Todos</mat-option>
    <mat-option *ngFor="let t of technicians" [value]="t.id">
      <div style="display:flex;align-items:center;gap:8px">
        <app-user-avatar [name]="t.user.name" [avatarUrl]="t.user.avatarUrl" size="sm"></app-user-avatar>
        {{ t.user.name }}
      </div>
    </mat-option>
  </mat-select>
</mat-form-field>
```

- [ ] **Step 4: Actualizar task-create-dialog — getter y select**

En `frontend/src/app/features/admin/tasks/task-create-dialog/task-create-dialog.component.ts`:

```typescript
import { Technician } from '../../../../core/models/technician.models';

// Agregar getter (asumiendo que el form tiene control 'technicianId'):
get selectedTechForDialog(): Technician | null {
  const id = this.form.get('technicianId')?.value;
  if (!id) return null;
  return this.technicians.find(t => t.id === id) ?? null;
}
```

En `task-create-dialog.component.html`, reemplazar el mat-select de técnico:

```html
<mat-form-field appearance="outline" subscriptSizing="dynamic">
  <mat-label>Técnico</mat-label>
  <mat-select formControlName="technicianId">
    <mat-select-trigger>
      <ng-container *ngIf="selectedTechForDialog as t">
        <app-user-avatar [name]="t.user.name" [avatarUrl]="t.user.avatarUrl" size="sm"></app-user-avatar>
        {{ t.user.name }}
      </ng-container>
      <span *ngIf="!selectedTechForDialog" style="color:var(--tx-lo)">Seleccioná un técnico...</span>
    </mat-select-trigger>
    <mat-option value="">Seleccioná un técnico...</mat-option>
    <mat-option *ngFor="let t of technicians" [value]="t.id">
      <div style="display:flex;align-items:center;gap:8px">
        <app-user-avatar [name]="t.user.name" [avatarUrl]="t.user.avatarUrl" size="sm"></app-user-avatar>
        {{ t.user.name }}
      </div>
    </mat-option>
  </mat-select>
</mat-form-field>
```

- [ ] **Step 5: Actualizar config-tab.component.ts — tipo y mapeo con avatarUrl**

En `frontend/src/app/features/schedules/config-tab/config-tab.component.ts`:

```typescript
// Cambiar tipo de technicians:
technicians: Array<{ id: string; name: string; avatarUrl: string | null }> = [];

// Actualizar el mapeo en load():
this.technicians = technicians.map(t => ({
  id: t.id,
  name: t.user?.name ?? t.id,
  avatarUrl: t.user?.avatarUrl ?? null,
}));

// Agregar getter para el filtro:
get filterSelectedTech(): { id: string; name: string; avatarUrl: string | null } | null {
  if (this.filterTechnicianId === 'ALL') return null;
  return this.technicians.find(t => t.id === this.filterTechnicianId) ?? null;
}

// Agregar helper para las filas de la tabla:
getTechForRule(rule: ClientSchedule): { id: string; name: string; avatarUrl: string | null } | null {
  if (!rule.technicianId) return null;
  return this.technicians.find(t => t.id === rule.technicianId) ?? null;
}
```

- [ ] **Step 6: Actualizar config-tab.component.html — filtro con avatar**

Reemplazar el mat-select del filtro de técnico (líneas ~23-29):

```html
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="tech-filter">
  <mat-label>Técnico</mat-label>
  <mat-select [(value)]="filterTechnicianId">
    <mat-select-trigger>
      <ng-container *ngIf="filterSelectedTech as t">
        <app-user-avatar [name]="t.name" [avatarUrl]="t.avatarUrl" size="sm"></app-user-avatar>
        {{ t.name }}
      </ng-container>
      <span *ngIf="!filterSelectedTech" style="color:var(--tx-lo)">Todos</span>
    </mat-select-trigger>
    <mat-option value="ALL">Todos</mat-option>
    <mat-option *ngFor="let tech of technicians" [value]="tech.id">
      <div style="display:flex;align-items:center;gap:8px">
        <app-user-avatar [name]="tech.name" [avatarUrl]="tech.avatarUrl" size="sm"></app-user-avatar>
        {{ tech.name }}
      </div>
    </mat-option>
  </mat-select>
</mat-form-field>
```

- [ ] **Step 7: Actualizar config-tab.component.html — selects por fila de tabla**

Localizar el select de asignación de técnico por fila (columna "technician") y actualizarlo con el mismo patrón:

```html
<mat-select [value]="rule.technicianId" (selectionChange)="onTechnicianChange(rule, $event.value)">
  <mat-select-trigger>
    <ng-container *ngIf="getTechForRule(rule) as t">
      <app-user-avatar [name]="t.name" [avatarUrl]="t.avatarUrl" size="sm"></app-user-avatar>
      {{ t.name }}
    </ng-container>
    <span *ngIf="!getTechForRule(rule)" style="color:var(--tx-lo)">Sin técnico</span>
  </mat-select-trigger>
  <mat-option [value]="null">Sin técnico</mat-option>
  <mat-option *ngFor="let tech of technicians" [value]="tech.id">
    <div style="display:flex;align-items:center;gap:8px">
      <app-user-avatar [name]="tech.name" [avatarUrl]="tech.avatarUrl" size="sm"></app-user-avatar>
      {{ tech.name }}
    </div>
  </mat-option>
</mat-select>
```

- [ ] **Step 8: Verificar imports SharedModule en SchedulesModule**

En `frontend/src/app/features/schedules/schedules.module.ts`, verificar que `SharedModule` esté en imports. Si no, agregarlo.

- [ ] **Step 9: Correr todos los tests del frontend**

```bash
cd frontend && npx ng test --watch=false
```
Expected: PASS (sin errores de compilación)

- [ ] **Step 10: Commit final**

```bash
git add frontend/src/app/features/tasks/ \
        frontend/src/app/features/admin/tasks/ \
        frontend/src/app/features/schedules/
git commit -m "feat(frontend): agregar avatar en cycle-table y selects de técnico"
```

---

## Verificación final

- [ ] Ejecutar migración en la base de datos si no se hizo en Task 1
- [ ] Verificar en docker-compose.yml que el volumen de avatares está configurado:
  ```yaml
  volumes:
    - avatars_data:/app/uploads/avatars
  ```
- [ ] Probar flujo completo: login → Mi Perfil → subir foto → verificar que aparece en toolbar sin recargar
- [ ] Probar fallback: en Mi Perfil, subir un archivo con extensión `.jpg` pero contenido inválido → debe rechazarse con mensaje de error
- [ ] Verificar que los selects de técnico muestran avatar en la opción seleccionada (trigger)
