# Módulo Documentación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporar el manual de usuario de InfraOps en el sistema como un módulo Angular lazy-loaded `/docs` con sidebar de navegación filtrada por rol y renderizado Markdown.

**Architecture:** Módulo Angular independiente con `ngx-markdown` para renderizar archivos `.md` desde `assets/docs/`. Una config central (`docs-sections.ts`) define las secciones con metadata de rol; el componente filtra por el rol del JWT y mantiene la sección activa como estado local. Sin endpoint de backend.

**Tech Stack:** Angular 17, ngx-markdown@17, Angular Material (MatButtonModule), tokens CSS globales del design system.

**Spec:** `docs/superpowers/specs/2026-08-22-docs-module-design.md`

## Global Constraints

- Angular 17: sin standalone components; siempre NgModule + declarations
- `appearance="outline"` es el único estilo permitido para `mat-form-field` (no aplica en este módulo, pero rige globalmente)
- Íconos: SVG inline, stroke (no fill), `currentColor`, 15×15px en sidebar
- Tema dark: usar tokens de `tokens.scss` — no inventar colores
- Idioma del código: inglés; commits y docs: español
- TDD: siempre el test antes que la implementación
- Sin `::ng-deep` — usar CSS custom properties para theming
- Un archivo a la vez, confirmar antes de continuar

---

## File Map

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `frontend/src/assets/docs/01-que-es-infraops.md` | Crear | Contenido: qué es InfraOps + tabla de roles |
| `frontend/src/assets/docs/02-primer-acceso.md` | Crear | Contenido: login + cambio de contraseña |
| `frontend/src/assets/docs/03-vista-tareas.md` | Crear | Contenido: ciclo mensual, KPIs, filtros, tabla |
| `frontend/src/assets/docs/04-ejecutar-mantenimiento.md` | Crear | Contenido: drawer de detalle, flujo completo |
| `frontend/src/assets/docs/05-estados-tarea.md` | Crear | Contenido: tabla de estados + permisos por rol |
| `frontend/src/assets/docs/06-asignacion-tecnicos.md` | Crear | Contenido: Panel Admin → Técnicos (TL/ADMIN) |
| `frontend/src/assets/docs/07-coordinacion-visitas.md` | Crear | Contenido: coordinación de visitas presenciales |
| `frontend/src/assets/docs/08-gestion-usuarios.md` | Crear | Contenido: Panel Admin → Usuarios (ADMIN) |
| `frontend/src/app/features/docs/data/docs-sections.ts` | Crear | Config central: `DocSection`, `DocRole`, `DOCS_SECTIONS` |
| `frontend/src/app/features/docs/data/docs-sections.spec.ts` | Crear | Valida estructura del array de secciones |
| `frontend/src/app/features/docs/docs.component.ts` | Crear | Lógica: filtrado por rol, navegación prev/next |
| `frontend/src/app/features/docs/docs.component.html` | Crear | Template: sidebar + área de contenido |
| `frontend/src/app/features/docs/docs.component.scss` | Crear | Estilos del layout y contenido Markdown |
| `frontend/src/app/features/docs/docs.component.spec.ts` | Crear | Tests de filtrado y navegación |
| `frontend/src/app/features/docs/docs-routing.module.ts` | Crear | Ruta raíz `{ path: '', component: DocsComponent }` |
| `frontend/src/app/features/docs/docs.module.ts` | Crear | NgModule con CommonModule + MarkdownModule.forChild() |
| `frontend/src/app/app-routing.module.ts` | Modificar | Agregar ruta lazy `/docs` bajo el shell |
| `frontend/src/app/app.module.ts` | Modificar | Agregar `MarkdownModule.forRoot()` |
| `frontend/src/app/core/shell/shell.component.ts` | Modificar | Agregar `'docs'` al tipo NavItem + entrada en navItems |
| `frontend/src/app/core/shell/shell.component.html` | Modificar | Agregar SVG del ícono de libro para `item.icon === 'docs'` |

---

## Task 1: Instalar ngx-markdown y registrar MarkdownModule.forRoot()

**Files:**
- Modify: `frontend/src/app/app.module.ts`

**Interfaces:**
- Produces: `MarkdownModule` disponible globalmente para `forChild()` en módulos hijos

- [ ] **Step 1: Instalar ngx-markdown**

Desde `frontend/`:
```bash
npm install ngx-markdown
```
Versión esperada: `ngx-markdown@17.x` (sigue el versionado de Angular).

- [ ] **Step 2: Verificar que la instalación no rompió el build**

```bash
ng build --configuration=development
```
Esperado: sin errores de compilación.

- [ ] **Step 3: Agregar MarkdownModule.forRoot() a AppModule**

En `frontend/src/app/app.module.ts`, agregar el import:

```typescript
import { MarkdownModule } from 'ngx-markdown';
```

Y en el array `imports`:
```typescript
imports: [
  BrowserModule,
  HttpClientModule,
  AppRoutingModule,
  ShellModule,
  MarkdownModule.forRoot(),  // ← agregar
],
```

`HttpClientModule` ya está presente — lo necesita `ngx-markdown` para el binding `[src]`.

