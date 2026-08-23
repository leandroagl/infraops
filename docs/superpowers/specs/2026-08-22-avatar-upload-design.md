# Avatar Upload — Diseño del sistema

**Fecha:** 2026-08-22  
**Mockup:** `docs/mockups/avatar-upload-v1.html`

---

## Objetivo

Permitir a cada usuario subir una foto de perfil (avatar). Si no tiene foto, se muestra su inicial con color determinístico. El avatar aparece en: toolbar del shell, página Mi Perfil, tabla Admin → Usuarios, tabla de tareas (columna técnico), y todos los `mat-select` de asignación de técnico.

---

## Arquitectura

### Backend

- Nueva columna `avatar_path` en tabla `users` (solo el filename UUID, nunca la URL completa)
- `GET /users/me` — cualquier rol autenticado, retorna datos del usuario incluyendo `avatarUrl`
- `POST /users/me/avatar` — cualquier rol autenticado, sube imagen con validación 5 capas
- `ServeStaticModule` sirve `./uploads/avatars/` en la ruta HTTP `/avatars/`
- `avatarUrl` se construye en capa de servicio: `/avatars/{filename}` o `null`

### Frontend

- `UserAvatarComponent` en `shared/components/user-avatar/` — inputs `name`, `avatarUrl`, `size`. Fallback automático a inicial si no hay URL o falla la carga de imagen (`(error)` de `<img>`)
- `AuthService` agrega `BehaviorSubject<AuthUser | null>` y `refreshCurrentUser(user)` para que la toolbar reaccione sin recarga de página
- `AuthUser` y `User` interfaces agregan `name` y `avatarUrl`

---

## Seguridad — 5 capas en backend

| Capa | Qué valida | Por qué |
|---|---|---|
| 1 - Extension (Multer fileFilter) | MIME whitelist: `image/jpeg`, `image/png`, `image/webp` | Primera barrera, rechaza antes de leer el buffer |
| 2 - MIME type (Multer fileFilter) | Mismo whitelist vía `file.mimetype` | Segunda barrera client-reported |
| 3 - Magic bytes (`file-type@16`) | Firma binaria real del archivo | La única no falsificable — un `.php` renombrado a `.png` tiene firma distinta |
| 4 - UUID filename | `crypto.randomUUID()` + extensión del tipo detectado | Sin path traversal, sin metadata del cliente en disco |
| 5 - Tamaño máximo 2MB | `limits: { fileSize: 2 * 1024 * 1024 }` en Multer | Previene DoS por llenado de volumen |

El endpoint requiere `JwtAuthGuard`. Upload anónimo es imposible.

---

## Cambios en Backend

### 1. User entity

```typescript
// backend/src/users/user.entity.ts
@Column({ name: 'avatar_path', type: 'varchar', nullable: true, default: null })
avatarPath: string | null;
```

### 2. Migración

Archivo: `backend/src/migrations/1787500000000-AddAvatarPathToUser.ts`

