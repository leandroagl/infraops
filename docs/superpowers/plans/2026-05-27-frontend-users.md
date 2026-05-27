# Frontend — Gestión de Usuarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la vista de gestión de usuarios para el rol ADMIN — tabla (Usuario, Rol, Estado, Acciones), diálogos de crear/editar, y display de contraseña temporal. El usuario seed (`admininfraops@ondra.com.ar`) no puede editarse ni desactivarse; solo permite reset de contraseña.

**Architecture:** `AdminModule` lazy-loaded bajo `/admin`, protegido por un nuevo `AdminGuard`. `UsersComponent` usa una tabla HTML custom con `MatMenu` para las acciones y `MatDialog` para los formularios. `UsersService` encapsula todos los endpoints `/users`. Los estilos globales de Angular Material en `styles.scss` ya cubren el tema de dialogs y menús — no se necesitan panelClass overrides adicionales.

**Tech Stack:** Angular 19, Angular Material (MatMenu, MatDialog, MatSnackBar), ReactiveFormsModule, HttpClient, CSS custom properties del design system de InfraOps (tokens.scss + components.scss).

---

## File Map

**Modificar:**
- `frontend/src/app/core/models/auth.models.ts` — corregir `id: number → string`, `technicianId?: number → string | null`
- `frontend/src/app/app-routing.module.ts` — agregar ruta `/admin` lazy con `AdminGuard`
- `frontend/src/styles/components.scss` — agregar estilos de dialog, field y password-box

**Crear:**
- `frontend/src/app/core/models/user.models.ts`
- `frontend/src/app/core/services/users.service.ts`
- `frontend/src/app/core/services/users.service.spec.ts`
- `frontend/src/app/core/guards/admin.guard.ts`
- `frontend/src/app/core/guards/admin.guard.spec.ts`
- `frontend/src/app/features/admin/admin-routing.module.ts`
- `frontend/src/app/features/admin/admin.module.ts`
- `frontend/src/app/features/admin/users/users.component.ts`
- `frontend/src/app/features/admin/users/users.component.html`
- `frontend/src/app/features/admin/users/users.component.scss`
- `frontend/src/app/features/admin/users/users.component.spec.ts`
- `frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.ts`
- `frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.html`
- `frontend/src/app/features/admin/users/password-display-dialog/password-display-dialog.component.ts`
- `frontend/src/app/features/admin/users/password-display-dialog/password-display-dialog.component.html`

---

## Task 1: Fix type mismatch en auth.models.ts

El campo `id` en `AuthUser` y `sub` en `JwtPayload` están tipados como `number` pero el backend usa UUID (strings). Esto provoca que comparaciones de igualdad entre `User.id` (string de `/users`) y el id del usuario logueado siempre fallen silenciosamente.

**Files:**
- Modify: `frontend/src/app/core/models/auth.models.ts`

- [ ] **Step 1: Aplicar corrección de tipos**

Reemplazar el contenido completo de `frontend/src/app/core/models/auth.models.ts`:

```typescript
export type UserRole = 'ADMIN' | 'TL' | 'TECHNICIAN' | 'COORDINATOR';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  technicianId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  mustChangePassword: boolean;
  user: AuthUser;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  technicianId?: string | null;
  iat: number;
  exp: number;
}
```

- [ ] **Step 2: Correr tests existentes para confirmar sin regresiones**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan. Los mocks en `login.component.spec.ts` usan `id: 1` via `as any` — siguen pasando con advertencia TypeScript, pero no rompen.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/core/models/auth.models.ts
git commit -m "fix(frontend): corregir tipos id/technicianId en auth.models — uuid son strings"
```

---

## Task 2: Crear user.models.ts

Define las interfaces TypeScript que espejean el `UserResponse` del backend.

**Files:**
- Create: `frontend/src/app/core/models/user.models.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { UserRole } from './auth.models';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  isActive: boolean;
  technicianId: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
}