- [ ] **Step 4: Verificar build nuevamente**

```bash
ng build --configuration=development
```
Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/app/app.module.ts
git commit -m "feat(docs): instalar ngx-markdown y registrar MarkdownModule.forRoot en AppModule"
```

---

## Task 2: Crear archivos Markdown de contenido

**Files:**
- Create: `frontend/src/assets/docs/01-que-es-infraops.md`
- Create: `frontend/src/assets/docs/02-primer-acceso.md`
- Create: `frontend/src/assets/docs/03-vista-tareas.md`
- Create: `frontend/src/assets/docs/04-ejecutar-mantenimiento.md`
- Create: `frontend/src/assets/docs/05-estados-tarea.md`
- Create: `frontend/src/assets/docs/06-asignacion-tecnicos.md`
- Create: `frontend/src/assets/docs/07-coordinacion-visitas.md`
- Create: `frontend/src/assets/docs/08-gestion-usuarios.md`

**Interfaces:**
- Produces: archivos en `assets/docs/` que `DocsComponent` carga vía `[src]`

El contenido se extrae del manual existente en `docs/manual-usuario.md`. La carpeta `assets/docs/` ya está cubierta por la configuración estándar de Angular (`src/assets/**`), no requiere cambios en `angular.json`.

- [ ] **Step 1: Crear `01-que-es-infraops.md`**

```markdown
# ¿Qué es InfraOps?

InfraOps es el sistema interno de ONDRA para coordinar y registrar el trabajo técnico recurrente: mantenimientos de servidores, visitas a clientes, control de routers, QNAP, Veeam, antivirus y UPS.

Reemplaza las planillas Excel para hacer visible, trazable y medible el trabajo de cada técnico. Está integrado con Odoo (tickets y horas) e InfraDoc (inventario de infraestructura por cliente).

## Roles

| Rol | Quién | Qué puede hacer |
|---|---|---|
| **ADMIN** | Omar, Leandro | Acceso completo |
| **TL** | El Pana | Acceso completo + asignación de técnicos |
| **COORDINATOR** | Lau | Panel admin + gestión de tareas (solo lectura en tareas) |
| **TECHNICIAN** | Valen, Enzo, Tow, Santi, Gian | Vista propia de tareas + ejecución |
```

- [ ] **Step 2: Crear `02-primer-acceso.md`**

```markdown
# Primer acceso

## 1. Login

Ingresar con el email y contraseña provistos por el administrador en la pantalla `/login`.

## 2. Cambio de contraseña obligatorio

En el primer ingreso el sistema pide cambiar la contraseña. La nueva contraseña queda guardada y es la que se usa de ahí en adelante.

> **Nota:** Si olvidás la contraseña, contactá a un ADMIN para que la restablezca desde el Panel Admin → Usuarios.
```

- [ ] **Step 3: Crear `03-vista-tareas.md`**

```markdown
# Vista de Tareas

Accesible para todos los roles desde la barra lateral. Ruta: `/tasks`.

## Navegación por ciclo

La vista muestra las tareas de un **mes calendario** (ciclo). El mes activo por defecto es el mes actual.

Las flechas `[< Agosto 2026 >]` en la barra superior permiten navegar a meses anteriores o futuros. Los meses pasados se muestran en modo **solo lectura** con un banner indicador.

## KPIs

| Indicador | Qué muestra |
|---|---|
| **Asignadas** | Total de tareas en el ciclo |
| **En curso** | Tareas con estado EN CURSO |
| **Pendientes** | Tareas con estado PENDIENTE |
| **Completadas** | Tareas con estado HECHO |

A la derecha: barra de avance del ciclo y badge "Ciclo abierto / Ciclo cerrado".

## Filtros

- **Cliente:** select con todos los clientes activos
- **Tipo de tarea:** select (Servidores, Dominio Windows, QNAP, Veeam, Routers, etc.)
- **Estado:** select (Pendiente, En progreso, Hecho, Escalado, No realizado)
- **Técnico:** select con todos los técnicos activos

Los filtros se combinan. El botón **"Limpiar"** restablece todos.

## Tabla de tareas

Las tareas están **agrupadas por cliente**. Cada grupo muestra:
- Header: nombre del cliente · conteo · barra de progreso
- Filas: Tipo · Técnico · Estado · Ticket Odoo · Notas

Hacer clic en una fila abre el **drawer de detalle** desde la derecha.
```

- [ ] **Step 4: Crear `04-ejecutar-mantenimiento.md`**

```markdown
# Ejecutar un mantenimiento

## Flujo típico

1. Hacer clic en la fila de la tarea **PENDIENTE**
2. Presionar **"Iniciar"** → el estado pasa a EN CURSO y el ticket Odoo se marca en progreso
3. Completar el formulario de control según el tipo de tarea
4. Presionar **"Guardar progreso"** (opcional, para no perder lo avanzado)
5. Presionar **"Completar tarea"** → ingresar tiempo dedicado → confirmar
6. El estado pasa a HECHO, se cierra el ticket en Odoo y se registra el timesheet

## Si no se puede completar (solo ADMIN y TL)

- Presionar **"No realizado"** → ingresar motivo obligatorio en el diálogo
- Al confirmar: se imputan **0:00 hs en Odoo** con el motivo como descripción
- El ticket Odoo pasa al stage "No realizadas"
- El estado de la tarea queda como NO REALIZADO con el motivo registrado

## Tipos de formulario

| Tipo de tarea | Datos que se registran |
|---|---|
| **ESXi (Server Host)** | Estado del host, VMs, snapshots, alertas de datastore |
| **Dominio Windows** | Estado de replicación, servicios (NTDS, DNS, SYSVOL), espacio en disco |
| **QNAP** | Estado de discos y RAID, espacio disponible, volúmenes |
| **Veeam Backup** | Estado de jobs, VMs respaldadas, última fecha exitosa |
| **Router** | Conectividad, interfaces, versión de firmware |
```

- [ ] **Step 5: Crear `05-estados-tarea.md`**

```markdown
# Estados de tarea

## Estados posibles

| Estado | Significado |
|---|---|
| **PENDIENTE** | Tarea creada, aún no iniciada |
| **EN CURSO** | Técnico empezó el mantenimiento |
| **HECHO** | Mantenimiento completado y registrado |
| **ESCALADO** | Problema escalonado al técnico senior (en el mismo ticket Odoo) |
| **NO REALIZADO** | No se pudo concretar — requiere motivo registrado |

## Permisos por rol

| Acción | TECHNICIAN | TL | COORDINATOR | ADMIN |
|---|---|---|---|---|
| Ver todas las tareas | Sí (quitando filtro) | Sí | Sí | Sí |
| Filtro técnico por defecto | Propio | Todos | Todos | Todos |
| Ejecutar / completar tareas | Sí (propias) | Sí | No | Sí |
| Botón "Nueva tarea" | No | No | No | Sí |
| Marcar como "No realizado" | No | Sí | No | Sí |
| Ciclos cerrados | Solo lectura | Solo lectura | Solo lectura | Solo lectura |

> **COORDINATOR** accede en modo solo lectura: puede ver el estado de todas las tareas pero no puede ejecutar ni modificar ninguna.
```

- [ ] **Step 6: Crear `06-asignacion-tecnicos.md`**

```markdown
# Asignación de técnicos

> Esta sección aplica a roles **TL** y **ADMIN**.

## Reasignar una tarea

1. Abrir el drawer de la tarea (clic en la fila)
2. En el campo **Técnico asignado** seleccionar el nuevo técnico del select
3. Confirmar — el cambio es inmediato

## Gestión de perfiles de técnico (ADMIN)

Panel Admin → Técnicos.

Cada técnico tiene un perfil con sus datos de Odoo (employee ID, user ID) para poder asignarle tareas y registrar horas correctamente.

- **Ver lista:** técnicos activos con usuario asociado
- **Asignar técnico:** vincular un usuario existente con un perfil de técnico
```

- [ ] **Step 7: Crear `07-coordinacion-visitas.md`**

```markdown
# Coordinación de visitas

> Esta sección aplica a roles **TL**, **COORDINATOR** y **ADMIN**.

## Flujo de visita presencial

1. InfraOps genera la tarea de visita
2. TL asigna técnico
3. COORDINATOR coordina fecha y hora con el cliente
4. Se abre ticket en Odoo (SLA extendido) → estado **PENDIENTE**

## Si la visita no se concreta

- Sin horas disponibles o cancelada por el cliente:
  1. Cerrar ticket Odoo sin remito + registrar motivo
  2. Marcar tarea como **NO REALIZADO** con el motivo

## Si la visita se realiza

1. Técnico va al cliente y ejecuta el mantenimiento de terminales
2. Si hay problemas sin tiempo para resolver: abrir nuevo ticket HD remoto y registrar en el drawer
3. Cerrar ticket original con número de remito → estado **HECHO**
4. Post-cierre: actualizar métricas y generar reporte
```

- [ ] **Step 8: Crear `08-gestion-usuarios.md`**

```markdown
# Gestión de usuarios

> Esta sección aplica únicamente al rol **ADMIN**.

Acceso: Panel Admin → Usuarios.

## Ver usuarios

Lista de todos los usuarios activos con su rol asignado.

## Crear usuario

1. Presionar **"Nuevo usuario"**
2. Completar email y rol
3. El sistema genera una contraseña temporal — **se muestra una sola vez**, copiarla y enviarla al usuario
4. En el primer login el usuario deberá cambiarla

## Editar usuario

- Cambiar nombre, rol o estado activo
- No se puede cambiar el email una vez creado

## Desactivar usuario

Cambiar el campo **Activo** a `No`. El usuario deja de poder ingresar al sistema pero sus registros históricos se conservan.
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/assets/docs/
git commit -m "feat(docs): agregar archivos markdown de contenido del manual en assets/docs"
```

---

## Task 3: Crear config central docs-sections.ts + spec

**Files:**
- Create: `frontend/src/app/features/docs/data/docs-sections.ts`
- Create: `frontend/src/app/features/docs/data/docs-sections.spec.ts`

**Interfaces:**
- Produces:
  - `DocRole = 'ADMIN' | 'TL' | 'COORDINATOR' | 'TECHNICIAN' | '*'`
  - `DocSection { id, title, file, group, roles: DocRole[] }`
  - `DOCS_SECTIONS: DocSection[]` (8 entradas)

- [ ] **Step 1: Escribir el test fallando**

Crear `frontend/src/app/features/docs/data/docs-sections.spec.ts`:

```typescript
import { DOCS_SECTIONS, DocSection } from './docs-sections';

describe('DOCS_SECTIONS', () => {
  it('es un array no vacío', () => {
    expect(Array.isArray(DOCS_SECTIONS)).toBeTrue();
    expect(DOCS_SECTIONS.length).toBeGreaterThan(0);
  });

  it('cada sección tiene los campos requeridos', () => {
    DOCS_SECTIONS.forEach((s: DocSection) => {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.file).toBeTruthy();
      expect(s.group).toBeTruthy();
      expect(Array.isArray(s.roles)).toBeTrue();
      expect(s.roles.length).toBeGreaterThan(0);
    });
  });

  it('no hay ids duplicados', () => {
    const ids = DOCS_SECTIONS.map(s => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('los archivos siguen el patrón NN-nombre.md', () => {
    const pattern = /^\d{2}-.+\.md$/;
    DOCS_SECTIONS.forEach(s => {
      expect(pattern.test(s.file))
        .withContext(`archivo "${s.file}" no cumple el patrón`)
        .toBeTrue();
    });
  });

  it('los roles solo contienen valores válidos', () => {
    const valid = new Set(['ADMIN', 'TL', 'COORDINATOR', 'TECHNICIAN', '*']);
    DOCS_SECTIONS.forEach(s => {
      s.roles.forEach(r => {
        expect(valid.has(r))
          .withContext(`rol "${r}" en sección "${s.id}" no es válido`)
          .toBeTrue();
      });
    });
  });

  it('las secciones universales tienen roles ["*"]', () => {
    const universal = ['que-es', 'acceso', 'tareas', 'ejecucion', 'estados'];
    universal.forEach(id => {
      const section = DOCS_SECTIONS.find(s => s.id === id);
      expect(section).toBeTruthy(`sección "${id}" no encontrada`);
      expect(section!.roles).toContain('*');
    });
  });

  it('la sección gestión-usuarios solo es visible para ADMIN', () => {
    const section = DOCS_SECTIONS.find(s => s.id === 'usuarios');
    expect(section).toBeTruthy();
    expect(section!.roles).toEqual(['ADMIN']);
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
cd frontend && ng test --include="**/docs-sections.spec.ts" --watch=false
```
Esperado: error de compilación `Cannot find module './docs-sections'`.

- [ ] **Step 3: Crear `docs-sections.ts`**

```typescript
import { UserRole } from '../../../core/models/auth.models';