```typescript
async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(
    `ALTER TABLE "users" ADD "avatar_path" character varying DEFAULT NULL`
  );
}
async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_path"`);
}
```

### 3. UserResponse — tipo explícito

`UserResponse` pasa de `Omit<User, ...>` a un tipo explícito para controlar exactamente qué se expone (sin `avatarPath`, con `avatarUrl`):

```typescript
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
```

`toResponse()` construye `avatarUrl`:
```typescript
private toResponse(user: User): UserResponse {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role,
    mustChangePassword: user.mustChangePassword, isActive: user.isActive,
    technicianId: user.technicianId, odooUserId: user.odooUserId,
    odooSyncedAt: user.odooSyncedAt, odooEmployeeId: user.odooEmployeeId,
    avatarUrl: user.avatarPath ? `/avatars/${user.avatarPath}` : null,
    createdAt: user.createdAt,
  };
}
```

### 4. LoginResponseDto

```typescript
// backend/src/auth/dto/login-response.dto.ts
user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  technicianId: string | null;
  avatarUrl: string | null;
};
```

`auth.service.ts` — `login()` incluye `name` y `avatarUrl` en el objeto `user` del response.

### 5. Endpoints nuevos en UsersController

Ambos requieren `@Roles(UserRole.ADMIN, UserRole.TL, UserRole.COORDINATOR, UserRole.TECHNICIAN)` a nivel de método, que por diseño del `RolesGuard` (usa `getAllAndOverride`) sobreescribe el `@Roles(UserRole.ADMIN)` de clase.

**GET /users/me**
```
Response: UserResponse del usuario autenticado (sub del JWT)
```

**POST /users/me/avatar**
```
Body: multipart/form-data — campo "file"
Multer: memoryStorage, fileFilter MIME whitelist, limits.fileSize = 2MB
Service: magic bytes → uuid filename → elimina avatar anterior → escribe en disco → update DB
Response: UserResponse actualizado
```

### 6. Flujo de uploadAvatar en servicio

```typescript
async uploadAvatar(userId: string, file: Express.Multer.File): Promise<UserResponse> {
  // 1. Validar magic bytes
  const { fromBuffer } = await import('file-type');
  const detected = await fromBuffer(file.buffer);
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!detected || !allowedMimes.includes(detected.mime)) {
    throw new BadRequestException('Tipo de archivo no permitido');
  }
  // 2. Filename seguro
  const filename = `${randomUUID()}.${detected.ext}`;
  // 3. Eliminar avatar anterior
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) throw new NotFoundException('Usuario no encontrado');
  if (user.avatarPath) {
    await fs.rm(join(process.cwd(), 'uploads', 'avatars', user.avatarPath), { force: true });
  }
  // 4. Escribir nuevo archivo
  const dir = join(process.cwd(), 'uploads', 'avatars');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, filename), file.buffer);
  // 5. Actualizar DB
  await this.userRepository.update(userId, { avatarPath: filename });
  return this.toResponse({ ...user, avatarPath: filename });
}
```

### 7. Static serving

```typescript
// app.module.ts — agrega ServeStaticModule
ServeStaticModule.forRoot({
  rootPath: join(process.cwd(), 'uploads', 'avatars'),
  serveRoot: '/avatars',
  serveStaticOptions: { index: false },
})
```

### 8. TechnicianUserResponse

`technicians.service.ts` — `toResponse()` excluye `avatarPath` e incluye `avatarUrl`:

```typescript
private toResponse(user: User): TechnicianUserResponse {
  const { passwordHash, lastLogoutAt, technician, technicianId, avatarPath, ...userFields } = user;
  return {
    id: technicianId!,
    createdAt: technician!.createdAt,
    user: { ...userFields, avatarUrl: avatarPath ? `/avatars/${avatarPath}` : null },
  };
}
```

El tipo `TechnicianUserResponse.user` pasa a ser explícito con `avatarUrl: string | null`.

---

## Cambios en Frontend

### 1. Modelos

**`AuthUser` (auth.models.ts):**
```typescript
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  technicianId?: string | null;
  avatarUrl: string | null;
}
```

**`User` (user.models.ts):** agrega `avatarUrl: string | null`

**`Task.technician.user` (task.models.ts):** agrega `avatarUrl: string | null`

### 2. AuthService

```typescript
// Agrega al servicio existente:
private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(
  this.getCurrentUser()
);
readonly user$ = this.currentUserSubject.asObservable();

refreshCurrentUser(user: AuthUser): void {
  localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  this.currentUserSubject.next(user);
}
```

`login()`: en el `tap`, agrega `this.currentUserSubject.next(res.user)`  
`logout()`: agrega `this.currentUserSubject.next(null)`

### 3. UsersService

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

### 4. UserAvatarComponent

**Ubicación:** `frontend/src/app/shared/components/user-avatar/`

```typescript
@Input() name  = '';
@Input() avatarUrl: string | null = null;
@Input() size: 'sm' | 'md' | 'lg' = 'sm';

showFallback = false;

get initials(): string { return this.name?.trim().charAt(0).toUpperCase() || '?'; }