export interface CreateUserResponse extends User {
  plainPassword: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/core/models/user.models.ts
git commit -m "feat(frontend): agregar user.models.ts con User, payloads y CreateUserResponse"
```

---

## Task 3: UsersService con TDD

**Files:**
- Create: `frontend/src/app/core/services/users.service.spec.ts`
- Create: `frontend/src/app/core/services/users.service.ts`

- [ ] **Step 1: Escribir el spec (rojo)**

Crear `frontend/src/app/core/services/users.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { UsersService } from './users.service';
import { User, CreateUserPayload, CreateUserResponse } from '../models/user.models';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/users`;

const mockUser: User = {
  id: 'uuid-1',
  name: 'Test User',
  email: 'test@ondra.com.ar',
  role: 'TECHNICIAN',
  mustChangePassword: false,
  isActive: true,
  technicianId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('UsersService', () => {
  let service: UsersService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(UsersService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getAll()', () => {
    it('makes GET /users and returns the list', () => {
      service.getAll().subscribe(users => expect(users).toEqual([mockUser]));
      const req = http.expectOne(BASE);
      expect(req.request.method).toBe('GET');
      req.flush([mockUser]);
    });
  });

  describe('create()', () => {
    it('makes POST /users and returns user with plainPassword', () => {
      const payload: CreateUserPayload = {
        name: 'Test User', email: 'test@ondra.com.ar', role: 'TECHNICIAN',
      };
      const response: CreateUserResponse = { ...mockUser, plainPassword: 'Abc123!@#' };

      service.create(payload).subscribe(res => expect(res).toEqual(response));

      const req = http.expectOne(BASE);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(response);
    });
  });

  describe('update()', () => {
    it('makes PATCH /users/:id', () => {
      service.update('uuid-1', { name: 'Updated' }).subscribe(user => {
        expect(user).toEqual({ ...mockUser, name: 'Updated' });
      });
      const req = http.expectOne(`${BASE}/uuid-1`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ name: 'Updated' });
      req.flush({ ...mockUser, name: 'Updated' });
    });
  });

  describe('updateStatus()', () => {
    it('makes PATCH /users/:id/status con { isActive }', () => {
      service.updateStatus('uuid-1', false).subscribe(user => {
        expect(user.isActive).toBeFalse();
      });
      const req = http.expectOne(`${BASE}/uuid-1/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ isActive: false });
      req.flush({ ...mockUser, isActive: false });
    });
  });

  describe('resetPassword()', () => {
    it('makes POST /users/:id/reset-password', () => {
      service.resetPassword('uuid-1').subscribe(res => {
        expect(res.plainPassword).toBe('NewPass123!');
      });
      const req = http.expectOne(`${BASE}/uuid-1/reset-password`);
      expect(req.request.method).toBe('POST');
      req.flush({ plainPassword: 'NewPass123!' });
    });
  });
});
```

- [ ] **Step 2: Correr spec para confirmar que falla**

```bash
cd frontend && npx ng test --include="**/users.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: 5 tests fallan — `UsersService` no está definido.

- [ ] **Step 3: Implementar el servicio**

Crear `frontend/src/app/core/services/users.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  CreateUserPayload,
  UpdateUserPayload,
  CreateUserResponse,
} from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly url = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.url);
  }

  create(payload: CreateUserPayload): Observable<CreateUserResponse> {
    return this.http.post<CreateUserResponse>(this.url, payload);
  }

  update(id: string, payload: UpdateUserPayload): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}`, payload);
  }

  updateStatus(id: string, isActive: boolean): Observable<User> {
    return this.http.patch<User>(`${this.url}/${id}/status`, { isActive });
  }

  resetPassword(id: string): Observable<{ plainPassword: string }> {
    return this.http.post<{ plainPassword: string }>(
      `${this.url}/${id}/reset-password`,
      {},
    );
  }
}
```

- [ ] **Step 4: Correr spec para confirmar que pasa**

```bash
cd frontend && npx ng test --include="**/users.service.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: 5 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/services/users.service.ts \
        frontend/src/app/core/services/users.service.spec.ts