export type DocRole = UserRole | '*';

export interface DocSection {
  id: string;
  title: string;
  file: string;
  group: string;
  roles: DocRole[];
}

export const DOCS_SECTIONS: DocSection[] = [
  { id: 'que-es',     title: '¿Qué es InfraOps?',     file: '01-que-es-infraops.md',       group: 'General',        roles: ['*'] },
  { id: 'acceso',     title: 'Primer acceso',          file: '02-primer-acceso.md',          group: 'General',        roles: ['*'] },
  { id: 'tareas',     title: 'Vista de tareas',        file: '03-vista-tareas.md',           group: 'Tareas',         roles: ['*'] },
  { id: 'ejecucion',  title: 'Ejecutar mantenimiento', file: '04-ejecutar-mantenimiento.md', group: 'Tareas',         roles: ['*'] },
  { id: 'estados',    title: 'Estados de tarea',       file: '05-estados-tarea.md',          group: 'Tareas',         roles: ['*'] },
  { id: 'asignacion', title: 'Asignación de técnicos', file: '06-asignacion-tecnicos.md',   group: 'Coordinación',   roles: ['TL', 'ADMIN'] },
  { id: 'visitas',    title: 'Coordinación de visitas',file: '07-coordinacion-visitas.md',  group: 'Coordinación',   roles: ['TL', 'ADMIN', 'COORDINATOR'] },
  { id: 'usuarios',   title: 'Gestión de usuarios',    file: '08-gestion-usuarios.md',      group: 'Administración', roles: ['ADMIN'] },
];
```

- [ ] **Step 4: Ejecutar tests**

```bash
ng test --include="**/docs-sections.spec.ts" --watch=false
```
Esperado: 7 tests en verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/features/docs/
git commit -m "feat(docs): crear docs-sections con config central de secciones y spec"
```

