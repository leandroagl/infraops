# Client Detail Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el layout de detalle de cliente — sidebar contextual que reemplaza el global, child routes para Overview y Mantenimientos, y un `SidenavContextService` como puente de comunicación.

**Architecture:** `SidenavContextService` actúa como puente singleton: `ClientDetailComponent` lo alimenta con el cliente al inicializar y lo limpia al destruirse; `ShellComponent` lo observa y cambia el sidebar entre modo global (52px, íconos) y modo cliente (180px, íconos + texto). Las dos secciones del cliente son child routes con componentes stub.

**Tech Stack:** Angular 17, Jasmine + Karma, RxJS BehaviorSubject, Angular Router child routes

---

## File Map

| Acción | Archivo |
|--------|---------|
| Crear | `frontend/src/app/core/services/sidenav-context.service.ts` |
| Crear | `frontend/src/app/core/services/sidenav-context.service.spec.ts` |
| Modificar | `frontend/src/app/core/services/clients.service.ts` |
| Crear | `frontend/src/app/core/services/clients.service.spec.ts` |
| Crear | `frontend/src/app/features/clients/client-overview/client-overview.component.ts` |
| Crear | `frontend/src/app/features/clients/client-overview/client-overview.component.spec.ts` |
| Crear | `frontend/src/app/features/clients/client-mantenimientos/client-mantenimientos.component.ts` |
| Crear | `frontend/src/app/features/clients/client-mantenimientos/client-mantenimientos.component.spec.ts` |
| Modificar | `frontend/src/app/features/clients/client-detail/client-detail.component.ts` |
| Modificar | `frontend/src/app/features/clients/client-detail/client-detail.component.html` |
| Crear | `frontend/src/app/features/clients/client-detail/client-detail.component.spec.ts` |
| Modificar | `frontend/src/app/features/clients/clients-routing.module.ts` |
| Modificar | `frontend/src/app/features/clients/clients.module.ts` |
| Modificar | `frontend/src/app/core/shell/shell.component.ts` |
| Modificar | `frontend/src/app/core/shell/shell.component.html` |
| Modificar | `frontend/src/app/core/shell/shell.component.scss` |
| Crear | `frontend/src/app/core/shell/shell.component.spec.ts` |

---

## Task 1: SidenavContextService

**Files:**
- Create: `frontend/src/app/core/services/sidenav-context.service.ts`
- Create: `frontend/src/app/core/services/sidenav-context.service.spec.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/core/services/sidenav-context.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { SidenavContextService } from './sidenav-context.service';

describe('SidenavContextService', () => {
  let service: SidenavContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SidenavContextService);
  });

  it('emite null inicialmente', (done) => {
    service.client$.subscribe(val => {
      expect(val).toBeNull();
      done();
    });
  });

  it('emite el cliente tras llamar setClient', (done) => {
    service.setClient({ id: '1', name: 'ACME Corp' });
    service.client$.subscribe(val => {
      expect(val).toEqual({ id: '1', name: 'ACME Corp' });
      done();
    });
  });

  it('emite null tras llamar clearClient', (done) => {
    service.setClient({ id: '1', name: 'ACME Corp' });
    service.clearClient();
    service.client$.subscribe(val => {
      expect(val).toBeNull();
      done();
    });
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/core/services/sidenav-context.service.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — `SidenavContextService` no existe aún.

- [ ] **Step 3: Crear el servicio**

```typescript
// frontend/src/app/core/services/sidenav-context.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ClientSidenavContext {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class SidenavContextService {
  private readonly clientSubject = new BehaviorSubject<ClientSidenavContext | null>(null);

  readonly client$: Observable<ClientSidenavContext | null> = this.clientSubject.asObservable();

  setClient(client: ClientSidenavContext): void {
    this.clientSubject.next(client);
  }

  clearClient(): void {
    this.clientSubject.next(null);
  }
}
```

- [ ] **Step 4: Verificar que el test pasa**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/core/services/sidenav-context.service.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: 3 specs, 0 failures.

- [ ] **Step 5: Commit**

```
git add frontend/src/app/core/services/sidenav-context.service.ts frontend/src/app/core/services/sidenav-context.service.spec.ts
git commit -m "feat(shell): agregar SidenavContextService para contexto del sidebar"
```

---

## Task 2: ClientsService.getById

**Files:**
- Modify: `frontend/src/app/core/services/clients.service.ts`
- Create: `frontend/src/app/core/services/clients.service.spec.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/core/services/clients.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ClientsService } from './clients.service';
import { environment } from '../../../environments/environment';