git commit -m "feat(frontend): agregar UsersService con TDD — getAll, create, update, updateStatus, resetPassword"
```

---

## Task 4: AdminGuard con TDD

**Files:**
- Create: `frontend/src/app/core/guards/admin.guard.spec.ts`
- Create: `frontend/src/app/core/guards/admin.guard.ts`

- [ ] **Step 1: Escribir el spec (rojo)**

Crear `frontend/src/app/core/guards/admin.guard.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Router } from '@angular/router';
import { AdminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let authSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [
        AdminGuard,
        { provide: AuthService, useValue: authSpy },
      ],
    });
    guard = TestBed.inject(AdminGuard);
    router = TestBed.inject(Router);
  });

  it('devuelve true cuando el usuario tiene rol ADMIN', () => {
    authSpy.getCurrentUser.and.returnValue({
      id: 'uuid-1', email: 'admin@ondra.com.ar', role: 'ADMIN',
    });
    expect(guard.canActivate()).toBeTrue();
  });

  it('devuelve false y redirige a /dashboard para rol TECHNICIAN', () => {
    authSpy.getCurrentUser.and.returnValue({
      id: 'uuid-2', email: 'tech@ondra.com.ar', role: 'TECHNICIAN',
    });
    const navSpy = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(navSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('devuelve false y redirige cuando no hay sesión', () => {
    authSpy.getCurrentUser.and.returnValue(null);
    const navSpy = spyOn(router, 'navigate');
    expect(guard.canActivate()).toBeFalse();
    expect(navSpy).toHaveBeenCalledWith(['/dashboard']);
  });
});
```

- [ ] **Step 2: Correr spec para confirmar que falla**

```bash
cd frontend && npx ng test --include="**/admin.guard.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: 3 tests fallan — `AdminGuard` no está definido.

- [ ] **Step 3: Implementar el guard**

Crear `frontend/src/app/core/guards/admin.guard.ts`:

```typescript
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean {
    const user = this.auth.getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      this.router.navigate(['/dashboard']);
      return false;
    }
    return true;
  }
}
```

- [ ] **Step 4: Correr spec para confirmar que pasa**

```bash
cd frontend && npx ng test --include="**/admin.guard.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: 3 tests pasan.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/guards/admin.guard.ts \
        frontend/src/app/core/guards/admin.guard.spec.ts
git commit -m "feat(frontend): agregar AdminGuard con TDD — protege rutas /admin para ADMIN"
```

---

## Task 5: Scaffold AdminModule

Crea el módulo y las rutas. Los componentes se crean como stubs mínimos para que el módulo compile. Se implementan completamente en los tasks siguientes.

**Files:**
- Create: `frontend/src/app/features/admin/users/password-display-dialog/password-display-dialog.component.ts`
- Create: `frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.ts`
- Create: `frontend/src/app/features/admin/users/users.component.ts`
- Create: `frontend/src/app/features/admin/users/users.component.html`
- Create: `frontend/src/app/features/admin/users/users.component.scss`
- Create: `frontend/src/app/features/admin/admin-routing.module.ts`
- Create: `frontend/src/app/features/admin/admin.module.ts`
- Modify: `frontend/src/app/app-routing.module.ts`

- [ ] **Step 1: Crear stub PasswordDisplayDialogComponent**

Crear `frontend/src/app/features/admin/users/password-display-dialog/password-display-dialog.component.ts`:

```typescript
import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-password-display-dialog',
  template: '',
})
export class PasswordDisplayDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<PasswordDisplayDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string; plainPassword: string },
  ) {}
}
```

- [ ] **Step 2: Crear stub UserFormDialogComponent**

Crear `frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.ts`:

```typescript
import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { User } from '../../../../core/models/user.models';

export interface UserFormDialogData {
  mode: 'create' | 'edit';
  user?: User;
}

@Component({
  selector: 'app-user-form-dialog',
  template: '',
})
export class UserFormDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<UserFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserFormDialogData,
  ) {}
}
```

- [ ] **Step 3: Crear stub UsersComponent**

Crear `frontend/src/app/features/admin/users/users.component.ts`:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {}
```

Crear `frontend/src/app/features/admin/users/users.component.html`:

```html
<p style="color:var(--tx-md);padding:24px">Usuarios — cargando…</p>
```

Crear `frontend/src/app/features/admin/users/users.component.scss` (vacío — se completa en Task 6).

- [ ] **Step 4: Crear AdminRoutingModule**

Crear `frontend/src/app/features/admin/admin-routing.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsersComponent } from './users/users.component';