---

## Task 4: Crear DocsModule + DocsRoutingModule + ruta lazy

**Files:**
- Create: `frontend/src/app/features/docs/docs-routing.module.ts`
- Create: `frontend/src/app/features/docs/docs.module.ts`
- Modify: `frontend/src/app/app-routing.module.ts`

**Interfaces:**
- Consumes: `DocsComponent` (se declara en el módulo — existe después del Task 5)
- Produces: ruta `/docs` lazy-loaded bajo el `ShellComponent`

> Nota: Angular requiere que `DocsComponent` exista antes de que `DocsModule` compile. Crear el componente vacío en este paso y completarlo en Task 5.

- [ ] **Step 1: Crear componente placeholder**

Crear `frontend/src/app/features/docs/docs.component.ts` con contenido mínimo para que el módulo compile:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-docs',
  template: '<p>docs works</p>',
})
export class DocsComponent {}
```

- [ ] **Step 2: Crear `docs-routing.module.ts`**

```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DocsComponent } from './docs.component';

const routes: Routes = [
  { path: '', component: DocsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DocsRoutingModule {}
```

- [ ] **Step 3: Crear `docs.module.ts`**

```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MatButtonModule } from '@angular/material/button';

import { DocsRoutingModule } from './docs-routing.module';
import { DocsComponent } from './docs.component';

@NgModule({
  declarations: [DocsComponent],
  imports: [
    CommonModule,
    DocsRoutingModule,
    MarkdownModule.forChild(),
    MatButtonModule,
  ],
})
export class DocsModule {}
```

- [ ] **Step 4: Registrar ruta lazy en `app-routing.module.ts`**

Dentro del array `children` del `ShellComponent`, agregar antes de `{ path: '', redirectTo: ... }`:

```typescript
{
  path: 'docs',
  loadChildren: () =>
    import('./features/docs/docs.module').then(m => m.DocsModule),
},
```

- [ ] **Step 5: Verificar build y navegación básica**

```bash
ng build --configuration=development
```
Esperado: sin errores. Navegar a `http://localhost:4200/docs` debe mostrar "docs works".

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/features/docs/ frontend/src/app/app-routing.module.ts
git commit -m "feat(docs): crear DocsModule con ruta lazy /docs bajo el shell"
```

---

## Task 5: Implementar DocsComponent — lógica + template + estilos

**Files:**
- Modify: `frontend/src/app/features/docs/docs.component.ts`
- Create: `frontend/src/app/features/docs/docs.component.html`
- Create: `frontend/src/app/features/docs/docs.component.scss`
- Create: `frontend/src/app/features/docs/docs.component.spec.ts`

**Interfaces:**
- Consumes:
  - `AuthService.getCurrentUser(): AuthUser | null` — rol del usuario logueado
  - `DOCS_SECTIONS: DocSection[]` — config de secciones
  - `DocSection { id, title, file, group, roles }` — tipo de sección
- Produces:
  - `DocsComponent.visibleSections: DocSection[]` — secciones filtradas por rol
  - `DocsComponent.activeSection: DocSection` — sección actualmente visible
  - `DocsComponent.selectSection(section: DocSection): void`
  - `DocsComponent.goPrev(): void`
  - `DocsComponent.goNext(): void`
  - `DocsComponent.hasPrev: boolean`
  - `DocsComponent.hasNext: boolean`
  - `DocsComponent.activeAssetPath: string` — e.g. `'assets/docs/03-vista-tareas.md'`
  - `DocsComponent.groupedSections(): { group: string; sections: DocSection[] }[]`

- [ ] **Step 1: Escribir los tests fallando**

Crear `frontend/src/app/features/docs/docs.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MatButtonModule } from '@angular/material/button';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { DocsComponent } from './docs.component';
import { AuthService } from '../../core/services/auth.service';
import { DOCS_SECTIONS } from './data/docs-sections';
import { UserRole } from '../../core/models/auth.models';

