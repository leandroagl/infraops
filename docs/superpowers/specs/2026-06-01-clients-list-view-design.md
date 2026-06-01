# Spec: Vista de lista de clientes

**Fecha:** 2026-06-01
**Estado:** Aprobado

---

## Contexto

InfraOps necesita una vista de Clientes accesible a todos los usuarios autenticados. La lista proviene de la base de datos local (sincronizada desde InfraDoc cada 4 horas). La dirección primaria no está almacenada actualmente: se agrega al proceso de sync.

---

## Objetivo

Implementar el menú **Clientes** en el sidebar izquierdo con una tabla Ag-Grid que muestre nombre y dirección primaria de cada cliente activo, con búsqueda reactiva. El nombre de cada cliente es clickeable y navega a `/clients/:id` (perfil de cliente — placeholder en esta iteración).

---

## Backend

### 1. Migración de base de datos
Agregar columna `primary_address VARCHAR(500) NULLABLE` a la tabla `clients`.

### 2. Entidad `Client`
Agregar campo:
```typescript
@Column({ type: 'varchar', length: 500, nullable: true })
primaryAddress: string | null;
```

### 3. `InfradocService` (bajo `clients/infradoc/`)
Agregar interfaz y método:
```typescript
export interface InfradocLocation {
  infradocClientId: number;
  address: string | null;
  city: string | null;
  isPrimary: boolean;
}

async getLocations(): Promise<InfradocLocation[]>
// GET /api/v1/locations/read.php con limit: 200
// Mapea: location_client_id, location_address, location_city, location_primary
```

### 4. `ClientsService.syncWithInfradoc()`
- Agregar `getLocations()` en el `Promise.all` junto a `getClients()` y `clientRepository.find()`
- Construir `Map<number, string>` (`infradocClientId → primaryAddress`) filtrando `isPrimary === true`
- Concatenar: `[address, city].filter(Boolean).join(', ')` o `null` si no hay primary location
- Incluir `primaryAddress` en las operaciones de `save()` y `update()` de cada cliente

### 5. `ClientResponse`
Sin cambios en la definición — el tipo ya excluye solo `infradocId` y `lastSyncedAt`, por lo que `primaryAddress` fluye automáticamente.

### 6. `GET /clients`
Sin cambios en el controller.

---

## Frontend

### 1. Modelo `Client`
```typescript
export interface Client {
  id: string;
  name: string;
  primaryAddress: string | null;
  isActive: boolean;
  createdAt: string;
}
```

### 2. App routing
Agregar en `app-routing.module.ts`:
```typescript
{
  path: 'clients',
  loadChildren: () =>
    import('./features/clients/clients.module').then(m => m.ClientsModule),
}
```

### 3. Estructura del módulo
```
frontend/src/app/features/clients/
├── clients.module.ts
├── clients-routing.module.ts
├── clients-list/
│   ├── clients-list.component.ts
│   ├── clients-list.component.html
│   └── clients-list.component.scss
└── client-detail/
    ├── client-detail.component.ts
    └── client-detail.component.html
```

### 4. `clients-routing.module.ts`
```
''    → ClientsListComponent
':id' → ClientDetailComponent
```

### 5. `ClientsListComponent`
- Carga clientes con `ClientsService.getAll()` en `ngOnInit`
- Filtra `isActive === true` en el cliente antes de pasar a Ag-Grid
- Columnas Ag-Grid:
  - **Nombre** (`name`): `cellRenderer` que renderiza como link, navega a `/clients/${id}` con `Router.navigate`
  - **Dirección primaria** (`primaryAddress`): texto plano, `"—"` si es null
- `quickFilterText` enlazado al `<input matInput>` de búsqueda superior
- Módulos Material requeridos: `MatFormFieldModule`, `MatInputModule`
- Módulo Ag-Grid: `AgGridModule`
- Tema Ag-Grid: `ag-theme-alpine-dark` con overrides del design system

### 6. `ClientDetailComponent`
Componente placeholder:
```html
<p class="tx-md">Vista de cliente — próximamente</p>
```

### 7. Shell — nav item
Agregar a `navItems` en `ShellComponent`:
```typescript
{ route: '/clients', label: 'Clientes', icon: 'clients' }
```
Agregar SVG inline correspondiente (ícono de edificio/empresa, 15×15px, stroke, outline).
Agregar tipo `'clients'` al union type de `NavItem.icon`.

---

## Fuera de scope

- Vista de perfil de cliente (`/clients/:id`) — solo se registra la ruta con placeholder
- Paginación server-side (el dataset de ~35 clientes cabe client-side sin problema)
- Columnas adicionales más allá de nombre y dirección
- Filtros por rol (todos los usuarios autenticados tienen acceso)

---

## Tests requeridos (TDD)

### Backend
- `InfradocService.getLocations()`: mapeo correcto de campos, manejo de `location_primary`
- `ClientsService.syncWithInfradoc()`: `primaryAddress` se guarda correctamente cuando hay primary location; queda `null` cuando no hay ninguna

### Frontend
- `ClientsListComponent`: renderiza tabla con datos mockeados, el input de búsqueda actualiza `quickFilterText`, el click en nombre navega a `/clients/:id`