describe('ClientsService', () => {
  let service: ClientsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(ClientsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getById hace GET a /clients/:id y retorna el cliente', () => {
    const expected = {
      id: 'abc',
      name: 'ACME Corp',
      primaryAddress: 'Av. Corrientes 123',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    service.getById('abc').subscribe(result => {
      expect(result).toEqual(expected);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/clients/abc`);
    expect(req.request.method).toBe('GET');
    req.flush(expected);
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/core/services/clients.service.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — `getById` no existe aún.

- [ ] **Step 3: Agregar getById al servicio**

Archivo actual: `frontend/src/app/core/services/clients.service.ts`

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Client } from '../models/client.models';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly base = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Client[]> {
    return this.http.get<Client[]>(this.base);
  }

  getById(id: string): Observable<Client> {
    return this.http.get<Client>(`${this.base}/${id}`);
  }
}
```

- [ ] **Step 4: Verificar que el test pasa**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/core/services/clients.service.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: 1 spec, 0 failures.

- [ ] **Step 5: Commit**

```
git add frontend/src/app/core/services/clients.service.ts frontend/src/app/core/services/clients.service.spec.ts
git commit -m "feat(clients): agregar ClientsService.getById"
```

---

## Task 3: ClientOverviewComponent (stub)

**Files:**
- Create: `frontend/src/app/features/clients/client-overview/client-overview.component.ts`
- Create: `frontend/src/app/features/clients/client-overview/client-overview.component.spec.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/features/clients/client-overview/client-overview.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientOverviewComponent } from './client-overview.component';

describe('ClientOverviewComponent', () => {
  let fixture: ComponentFixture<ClientOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClientOverviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientOverviewComponent);
    fixture.detectChanges();
  });

  it('renderiza el placeholder de overview', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Overview');
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/features/clients/client-overview/client-overview.component.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — el componente no existe aún.

- [ ] **Step 3: Crear el componente**

```typescript
// frontend/src/app/features/clients/client-overview/client-overview.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-client-overview',
  template: '<p class="tx-md" style="padding: 24px;">Overview — próximamente</p>',
})
export class ClientOverviewComponent {}
```

- [ ] **Step 4: Verificar que el test pasa**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/features/clients/client-overview/client-overview.component.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: 1 spec, 0 failures.

- [ ] **Step 5: Commit**

```
git add frontend/src/app/features/clients/client-overview/
git commit -m "feat(clients): agregar ClientOverviewComponent stub"
```

---

## Task 4: ClientMantenimientosComponent (stub)

**Files:**
- Create: `frontend/src/app/features/clients/client-mantenimientos/client-mantenimientos.component.ts`
- Create: `frontend/src/app/features/clients/client-mantenimientos/client-mantenimientos.component.spec.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/features/clients/client-mantenimientos/client-mantenimientos.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientMantenimientosComponent } from './client-mantenimientos.component';

describe('ClientMantenimientosComponent', () => {
  let fixture: ComponentFixture<ClientMantenimientosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClientMantenimientosComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientMantenimientosComponent);
    fixture.detectChanges();
  });

  it('renderiza el placeholder de mantenimientos', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Mantenimientos');
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/features/clients/client-mantenimientos/client-mantenimientos.component.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — el componente no existe aún.

- [ ] **Step 3: Crear el componente**

```typescript
// frontend/src/app/features/clients/client-mantenimientos/client-mantenimientos.component.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-client-mantenimientos',
  template: '<p class="tx-md" style="padding: 24px;">Mantenimientos — próximamente</p>',
})
export class ClientMantenimientosComponent {}
```

- [ ] **Step 4: Verificar que el test pasa**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/features/clients/client-mantenimientos/client-mantenimientos.component.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: 1 spec, 0 failures.

- [ ] **Step 5: Commit**

```
git add frontend/src/app/features/clients/client-mantenimientos/
git commit -m "feat(clients): agregar ClientMantenimientosComponent stub"
```

---

## Task 5: ClientDetailComponent refactor

**Files:**
- Modify: `frontend/src/app/features/clients/client-detail/client-detail.component.ts`
- Modify: `frontend/src/app/features/clients/client-detail/client-detail.component.html`
- Create: `frontend/src/app/features/clients/client-detail/client-detail.component.spec.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/features/clients/client-detail/client-detail.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClientDetailComponent } from './client-detail.component';
import { ClientsService } from '../../../core/services/clients.service';
import { SidenavContextService } from '../../../core/services/sidenav-context.service';
import { Client } from '../../../core/models/client.models';

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'abc',
  name: 'ACME Corp',
  primaryAddress: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('ClientDetailComponent', () => {
  let fixture: ComponentFixture<ClientDetailComponent>;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let sidenavCtxSpy: jasmine.SpyObj<SidenavContextService>;

  beforeEach(async () => {
    clientsServiceSpy = jasmine.createSpyObj('ClientsService', ['getById']);
    sidenavCtxSpy = jasmine.createSpyObj('SidenavContextService', ['setClient', 'clearClient']);
    clientsServiceSpy.getById.and.returnValue(of(makeClient()));

    await TestBed.configureTestingModule({
      declarations: [ClientDetailComponent],
      providers: [
        { provide: ClientsService, useValue: clientsServiceSpy },
        { provide: SidenavContextService, useValue: sidenavCtxSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'abc' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientDetailComponent);
    fixture.detectChanges();
  });

  it('llama a sidenavCtx.setClient con el id y nombre del cliente', () => {
    expect(sidenavCtxSpy.setClient).toHaveBeenCalledWith({ id: 'abc', name: 'ACME Corp' });
  });

  it('llama a sidenavCtx.clearClient al destruirse', () => {
    fixture.destroy();
    expect(sidenavCtxSpy.clearClient).toHaveBeenCalled();
  });

  it('setea loadError en true cuando falla la carga', async () => {
    clientsServiceSpy.getById.and.returnValue(throwError(() => new Error('network')));
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [ClientDetailComponent],
      providers: [
        { provide: ClientsService, useValue: clientsServiceSpy },
        { provide: SidenavContextService, useValue: sidenavCtxSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'abc' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const f = TestBed.createComponent(ClientDetailComponent);
    f.detectChanges();
    expect(f.componentInstance.loadError).toBe(true);
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/features/clients/client-detail/client-detail.component.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — el componente actual no inyecta `ClientsService` ni `SidenavContextService`.

- [ ] **Step 3: Refactorizar el componente**

```typescript
// frontend/src/app/features/clients/client-detail/client-detail.component.ts
import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ClientsService } from '../../../core/services/clients.service';
import { SidenavContextService } from '../../../core/services/sidenav-context.service';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
})
export class ClientDetailComponent implements OnInit, OnDestroy {
  loadError = false;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly clientsService: ClientsService,
    private readonly sidenavCtx: SidenavContextService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.clientsService.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (client) => {
          this.sidenavCtx.setClient({ id: client.id, name: client.name });
        },
        error: () => {
          this.loadError = true;
        },
      });
  }

  ngOnDestroy(): void {
    this.sidenavCtx.clearClient();
  }
}
```

- [ ] **Step 4: Actualizar el template**

```html
<!-- frontend/src/app/features/clients/client-detail/client-detail.component.html -->
<router-outlet></router-outlet>
```

- [ ] **Step 5: Verificar que el test pasa**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/features/clients/client-detail/client-detail.component.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: 3 specs, 0 failures.

- [ ] **Step 6: Commit**

```
git add frontend/src/app/features/clients/client-detail/
git commit -m "feat(clients): refactorizar ClientDetailComponent con SidenavContext y router-outlet"
```

---

## Task 6: Routing y módulo de clientes

**Files:**
- Modify: `frontend/src/app/features/clients/clients-routing.module.ts`
- Modify: `frontend/src/app/features/clients/clients.module.ts`

No hay lógica nueva que testear aquí — la validación es que la app compila y navega correctamente.

- [ ] **Step 1: Actualizar clients-routing.module.ts**

```typescript
// frontend/src/app/features/clients/clients-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientOverviewComponent } from './client-overview/client-overview.component';
import { ClientMantenimientosComponent } from './client-mantenimientos/client-mantenimientos.component';