function buildAuthSpy(role: UserRole) {
  const spy = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
  spy.getCurrentUser.and.returnValue({ id: '1', email: 'test@ondra.com', role });
  return spy;
}

async function setup(role: UserRole): Promise<{ component: DocsComponent; fixture: ComponentFixture<DocsComponent> }> {
  await TestBed.configureTestingModule({
    declarations: [DocsComponent],
    imports: [
      CommonModule,
      NoopAnimationsModule,
      HttpClientTestingModule,
      MarkdownModule.forRoot(),
      MatButtonModule,
    ],
    providers: [{ provide: AuthService, useValue: buildAuthSpy(role) }],
  }).compileComponents();

  const fixture = TestBed.createComponent(DocsComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return { component, fixture };
}

describe('DocsComponent — filtrado por rol', () => {
  it('TECHNICIAN ve solo secciones universales', async () => {
    const { component } = await setup('TECHNICIAN');
    const ids = component.visibleSections.map(s => s.id);
    expect(ids).toContain('que-es');
    expect(ids).toContain('tareas');
    expect(ids).not.toContain('asignacion');
    expect(ids).not.toContain('visitas');
    expect(ids).not.toContain('usuarios');
  });

  it('ADMIN ve todas las secciones', async () => {
    const { component } = await setup('ADMIN');
    expect(component.visibleSections.length).toBe(DOCS_SECTIONS.length);
  });

  it('TL ve secciones propias pero no gestión de usuarios', async () => {
    const { component } = await setup('TL');
    const ids = component.visibleSections.map(s => s.id);
    expect(ids).toContain('asignacion');
    expect(ids).toContain('visitas');
    expect(ids).not.toContain('usuarios');
  });

  it('COORDINATOR ve visitas pero no asignacion ni usuarios', async () => {
    const { component } = await setup('COORDINATOR');
    const ids = component.visibleSections.map(s => s.id);
    expect(ids).toContain('visitas');
    expect(ids).not.toContain('asignacion');
    expect(ids).not.toContain('usuarios');
  });
});

describe('DocsComponent — navegación', () => {
  it('activeSection inicia en la primera sección visible', async () => {
    const { component } = await setup('TECHNICIAN');
    expect(component.activeSection.id).toBe(component.visibleSections[0].id);
  });

  it('goNext() avanza a la siguiente sección', async () => {
    const { component } = await setup('ADMIN');
    const second = component.visibleSections[1];
    component.goNext();
    expect(component.activeSection.id).toBe(second.id);
  });

  it('goPrev() vuelve a la sección anterior', async () => {
    const { component } = await setup('ADMIN');
    component.goNext();
    component.goPrev();
    expect(component.activeSection.id).toBe(component.visibleSections[0].id);
  });

  it('goPrev() en el primer elemento es no-op', async () => {
    const { component } = await setup('ADMIN');
    const first = component.visibleSections[0];
    component.goPrev();
    expect(component.activeSection.id).toBe(first.id);
  });

  it('goNext() en el último elemento es no-op', async () => {
    const { component } = await setup('TECHNICIAN');
    const last = component.visibleSections[component.visibleSections.length - 1];
    for (let i = 0; i < component.visibleSections.length + 2; i++) {
      component.goNext();
    }
    expect(component.activeSection.id).toBe(last.id);
  });

  it('hasPrev es false en la primera sección', async () => {
    const { component } = await setup('ADMIN');
    expect(component.hasPrev).toBeFalse();
  });

  it('hasNext es false en la última sección', async () => {
    const { component } = await setup('TECHNICIAN');
    const last = component.visibleSections[component.visibleSections.length - 1];
    component.selectSection(last);
    expect(component.hasNext).toBeFalse();
  });

  it('selectSection() cambia la sección activa', async () => {
    const { component } = await setup('ADMIN');
    const target = component.visibleSections[3];
    component.selectSection(target);
    expect(component.activeSection.id).toBe(target.id);
  });
});

describe('DocsComponent — activeAssetPath', () => {
  it('construye la ruta correcta para la sección activa', async () => {
    const { component } = await setup('ADMIN');
    expect(component.activeAssetPath).toBe('assets/docs/' + component.activeSection.file);
  });
});

describe('DocsComponent — groupedSections', () => {
  it('agrupa secciones por group sin duplicados', async () => {
    const { component } = await setup('ADMIN');
    const groups = component.groupedSections();
    const groupNames = groups.map(g => g.group);
    const unique = new Set(groupNames);
    expect(unique.size).toBe(groupNames.length);
  });

  it('cada sección aparece exactamente una vez', async () => {
    const { component } = await setup('ADMIN');
    const all = component.groupedSections().flatMap(g => g.sections);
    expect(all.length).toBe(component.visibleSections.length);
  });
});
```

- [ ] **Step 2: Ejecutar tests para verificar que fallan**

```bash
ng test --include="**/docs.component.spec.ts" --watch=false
```
Esperado: error de compilación (DocsComponent es un placeholder vacío).

- [ ] **Step 3: Implementar `docs.component.ts`**

```typescript
import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { DocSection, DOCS_SECTIONS } from './data/docs-sections';
import { UserRole } from '../../core/models/auth.models';

@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.scss',
})
export class DocsComponent implements OnInit {
  visibleSections: DocSection[] = [];
  activeSection!: DocSection;

