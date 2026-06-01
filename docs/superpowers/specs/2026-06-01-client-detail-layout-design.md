# Spec: Client Detail Layout con Sidenav Contextual

**Fecha:** 2026-06-01  
**Estado:** Aprobado

---

## Contexto

Al hacer click en un cliente desde la lista (`/clients`), el usuario navega a la vista de detalle del cliente. El objetivo es construir el layout de esa vista con:

- El sidebar global reemplazado por navegación específica del cliente
- Título = nombre del cliente
- Dos secciones navegables: Overview y Mantenimientos
- URLs propias por sección

El patrón de referencia es InfraDoc: cuando se entra al detalle de un cliente, el sidebar izquierdo cambia completamente — muestra un botón "Back", el nombre del cliente, y los ítems de navegación de ese cliente.

---

## Comportamiento del Sidebar

El `ShellComponent` maneja el sidebar global (52px, solo íconos). Cuando el usuario está dentro de `/clients/:id`, el sidebar se expande (~180px) y reemplaza su contenido por:

```
← Back
──────────────────
[ícono] Overview
[ícono] Mantenimientos
```

Al salir (click en "Back" o navegar fuera de `/clients/:id`), el sidebar vuelve al modo global con los íconos de navegación principal.

---

## Arquitectura

### SidenavContextService (nuevo)

Servicio singleton (`providedIn: 'root'`) que actúa como puente entre el `ClientDetailComponent` y el `ShellComponent`.

```typescript
interface ClientSidenavContext {
  id: string;
  name: string;
}

// API del servicio:
setClient(client: ClientSidenavContext): void
clearClient(): void
client$: Observable<ClientSidenavContext | null>
```

### ShellComponent (modificado)

Suscribe a `SidenavContextService.client$`. Cuando el valor es `null`, renderiza el sidebar global actual. Cuando hay un cliente activo, renderiza el sidebar de cliente:

- Botón "← Back" que navega a `/clients`
- Separador visual
- Links de navegación: Overview (`/clients/:id/overview`), Mantenimientos (`/clients/:id/mantenimientos`)
- El ítem activo se detecta con `routerLinkActive`

El sidebar expande su ancho a ~180px en modo cliente.

### ClientDetailComponent (refactorizado)

- Lee el `:id` del `ActivatedRoute`
- Llama a `ClientsService.getById(id)` para obtener el cliente
- En `ngOnInit`: llama a `SidenavContextService.setClient({ id, name })`
- En `ngOnDestroy`: llama a `SidenavContextService.clearClient()`
- Tiene su propio `<router-outlet>` para renderizar los child components
- Redirige por defecto a `overview` si la URL es exactamente `/clients/:id`

### ClientsService (modificado)

Agregar método:
```typescript
getById(id: string): Observable<Client>
// GET /clients/:id
```

### Child Components (stubs)

- `ClientOverviewComponent` — placeholder con texto "Overview — próximamente"
- `ClientMantenimientosComponent` — placeholder con texto "Mantenimientos — próximamente"

Ambos se declaran en `ClientsModule`. El contenido real es trabajo futuro.

---

## Routing

```typescript
// clients-routing.module.ts
{
  path: ':id',
  component: ClientDetailComponent,
  children: [
    { path: '',               redirectTo: 'overview', pathMatch: 'full' },
    { path: 'overview',       component: ClientOverviewComponent },
    { path: 'mantenimientos', component: ClientMantenimientosComponent },
  ]
}
```

---

## Módulos y dependencias

`ClientsModule` debe importar `RouterModule` (para `routerLinkActive` en los stubs y el `<router-outlet>` del detail).

`ShellModule` ya tiene `RouterModule`; necesita importar `MatButtonModule` si se usa `mat-icon-button` para el Back.

---

## Testing

- `SidenavContextService`: unit test — set/clear/observable
- `ClientDetailComponent`: verificar que llama a `setClient` en init y `clearClient` en destroy; que redirige a `overview` si el path es exacto
- `ShellComponent`: verificar que muestra sidebar global cuando `client$` emite `null` y sidebar de cliente cuando emite un cliente
- Stubs: solo smoke test de renderizado

---

## Alcance explícito (fuera de scope)

- Contenido real de Overview (métricas, alertas, infraestructura de InfraDoc)
- Contenido real de Mantenimientos (historial de tareas)
- Manejo de error 404 cuando el cliente no existe
- Animación de transición del sidebar