get colorClass(): string {
  const palette = ['cyan', 'blue', 'purple', 'ok', 'warn'];
  return `av--${palette[(this.name?.charCodeAt(0) ?? 0) % palette.length]}`;
}

onImageError(): void { this.showFallback = true; }
```

Template: muestra `<img>` si hay `avatarUrl` y no hay error, sino muestra `<span>` con `initials`.  
SCSS: clases `.av--sm/md/lg` y `.av--cyan/blue/purple/ok/warn` con los tokens del design system.

Exportado desde `SharedModule`.

### 5. Profile page

- `<input type="file" hidden #fileInput accept=".jpg,.jpeg,.png,.webp">` disparado por `<button mat-stroked-button>`
- Validación client-side antes del HTTP: tipo MIME + tamaño ≤ 2MB → mensaje de error sin llamada
- Estados: `idle | uploading | success | error`
- Al éxito: `this.auth.refreshCurrentUser(updatedUser)` — actualiza toolbar sin recarga

### 6. Shell toolbar

- `currentUser` pasa a ser reactivo: `this.auth.user$.pipe(takeUntilDestroyed(...))`
- Reemplaza SVG de usuario por `<app-user-avatar [name]="currentUser?.name" [avatarUrl]="currentUser?.avatarUrl" size="md">`
- `ShellModule` importa `SharedModule`

### 7. Admin → Usuarios

- `displayedColumns = ['avatar', 'user', 'role', 'status', 'actions']`
- Nueva columna `matColumnDef="avatar"` con `<app-user-avatar [name]="user.name" [avatarUrl]="user.avatarUrl" size="sm">`

### 8. Cycle-table (Tasks)

Reemplaza:
```html
<span class="avatar">{{ task.technician?.user?.name?.slice(0,1) ?? '?' }}</span>
```
Por:
```html
<app-user-avatar
  [name]="task.technician?.user?.name ?? ''"
  [avatarUrl]="task.technician?.user?.avatarUrl ?? null"
  size="sm">
</app-user-avatar>
```

### 9. Technician selects — patrón

Aplica a: `tasks-unified.component`, `admin/tasks/task-create-dialog.component`, `schedules/config-tab.component` (filtro + selects por fila).

**Template:**
```html
<mat-select [value]="selectedTechId" (selectionChange)="...">
  <mat-select-trigger>
    <ng-container *ngIf="selectedTechObj as t">
      <app-user-avatar [name]="t.name" [avatarUrl]="t.avatarUrl" size="sm"></app-user-avatar>
      {{ t.name }}
    </ng-container>
    <span *ngIf="!selectedTechObj" style="color:var(--tx-lo)">Todos / Sin asignar</span>
  </mat-select-trigger>
  <mat-option [value]="null">Todos / Sin asignar</mat-option>
  <mat-option *ngFor="let t of technicians" [value]="t.id">
    <app-user-avatar [name]="t.name || t.user?.name" [avatarUrl]="t.avatarUrl || t.user?.avatarUrl" size="sm"></app-user-avatar>
    {{ t.name || t.user?.name }}
  </mat-option>
</mat-select>
```

Cada componente agrega un getter `selectedTechObj` que busca en su array local.

---

## Módulos Angular a actualizar

| Módulo | Cambio |
|---|---|
| `ShellModule` | Importa `SharedModule` |
| `ProfileModule` | Importa `SharedModule`, `MatButtonModule`, `MatProgressSpinnerModule`, `ReactiveFormsModule` |
| `AdminModule` | Verificar si ya importa `SharedModule`, agregar si no |
| `SchedulesModule` | Verificar si ya importa `SharedModule`, agregar si no |

`TasksModule` ya importa `SharedModule` — sin cambio.

---

## Packages a instalar

```bash
# Backend
npm install file-type@16 @nestjs/serve-static
npm install --save-dev @types/multer  # si no está
```

---

## Consideraciones de despliegue

El directorio `./uploads/avatars/` dentro del contenedor backend debe mapearse a un Docker volume persistente en `docker-compose.yml`:

```yaml
volumes:
  - avatars_data:/app/uploads/avatars
```

Sin este volume, los avatares se pierden al recrear el contenedor.