  private currentUserRole: UserRole = 'TECHNICIAN';

  constructor(private readonly auth: AuthService) {}

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    this.currentUserRole = user?.role ?? 'TECHNICIAN';
    this.visibleSections = DOCS_SECTIONS.filter(s =>
      s.roles.includes('*') || s.roles.includes(this.currentUserRole),
    );
    this.activeSection = this.visibleSections[0];
  }

  get activeAssetPath(): string {
    return 'assets/docs/' + this.activeSection.file;
  }

  get activeIndex(): number {
    return this.visibleSections.indexOf(this.activeSection);
  }

  get hasPrev(): boolean {
    return this.activeIndex > 0;
  }

  get hasNext(): boolean {
    return this.activeIndex < this.visibleSections.length - 1;
  }

  get prevSection(): DocSection | null {
    return this.hasPrev ? this.visibleSections[this.activeIndex - 1] : null;
  }

  get nextSection(): DocSection | null {
    return this.hasNext ? this.visibleSections[this.activeIndex + 1] : null;
  }

  selectSection(section: DocSection): void {
    this.activeSection = section;
  }

  goPrev(): void {
    if (this.hasPrev) this.activeSection = this.visibleSections[this.activeIndex - 1];
  }

  goNext(): void {
    if (this.hasNext) this.activeSection = this.visibleSections[this.activeIndex + 1];
  }

  groupedSections(): { group: string; sections: DocSection[] }[] {
    const groups: { group: string; sections: DocSection[] }[] = [];
    for (const section of this.visibleSections) {
      const existing = groups.find(g => g.group === section.group);
      if (existing) {
        existing.sections.push(section);
      } else {
        groups.push({ group: section.group, sections: [section] });
      }
    }
    return groups;
  }
}
```

- [ ] **Step 4: Ejecutar tests — deben pasar**

```bash
ng test --include="**/docs.component.spec.ts" --watch=false
```
Esperado: todos los tests en verde.

- [ ] **Step 5: Crear `docs.component.html`**

```html
<div class="docs-layout">

  <!-- ── Sidebar ───────────────────────────────────────── -->
  <aside class="docs-sidebar">
    <div class="docs-sidebar__header">
      <span class="docs-sidebar__title">Documentación</span>
      <span class="docs-sidebar__sub">Manual de usuario</span>
    </div>

    <nav class="docs-nav">
      <ng-container *ngFor="let group of groupedSections()">
        <span class="docs-nav__group-label">{{ group.group }}</span>
        <a
          *ngFor="let section of group.sections"
          class="docs-nav__item"
          [class.docs-nav__item--active]="activeSection.id === section.id"
          (click)="selectSection(section)"
        >
          <span class="docs-nav__item-title">{{ section.title }}</span>
          <span
            *ngIf="!section.roles.includes('*')"
            class="docs-nav__role-badge"
          >
            {{ section.roles.includes('ADMIN') && section.roles.length === 1 ? 'ADM' : 'TL' }}
          </span>
        </a>
      </ng-container>
    </nav>
  </aside>

  <!-- ── Content ───────────────────────────────────────── -->
  <main class="docs-content">
    <div class="docs-content__body">
      <markdown [src]="activeAssetPath" />

      <div class="docs-footer-nav">
        <button
          mat-stroked-button
          class="docs-footer-nav__btn"
          [disabled]="!hasPrev"
          (click)="goPrev()"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <span *ngIf="prevSection">{{ prevSection.title }}</span>
        </button>

        <button
          mat-stroked-button
          class="docs-footer-nav__btn"
          [disabled]="!hasNext"
          (click)="goNext()"
        >
          <span *ngIf="nextSection">{{ nextSection.title }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  </main>

</div>
```

- [ ] **Step 6: Crear `docs.component.scss`**

```scss
// ── Layout ──────────────────────────────────────────────
.docs-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
}