const routes: Routes = [
  { path: 'users', component: UsersComponent },
  { path: '', redirectTo: 'users', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminRoutingModule {}
```

- [ ] **Step 5: Crear AdminModule**

Crear `frontend/src/app/features/admin/admin.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { AdminRoutingModule } from './admin-routing.module';
import { UsersComponent } from './users/users.component';
import { UserFormDialogComponent } from './users/user-form-dialog/user-form-dialog.component';
import { PasswordDisplayDialogComponent } from './users/password-display-dialog/password-display-dialog.component';

@NgModule({
  declarations: [UsersComponent, UserFormDialogComponent, PasswordDisplayDialogComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule,
    AdminRoutingModule,
  ],
})
export class AdminModule {}
```

- [ ] **Step 6: Agregar ruta /admin en app-routing.module.ts**

Reemplazar el contenido completo de `frontend/src/app/app-routing.module.ts`:

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { ShellComponent } from './core/shell/shell.component';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () =>
      import('./features/auth/auth.module').then(m => m.AuthModule),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.module').then(m => m.DashboardModule),
      },
      {
        path: 'admin',
        canActivate: [AdminGuard],
        loadChildren: () =>
          import('./features/admin/admin.module').then(m => m.AdminModule),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
```

- [ ] **Step 7: Verificar que compila**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -10
```

Expected: compilación exitosa sin errores.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/features/admin/ frontend/src/app/app-routing.module.ts
git commit -m "feat(frontend): scaffold AdminModule — routing, módulo y stubs de componentes"
```

---

## Task 6: Implementar UsersComponent

Reemplaza el stub con la implementación completa.

**Files:**
- Modify: `frontend/src/app/features/admin/users/users.component.ts`
- Modify: `frontend/src/app/features/admin/users/users.component.html`
- Modify: `frontend/src/app/features/admin/users/users.component.scss`
- Create: `frontend/src/app/features/admin/users/users.component.spec.ts`

- [ ] **Step 1: Escribir spec del componente (rojo)**

Crear `frontend/src/app/features/admin/users/users.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UsersComponent } from './users.component';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.models';

const seedAdmin: User = {
  id: 'seed-id',
  name: 'Admin ONDRA',
  email: 'admininfraops@ondra.com.ar',
  role: 'ADMIN',
  mustChangePassword: false,
  isActive: true,
  technicianId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const techUser: User = {
  id: 'user-2',
  name: 'Valen Técnico',
  email: 'valen@ondra.com.ar',
  role: 'TECHNICIAN',
  mustChangePassword: false,
  isActive: true,
  technicianId: 'tech-1',
  createdAt: '2026-01-15T00:00:00.000Z',
};

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;
  let usersServiceSpy: jasmine.SpyObj<UsersService>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    usersServiceSpy = jasmine.createSpyObj('UsersService', [
      'getAll', 'updateStatus', 'resetPassword',
    ]);
    authServiceSpy = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    usersServiceSpy.getAll.and.returnValue(of([seedAdmin, techUser]));
    authServiceSpy.getCurrentUser.and.returnValue({
      id: 'current-id', email: 'current@ondra.com.ar', role: 'ADMIN',
    });

    await TestBed.configureTestingModule({
      declarations: [UsersComponent],
      imports: [MatDialogModule, MatMenuModule, MatSnackBarModule, NoopAnimationsModule],
      providers: [
        { provide: UsersService, useValue: usersServiceSpy },
        { provide: AuthService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga usuarios en ngOnInit', () => {
    expect(usersServiceSpy.getAll).toHaveBeenCalledOnce();
    expect(component.users).toEqual([seedAdmin, techUser]);
  });

  it('setea error y loading=false cuando getAll falla', () => {
    usersServiceSpy.getAll.and.returnValue(throwError(() => new Error('Network')));
    component.loadUsers();
    expect(component.error).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  describe('isSeedAdmin()', () => {
    it('devuelve true para el email del seed admin', () => {
      expect(component.isSeedAdmin(seedAdmin)).toBeTrue();
    });
    it('devuelve false para otros usuarios', () => {
      expect(component.isSeedAdmin(techUser)).toBeFalse();
    });
  });

  describe('isCurrentUser()', () => {
    it('devuelve true cuando el id coincide con el usuario logueado', () => {
      const me: User = { ...techUser, id: 'current-id' };
      expect(component.isCurrentUser(me)).toBeTrue();
    });
    it('devuelve false para otros usuarios', () => {
      expect(component.isCurrentUser(techUser)).toBeFalse();
    });
  });

  describe('roleBadgeClass()', () => {
    it('ADMIN → badge--accent',       () => expect(component.roleBadgeClass('ADMIN')).toBe('badge--accent'));
    it('TL → badge--srv',             () => expect(component.roleBadgeClass('TL')).toBe('badge--srv'));
    it('COORDINATOR → badge--purple', () => expect(component.roleBadgeClass('COORDINATOR')).toBe('badge--purple'));
    it('TECHNICIAN → badge--neutral', () => expect(component.roleBadgeClass('TECHNICIAN')).toBe('badge--neutral'));
  });
});
```

- [ ] **Step 2: Correr spec para confirmar que falla**

```bash
cd frontend && npx ng test --include="**/users.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: tests fallan porque el componente es un stub vacío.

- [ ] **Step 3: Implementar users.component.ts**

Reemplazar `frontend/src/app/features/admin/users/users.component.ts`:

```typescript
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { User } from '../../../core/models/user.models';
import { UserRole } from '../../../core/models/auth.models';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserFormDialogComponent } from './user-form-dialog/user-form-dialog.component';
import { PasswordDisplayDialogComponent } from './password-display-dialog/password-display-dialog.component';

const SEED_ADMIN_EMAIL = 'admininfraops@ondra.com.ar';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  loading = false;
  error = '';

  private readonly currentUserId: string;

  constructor(
    private usersService: UsersService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {
    this.currentUserId = this.authService.getCurrentUser()?.id ?? '';
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.usersService.getAll().subscribe({
      next: users => {
        this.users = users;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los usuarios.';
        this.loading = false;
      },
    });
  }

  isSeedAdmin(user: User): boolean {
    return user.email === SEED_ADMIN_EMAIL;
  }

  isCurrentUser(user: User): boolean {
    return user.id === this.currentUserId;
  }

  roleBadgeClass(role: UserRole): string {
    const map: Record<UserRole, string> = {
      ADMIN:       'badge--accent',
      TL:          'badge--srv',
      COORDINATOR: 'badge--purple',
      TECHNICIAN:  'badge--neutral',
    };
    return map[role];
  }

  roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      ADMIN:       'Admin',
      TL:          'Team Lead',
      COORDINATOR: 'Coordinador',
      TECHNICIAN:  'Técnico',
    };
    return labels[role];
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(UserFormDialogComponent, {
      data: { mode: 'create' },
      width: '480px',
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.loadUsers();
      if (result.plainPassword) {
        this.dialog.open(PasswordDisplayDialogComponent, {
          data: { name: result.name, plainPassword: result.plainPassword },
          width: '420px',
        });
      }
    });
  }

  openEditDialog(user: User): void {
    this.dialog
      .open(UserFormDialogComponent, { data: { mode: 'edit', user }, width: '480px' })
      .afterClosed()
      .subscribe(updated => { if (updated) this.loadUsers(); });
  }

  toggleStatus(user: User): void {
    this.usersService.updateStatus(user.id, !user.isActive).subscribe({
      next: () => this.loadUsers(),
      error: () =>
        this.snackBar.open('No se pudo actualizar el estado.', '', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  resetPassword(user: User): void {
    this.usersService.resetPassword(user.id).subscribe({
      next: res =>
        this.dialog.open(PasswordDisplayDialogComponent, {
          data: { name: user.name, plainPassword: res.plainPassword },
          width: '420px',
        }),
      error: () =>
        this.snackBar.open('No se pudo resetear la contraseña.', '', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }
}
```

- [ ] **Step 4: Implementar users.component.html**

Reemplazar `frontend/src/app/features/admin/users/users.component.html`:

```html
<div class="users-page">
  <div class="users-header">
    <div>
      <h1 class="users-header__title">Usuarios</h1>
      <span class="users-header__count">{{ users.length }} usuarios registrados</span>
    </div>
    <button class="btn btn--primary" (click)="openCreateDialog()">
      <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/>
        <line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
      Nuevo usuario
    </button>
  </div>

  <div *ngIf="error" class="error-banner">
    {{ error }}
    <button class="btn btn--secondary" style="padding:4px 10px;font-size:12px" (click)="loadUsers()">
      Reintentar
    </button>
  </div>

  <div class="surface-card">
    <ng-container *ngIf="loading">
      <div style="padding:16px;display:flex;flex-direction:column;gap:8px">
        <div class="skeleton" style="height:38px;border-radius:var(--radius-sm)"></div>
        <div class="skeleton" style="height:38px;border-radius:var(--radius-sm)"></div>
        <div class="skeleton" style="height:38px;border-radius:var(--radius-sm)"></div>
      </div>
    </ng-container>

    <table *ngIf="!loading" class="users-table">
      <thead>
        <tr>
          <th>USUARIO</th>
          <th>ROL</th>
          <th>ESTADO</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let user of users">
          <td>
            <div class="user-info">
              <span class="user-name">{{ user.name }}</span>
              <span class="user-email">{{ user.email }}</span>
            </div>
          </td>
          <td>
            <span class="badge" [ngClass]="roleBadgeClass(user.role)">
              {{ roleLabel(user.role) }}
            </span>
          </td>
          <td>
            <span class="badge" [ngClass]="user.isActive ? 'badge--ok' : 'badge--neutral'">
              <span class="dot"></span>
              {{ user.isActive ? 'Activo' : 'Inactivo' }}
            </span>
          </td>
          <td class="td-actions">
            <ng-container *ngIf="!isCurrentUser(user)">
              <button class="actions-btn" [matMenuTriggerFor]="menu">
                <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor">
                  <circle cx="12" cy="5" r="1.5"/>
                  <circle cx="12" cy="12" r="1.5"/>
                  <circle cx="12" cy="19" r="1.5"/>
                </svg>
              </button>
              <mat-menu #menu="matMenu" xPosition="before">
                <button mat-menu-item *ngIf="!isSeedAdmin(user)" (click)="openEditDialog(user)">
                  <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-right:8px;vertical-align:middle">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Editar
                </button>
                <button mat-menu-item *ngIf="!isSeedAdmin(user)" (click)="toggleStatus(user)">
                  <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-right:8px;vertical-align:middle">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                  {{ user.isActive ? 'Desactivar' : 'Activar' }}
                </button>
                <button mat-menu-item (click)="resetPassword(user)">
                  <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-right:8px;vertical-align:middle">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                  Resetear contraseña
                </button>
              </mat-menu>
            </ng-container>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

- [ ] **Step 5: Implementar users.component.scss**

Reemplazar `frontend/src/app/features/admin/users/users.component.scss`:

```scss
.users-page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.users-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  &__title {
    font-size: 20px;
    font-weight: 600;
    color: var(--tx-hi);
    margin: 0 0 2px;
    font-family: var(--font-ui);
  }

  &__count {
    font-size: 11px;
    color: var(--tx-lo);
    font-family: var(--font-mono);
  }
}

.users-table {
  width: 100%;
  border-collapse: collapse;

  th {
    padding: 10px 16px;
    text-align: left;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tx-lo);
    font-family: var(--font-mono);
    border-bottom: 1px solid var(--border-lo);
  }

  td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-lo);
    vertical-align: middle;
  }

  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover td { background: var(--hover); }
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--tx-hi);
}

.user-email {
  font-size: 11px;
  color: var(--tx-md);
  font-family: var(--font-mono);
  letter-spacing: -0.01em;
}

.td-actions {
  width: 40px;
  text-align: right;
}

.actions-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--tx-lo);
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  transition: background var(--transition), color var(--transition);

  &:hover {
    background: var(--elevated);
    color: var(--tx-md);
  }
}
```

- [ ] **Step 6: Correr spec para confirmar verde**

```bash
cd frontend && npx ng test --include="**/users.component.spec.ts" --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/features/admin/users/users.component.ts \
        frontend/src/app/features/admin/users/users.component.html \
        frontend/src/app/features/admin/users/users.component.scss \
        frontend/src/app/features/admin/users/users.component.spec.ts
git commit -m "feat(frontend): implementar UsersComponent — tabla, badges de rol/estado, menú de acciones con seed admin guard"
```

---

## Task 7: Agregar estilos de dialog y field en components.scss

Los diálogos de las tareas 8 y 9 dependen de estas clases.

**Files:**
- Modify: `frontend/src/styles/components.scss`

- [ ] **Step 1: Agregar al final de frontend/src/styles/components.scss**

```scss
// ── Dialog inner layout ───────────────────────────────────────
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border-lo);
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--tx-hi);
  margin: 0;
}

.dialog-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 24px 20px;
}

// ── Form field ────────────────────────────────────────────────
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--tx-lo);
    font-family: var(--font-mono);
  }
}

// ── Password display ──────────────────────────────────────────
.password-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 16px;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/styles/components.scss
git commit -m "feat(frontend): agregar estilos dialog-header, dialog-body, dialog-footer, field y password-box"
```

---

## Task 8: Implementar UserFormDialogComponent

Reemplaza el stub con el formulario completo de crear/editar usuario.

**Files:**
- Create: `frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.html`
- Modify: `frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.ts`

- [ ] **Step 1: Crear user-form-dialog.component.html**

Crear `frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.html`:

```html
<div class="dialog-header">
  <h2 class="dialog-title">
    {{ data.mode === 'create' ? 'Nuevo usuario' : 'Editar usuario' }}
  </h2>
  <button class="btn btn--secondary" style="padding:3px 8px" (click)="cancel()">
    <svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  </button>
</div>

<div class="dialog-body">
  <form [formGroup]="form" id="user-form">
    <div class="field">
      <label class="field__label">Nombre</label>
      <input class="input" formControlName="name" type="text" placeholder="Nombre completo" />
    </div>
    <div class="field">
      <label class="field__label">Email</label>
      <input
        class="input"
        formControlName="email"
        type="email"
        placeholder="email@ondra.com.ar"
      />
    </div>
    <div class="field">
      <label class="field__label">Rol</label>
      <select class="input" formControlName="role">
        <option *ngFor="let r of roles" [value]="r.value">{{ r.label }}</option>
      </select>
    </div>
    <div *ngIf="error" class="error-banner">{{ error }}</div>
  </form>
</div>

<div class="dialog-footer">
  <button type="button" class="btn btn--secondary" (click)="cancel()">Cancelar</button>
  <button
    type="button"
    class="btn btn--primary"
    [disabled]="form.invalid || loading"
    (click)="submit()"
  >
    {{ loading ? 'Guardando…' : data.mode === 'create' ? 'Crear usuario' : 'Guardar cambios' }}
  </button>
</div>
```

- [ ] **Step 2: Reemplazar user-form-dialog.component.ts**

Reemplazar `frontend/src/app/features/admin/users/user-form-dialog/user-form-dialog.component.ts`:

```typescript
import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { User, CreateUserPayload, UpdateUserPayload } from '../../../../core/models/user.models';
import { UserRole } from '../../../../core/models/auth.models';
import { UsersService } from '../../../../core/services/users.service';

export interface UserFormDialogData {
  mode: 'create' | 'edit';
  user?: User;
}

@Component({
  selector: 'app-user-form-dialog',
  templateUrl: './user-form-dialog.component.html',
})
export class UserFormDialogComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  error = '';

  readonly roles: { value: UserRole; label: string }[] = [
    { value: 'ADMIN',       label: 'Admin' },
    { value: 'TL',          label: 'Team Lead' },
    { value: 'COORDINATOR', label: 'Coordinador' },
    { value: 'TECHNICIAN',  label: 'Técnico' },
  ];

  constructor(
    private fb: FormBuilder,
    private usersService: UsersService,
    private dialogRef: MatDialogRef<UserFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserFormDialogData,
  ) {}

  ngOnInit(): void {
    const u = this.data.user;
    this.form = this.fb.group({
      name:  [u?.name  ?? '', Validators.required],
      email: [u?.email ?? '', [Validators.required, Validators.email]],
      role:  [u?.role  ?? 'TECHNICIAN', Validators.required],
    });
    if (this.data.mode === 'edit') {
      this.form.get('email')?.disable();
    }
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';

    if (this.data.mode === 'create') {
      const payload: CreateUserPayload = this.form.getRawValue();
      this.usersService.create(payload).subscribe({
        next: res =>
          this.dialogRef.close({ name: res.name, plainPassword: res.plainPassword }),
        error: err => {
          this.loading = false;
          this.error = err.error?.message ?? 'No se pudo crear el usuario.';
        },
      });
    } else {
      const payload: UpdateUserPayload = {
        name: this.form.value.name,
        role: this.form.value.role,
      };
      this.usersService.update(this.data.user!.id, payload).subscribe({
        next: () => this.dialogRef.close(true),
        error: err => {
          this.loading = false;
          this.error = err.error?.message ?? 'No se pudo actualizar el usuario.';
        },
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
```

- [ ] **Step 3: Verificar build**

```bash
cd frontend && npx ng build --configuration development 2>&1 | tail -5
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/admin/users/user-form-dialog/
git commit -m "feat(frontend): implementar UserFormDialogComponent — crear y editar usuarios con ReactiveForm"
```

---

## Task 9: Implementar PasswordDisplayDialogComponent

Reemplaza el stub con el display de contraseña temporal y botón de copia.

**Files:**
- Create: `frontend/src/app/features/admin/users/password-display-dialog/password-display-dialog.component.html`
- Modify: `frontend/src/app/features/admin/users/password-display-dialog/password-display-dialog.component.ts`

- [ ] **Step 1: Crear password-display-dialog.component.html**

Crear `frontend/src/app/features/admin/users/password-display-dialog/password-display-dialog.component.html`:

```html
<div class="dialog-header">
  <h2 class="dialog-title">Contraseña temporal</h2>
</div>

<div class="dialog-body">
  <p style="color:var(--tx-md);font-size:13px;margin:0">
    Contraseña generada para
    <strong style="color:var(--tx-hi)">{{ data.name }}</strong>.<br>
    Guardala ahora — no se va a mostrar de nuevo.
  </p>
  <div class="password-box">
    <span class="mono" style="font-size:14px;color:var(--tx-hi);letter-spacing:0.05em">
      {{ data.plainPassword }}
    </span>
    <button class="btn btn--secondary" (click)="copy()">
      {{ copied ? '¡Copiado!' : 'Copiar' }}
    </button>
  </div>
</div>

<div class="dialog-footer">
  <button class="btn btn--primary" (click)="close()">Listo</button>
</div>
```

- [ ] **Step 2: Reemplazar password-display-dialog.component.ts**

Reemplazar `frontend/src/app/features/admin/users/password-display-dialog/password-display-dialog.component.ts`:

```typescript
import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-password-display-dialog',
  templateUrl: './password-display-dialog.component.html',
})
export class PasswordDisplayDialogComponent {
  copied = false;

  constructor(
    private dialogRef: MatDialogRef<PasswordDisplayDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { name: string; plainPassword: string },
  ) {}

  copy(): void {
    navigator.clipboard.writeText(this.data.plainPassword).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
```

- [ ] **Step 3: Correr suite completa de tests**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: todos los tests pasan — los existentes (auth, login, guard) más los nuevos (UsersService ×5, AdminGuard ×3, UsersComponent ×8).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/features/admin/users/password-display-dialog/
git commit -m "feat(frontend): implementar PasswordDisplayDialogComponent — display y copia de contraseña temporal"
```