const routes: Routes = [
  { path: '', component: ClientsListComponent },
  {
    path: ':id',
    component: ClientDetailComponent,
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', component: ClientOverviewComponent },
      { path: 'mantenimientos', component: ClientMantenimientosComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ClientsRoutingModule {}
```

- [ ] **Step 2: Actualizar clients.module.ts**

```typescript
// frontend/src/app/features/clients/clients.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AgGridModule } from 'ag-grid-angular';
import { ClientsRoutingModule } from './clients-routing.module';
import { ClientsListComponent } from './clients-list/clients-list.component';
import { ClientDetailComponent } from './client-detail/client-detail.component';
import { ClientOverviewComponent } from './client-overview/client-overview.component';
import { ClientMantenimientosComponent } from './client-mantenimientos/client-mantenimientos.component';

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
    AgGridModule,
    ClientsRoutingModule,
  ],
})
export class ClientsModule {}
```

- [ ] **Step 3: Verificar que el build compila sin errores**

```
cd e:\develop\infraops\frontend && npx ng build --configuration=development 2>&1 | tail -20
```

Esperado: `Build at:` sin errores de compilación.

- [ ] **Step 4: Commit**

```
git add frontend/src/app/features/clients/clients-routing.module.ts frontend/src/app/features/clients/clients.module.ts
git commit -m "feat(clients): configurar child routes para overview y mantenimientos"
```

---

## Task 7: ShellComponent — sidebar contextual

**Files:**
- Modify: `frontend/src/app/core/shell/shell.component.ts`
- Modify: `frontend/src/app/core/shell/shell.component.html`
- Modify: `frontend/src/app/core/shell/shell.component.scss`
- Create: `frontend/src/app/core/shell/shell.component.spec.ts`

- [ ] **Step 1: Escribir el test**

```typescript
// frontend/src/app/core/shell/shell.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ShellComponent } from './shell.component';
import { AuthService } from '../services/auth.service';
import { SidenavContextService, ClientSidenavContext } from '../services/sidenav-context.service';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let clientSubject: BehaviorSubject<ClientSidenavContext | null>;

  beforeEach(async () => {
    clientSubject = new BehaviorSubject<ClientSidenavContext | null>(null);

    await TestBed.configureTestingModule({
      declarations: [ShellComponent],
      providers: [
        {
          provide: Router,
          useValue: jasmine.createSpyObj('Router', { isActive: false }),
        },
        {
          provide: AuthService,
          useValue: { getCurrentUser: () => null, logout: jasmine.createSpy() },
        },
        {
          provide: SidenavContextService,
          useValue: { client$: clientSubject.asObservable() },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges(); // dispara ngOnInit
  });

  it('muestra el nav global cuando no hay cliente activo', () => {
    const globalNav = fixture.nativeElement.querySelector('.sidebar__nav--global');
    expect(globalNav).toBeTruthy();
  });

  it('no muestra el nav de cliente cuando no hay cliente activo', () => {
    const clientNav = fixture.nativeElement.querySelector('.sidebar__nav--client');
    expect(clientNav).toBeFalsy();
  });

  it('muestra el nav de cliente cuando hay cliente activo', () => {
    clientSubject.next({ id: '1', name: 'ACME Corp' });
    fixture.detectChanges();
    const clientNav = fixture.nativeElement.querySelector('.sidebar__nav--client');
    expect(clientNav).toBeTruthy();
  });

  it('no muestra el nav global cuando hay cliente activo', () => {
    clientSubject.next({ id: '1', name: 'ACME Corp' });
    fixture.detectChanges();
    const globalNav = fixture.nativeElement.querySelector('.sidebar__nav--global');
    expect(globalNav).toBeFalsy();
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/core/shell/shell.component.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — el shell no consume `SidenavContextService` ni tiene `.sidebar__nav--global` / `.sidebar__nav--client`.

- [ ] **Step 3: Actualizar shell.component.ts**

```typescript
// frontend/src/app/core/shell/shell.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AuthUser } from '../models/auth.models';
import { SidenavContextService, ClientSidenavContext } from '../services/sidenav-context.service';

interface NavItem {
  route: string;
  label: string;
  icon: 'dashboard' | 'clients' | 'tasks' | 'admin';
}

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly navItems: NavItem[] = [
    { route: '/dashboard', label: 'Dashboard',  icon: 'dashboard' },
    { route: '/clients',   label: 'Clientes',   icon: 'clients'   },
    { route: '/tasks',     label: 'Mis tareas', icon: 'tasks'     },
    { route: '/admin',     label: 'Admin',      icon: 'admin'     },
  ];

  readonly currentUser: AuthUser | null;
  clientContext: ClientSidenavContext | null = null;

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly sidenavCtx: SidenavContextService,
  ) {
    this.currentUser = this.auth.getCurrentUser();
  }

  ngOnInit(): void {
    this.sidenavCtx.client$.subscribe(ctx => {
      this.clientContext = ctx;
    });
  }

  isActive(route: string): boolean {
    return this.router.isActive(route, {
      paths: 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
```

- [ ] **Step 4: Actualizar shell.component.html**

Reemplazar el contenido completo del archivo:

```html
<div class="shell">

  <!-- ── Sidebar ─────────────────────────────────────────── -->
  <aside class="sidebar" [class.sidebar--client]="clientContext">

    <div class="sidebar__logo">
      <svg viewBox="0 0 24 24"
           style="width:22px;height:22px;stroke:var(--accent);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <path d="M8 21h8M12 17v4"/>
      </svg>
    </div>

    <!-- MODO CLIENTE -->
    <ng-container *ngIf="clientContext; else globalNav">
      <a class="client-nav-item client-nav-item--back"
         routerLink="/clients"
         title="Volver a Clientes">
        <svg viewBox="0 0 24 24"
             style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span class="client-nav-item__label">Clientes</span>
      </a>

      <div class="sidebar__divider"></div>

      <nav class="sidebar__nav sidebar__nav--client">
        <a class="client-nav-item"
           [routerLink]="['/clients', clientContext.id, 'overview']"
           routerLinkActive="active"
           title="Overview">
          <svg viewBox="0 0 24 24"
               style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span class="client-nav-item__label">Overview</span>
        </a>

        <a class="client-nav-item"
           [routerLink]="['/clients', clientContext.id, 'mantenimientos']"
           routerLinkActive="active"
           title="Mantenimientos">
          <svg viewBox="0 0 24 24"
               style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
          <span class="client-nav-item__label">Mantenimientos</span>
        </a>
      </nav>
    </ng-container>

    <!-- MODO GLOBAL -->
    <ng-template #globalNav>
      <nav class="sidebar__nav sidebar__nav--global">
        <a *ngFor="let item of navItems"
           [routerLink]="item.route"
           class="nav-item"
           [class.active]="isActive(item.route)"
           [title]="item.label">

          <svg *ngIf="item.icon === 'dashboard'" viewBox="0 0 24 24"
               style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>

          <svg *ngIf="item.icon === 'tasks'" viewBox="0 0 24 24"
               style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <path d="M9 11l3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>

          <svg *ngIf="item.icon === 'clients'" viewBox="0 0 24 24"
               style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>

          <svg *ngIf="item.icon === 'admin'" viewBox="0 0 24 24"
               style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <path d="M9 12h6M9 16h4"/>
          </svg>

        </a>
      </nav>
    </ng-template>

    <div class="sidebar__bottom">
      <button class="nav-item nav-item--logout" (click)="logout()" title="Cerrar sesión">
        <svg viewBox="0 0 24 24"
             style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>
  </aside>

  <!-- ── Main ───────────────────────────────────────────── -->
  <div class="shell__body">
    <header class="topbar">
      <span class="topbar__title">InfraOps</span>
      <div class="topbar__user">
        <span class="topbar__role">{{ currentUser?.role }}</span>
        <span class="topbar__email">{{ currentUser?.email }}</span>
      </div>
    </header>

    <main class="shell__content">
      <router-outlet></router-outlet>
    </main>
  </div>

</div>
```

- [ ] **Step 5: Agregar estilos del sidebar cliente en shell.component.scss**

Agregar al final del archivo existente:

```scss
// ── Client sidebar mode ────────────────────────────────────────
.sidebar--client {
  width: 180px;
}

.sidebar__divider {
  height: 1px;
  background: var(--border-lo);
  margin: 4px 8px;
  flex-shrink: 0;
}

.sidebar__nav--client {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0;
  flex: 1;
}

.client-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 34px;
  margin: 0 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  text-decoration: none;
  color: var(--tx-md);
  font-size: 12px;
  font-family: var(--font-ui);
  transition: color var(--transition), background var(--transition);
  flex-shrink: 0;

  &__label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  svg {
    flex-shrink: 0;
  }

  &:hover {
    background: var(--hover);
    color: var(--tx-hi);
  }

  &.active {
    background: var(--accent-bg);
    border-color: var(--accent-bd);
    color: var(--accent);
  }

  &--back {
    margin-top: 8px;
    color: var(--tx-lo);
    font-size: 11px;
    font-family: var(--font-mono);
  }
}
```

- [ ] **Step 6: Verificar que el test pasa**

```
cd e:\develop\infraops\frontend && npx ng test --include=src/app/core/shell/shell.component.spec.ts --watch=false --browsers=ChromeHeadless
```

Esperado: 4 specs, 0 failures.

- [ ] **Step 7: Verificar que todos los tests existentes siguen pasando**

```
cd e:\develop\infraops\frontend && npx ng test --watch=false --browsers=ChromeHeadless 2>&1 | tail -10
```

Esperado: 0 failures.

- [ ] **Step 8: Commit**

```
git add frontend/src/app/core/shell/
git commit -m "feat(shell): sidebar contextual — reemplaza nav global por nav de cliente"
```