// ── Sidebar ─────────────────────────────────────────────
.docs-sidebar {
  width: 232px;
  flex-shrink: 0;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-lo);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &__header {
    padding: 16px 16px 12px;
    border-bottom: 1px solid var(--border-lo);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--tx-lo);
  }

  &__sub {
    font-size: 12px;
    color: var(--tx-mid);
  }
}

.docs-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &__group-label {
    display: block;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--tx-lo);
    padding: 10px 8px 4px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    cursor: pointer;
    color: var(--tx-mid);
    font-size: 13px;
    text-decoration: none;
    transition: background 0.12s, color 0.12s;

    &:hover {
      background: var(--bg-hover);
      color: var(--tx-hi);
    }

    &--active {
      background: var(--accent-bg);
      color: var(--accent);
      font-weight: 500;
    }

    &-title {
      flex: 1;
      line-height: 1.3;
    }
  }

  &__role-badge {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.4px;
    padding: 2px 5px;
    border-radius: 4px;
    background: rgba(124, 106, 247, 0.15);
    color: #a898f8;
    flex-shrink: 0;
  }
}

// ── Content area ────────────────────────────────────────
.docs-content {
  flex: 1;
  overflow-y: auto;
  padding: 40px 56px;

  &__body {
    max-width: 800px;
  }
}

// ── Markdown content styles ──────────────────────────────
// Apunta a .docs-content para no contaminar el scope global
.docs-content {
  markdown {
    display: block;

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--tx-hi);
      margin-bottom: 8px;
      letter-spacing: -0.3px;
    }

    h2 {
      font-size: 15px;
      font-weight: 600;
      color: var(--tx-hi);
      margin: 28px 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-lo);
    }

    h3 {
      font-size: 13px;
      font-weight: 600;
      color: var(--tx-hi);
      margin: 18px 0 8px;
    }

    p {
      font-size: 13px;
      color: var(--tx-mid);
      line-height: 1.65;
      margin-bottom: 12px;
    }

    ul,
    ol {
      padding-left: 20px;
      color: var(--tx-mid);
      font-size: 13px;
      line-height: 1.7;
      margin-bottom: 12px;

      li {
        margin-bottom: 4px;
      }
    }

    code {
      font-family: var(--font-mono);
      font-size: 12px;
      background: var(--bg-raised);
      border: 1px solid var(--border-lo);
      border-radius: 4px;
      padding: 1px 5px;
      color: var(--accent);
    }

    blockquote {
      border-left: 3px solid var(--accent);
      background: var(--accent-bg);
      border-radius: 0 6px 6px 0;
      padding: 10px 14px;
      margin: 16px 0;
      color: var(--tx-mid);
      font-size: 13px;
      line-height: 1.55;

      p {
        margin: 0;
      }
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0 24px;
      font-size: 13px;

      th {
        text-align: left;
        padding: 8px 12px;
        background: var(--bg-raised);
        color: var(--tx-lo);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        border-bottom: 1px solid var(--border-lo);
      }

      td {
        padding: 9px 12px;
        color: var(--tx-mid);
        border-bottom: 1px solid var(--border-lo);
        vertical-align: top;

        &:first-child {
          color: var(--tx-hi);
          font-weight: 500;
        }
      }

      tr:hover td {
        background: var(--bg-hover);
      }
    }
  }
}

// ── Footer nav ───────────────────────────────────────────
.docs-footer-nav {
  display: flex;
  justify-content: space-between;
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--border-lo);

  &__btn {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--tx-mid);

    &:not([disabled]):hover {
      color: var(--accent);
      border-color: var(--accent);
    }
  }
}
```

- [ ] **Step 7: Ejecutar todos los tests del módulo**

```bash
ng test --include="**/docs/**/*.spec.ts" --watch=false
```
Esperado: todos en verde.

- [ ] **Step 8: Verificar en el browser**

```bash
ng serve
```
Navegar a `http://localhost:4200/docs`. Verificar:
- Sidebar muestra secciones agrupadas
- Clic en una sección carga el markdown correspondiente
- Botones Anterior / Siguiente funcionan
- Las secciones restringidas por rol (TL, ADMIN) no se ven si el usuario es TECHNICIAN

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/features/docs/
git commit -m "feat(docs): implementar DocsComponent con filtrado por rol y navegación prev/next"
```

---

## Task 6: Agregar entrada en la shell sidebar

**Files:**
- Modify: `frontend/src/app/core/shell/shell.component.ts`
- Modify: `frontend/src/app/core/shell/shell.component.html`

**Interfaces:**
- Consumes: `NavItem.icon` union type existente; router `/docs`

- [ ] **Step 1: Ampliar el tipo NavItem y agregar la entrada**

En `shell.component.ts`, cambiar la definición del tipo `NavItem`:

```typescript
// Antes:
icon: 'dashboard' | 'clients' | 'tasks' | 'notifications' | 'admin' | 'profile' | 'schedules';

// Después:
icon: 'dashboard' | 'clients' | 'tasks' | 'notifications' | 'admin' | 'profile' | 'schedules' | 'docs';
```

Y en el array `navItems`, agregar antes de la entrada de `profile`:

```typescript
{ route: '/docs', label: 'Documentación', icon: 'docs' },
```

El array completo queda:
```typescript
readonly navItems: NavItem[] = [
  { route: '/dashboard',     label: 'Dashboard',      icon: 'dashboard'     },
  { route: '/clients',       label: 'Clientes',       icon: 'clients'       },
  { route: '/tasks',         label: 'Mis tareas',     icon: 'tasks'         },
  { route: '/notifications', label: 'Vencimientos',   icon: 'notifications' },
  { route: '/admin',         label: 'Admin',          icon: 'admin'         },
  { route: '/schedules',     label: 'Schedules',      icon: 'schedules'     },
  { route: '/docs',          label: 'Documentación',  icon: 'docs'          },
  { route: '/profile',       label: 'Mi perfil',      icon: 'profile'       },
];
```

- [ ] **Step 2: Agregar el SVG del ícono en el template**

En `shell.component.html`, dentro del `*ngFor` de `navItems`, agregar después del bloque `*ngIf="item.icon === 'schedules'"`:

```html
<svg *ngIf="item.icon === 'docs'" viewBox="0 0 24 24"
     style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0">
  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
</svg>
```

- [ ] **Step 3: Verificar en el browser**

```bash
ng serve
```
Verificar:
- El ítem "Documentación" con el ícono de libro aparece en la sidebar del shell
- Al hacer clic navega a `/docs` y se activa visualmente (`class="active"`)
- La clase `.active` se aplica correctamente (usa `isActive('/docs')`)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/core/shell/shell.component.ts frontend/src/app/core/shell/shell.component.html
git commit -m "feat(docs): agregar entrada Documentación en la sidebar del shell"
```

---

## Self-review

**Cobertura de spec:**
- [x] Acceso para todos los roles → ruta sin guard, filtrado visual por rol
- [x] Secciones segmentadas por metadata de roles → `DocRole[]` en `DOCS_SECTIONS`
- [x] Contenido bundled en frontend → `assets/docs/*.md`
- [x] Renderizado con ngx-markdown → `MarkdownModule.forRoot/forChild`
- [x] Sidebar + contenido → layout implementado en Task 5
- [x] Estado local (no URL) → `activeSection` como propiedad del componente
- [x] Navegación prev/next → `goPrev()`, `goNext()`
- [x] Entrada en shell sidebar → Task 6
- [x] Tests: filtrado por rol → `docs.component.spec.ts`
- [x] Tests: navegación prev/next → `docs.component.spec.ts`
- [x] Tests: estructura de `DOCS_SECTIONS` → `docs-sections.spec.ts`

**Placeholders:** ninguno.

**Consistencia de tipos:** `DocSection`, `DocRole`, `UserRole` referenciados con los mismos nombres en todos los tasks.
