# Technicians Module — Diseño

**Fecha:** 2026-05-26  
**Estado:** Aprobado  
**Módulo:** `technicians`  
**Stack:** NestJS · TypeORM · PostgreSQL

---

## Contexto

El módulo `technicians` introduce el concepto de "técnico asignable" dentro de InfraOps. Un Technician es un perfil operativo vinculado a cualquier User del sistema. El módulo `tasks` (paso 4 del orden de desarrollo) lo usa como FK para asignación de tareas.

Los datos del técnico (nombre, email, rol, estado) viven en `User`. `Technician` es solo el vínculo que convierte a un User en recurso asignable dentro del dominio operativo.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Datos propios del Technician | Ninguno (solo el vínculo) | El perfil operativo actual no requiere campos extra. Extensible si el futuro lo exige. |
| FK direction | User tiene `technicianId → Technician.id` | Según CLAUDE.md; permite acceder al FK sin JOIN desde el User |
| Roles elegibles | Cualquier User | El admin puede asignar perfil técnico a cualquier usuario sin restricción de rol |
| Quién gestiona | Solo ADMIN | Operación administrativa, no auto-asignable |
| Listado | Todos los roles autenticados | Tasks y frontend necesitan el dropdown de técnicos para asignación |
| Filtro en listado | Sin filtro por `isActive` | El módulo `tasks` decide si filtra inactivos; el listado expone todo |
| Creación | Separada del User (endpoint propio) | POST /technicians con `{ userId }` — integrada conceptualmente con la gestión de usuarios |

---

## Entidad

### `Technician`

```typescript
@Entity('technicians')
export class Technician {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### Cambios en `User`

Se agregan dos campos en `user.entity.ts`:

```typescript
@Column({ name: 'technician_id', type: 'uuid', nullable: true, default: null })
technicianId: string | null;

@OneToOne(() => Technician)
@JoinColumn({ name: 'technician_id' })
technician: Technician | null;
```

El patrón columna FK + relación permite leer `technicianId` sin cargar la relación completa. En dev con `synchronize: true`, TypeORM agrega la columna automáticamente.

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/technicians` | JWT — todos los roles | Lista técnicos con datos del User asociado |
| `POST` | `/technicians` | JWT — ADMIN | Asigna perfil técnico a un User existente |
| `DELETE` | `/technicians/:id` | JWT — ADMIN | Remueve perfil técnico |

### GET /technicians

Retorna todos los Users con `technicianId IS NOT NULL`, con los datos del usuario incluidos.

```json
[
  {
    "id": "technician-uuid",
    "createdAt": "2026-05-26T12:00:00.000Z",
    "user": {
      "id": "user-uuid",
      "name": "Valen",
      "email": "valen@ondra.com.ar",
      "role": "TECHNICIAN",
      "isActive": true
    }
  }
]
```

### POST /technicians

Body: `{ "userId": "uuid" }`

Respuesta exitosa (201):
```json
{
  "ok": true,
  "data": {
    "id": "technician-uuid",
    "createdAt": "2026-05-26T12:00:00.000Z",
    "user": {
      "id": "user-uuid",
      "name": "Valen",
      "email": "valen@ondra.com.ar",
      "role": "TECHNICIAN",
      "isActive": true
    }
  }
}
```

Errores:
- `404 Not Found` — userId no existe
- `409 Conflict` — el User ya tiene perfil técnico

### DELETE /technicians/:id

Elimina el Technician y pone `user.technicianId = null`. Respuesta exitosa (200):
```json
{ "ok": true }
```

Error: `404 Not Found` si el id no existe.

---

## Lógica interna

### `findAll()`

```
1. Query User WHERE technician_id IS NOT NULL (con relación 'technician' cargada)
2. Retornar array de { technician, user (sin passwordHash ni lastLogoutAt) }
```

Implementación TypeORM:
```typescript
this.userRepository.find({
  where: { technicianId: Not(IsNull()) },
  relations: ['technician'],
})
```

### `assign(userId: string)`

```
1. Buscar User por userId → NotFoundException si no existe
2. Si user.technicianId != null → ConflictException ("Este usuario ya tiene perfil técnico")
3. INSERT en technicians → nuevo Technician
4. UPDATE users SET technician_id = technician.id WHERE id = userId
5. Retornar { technician, user }
```

### `remove(id: string)`

```
1. Buscar Technician por id → NotFoundException si no existe
2. UPDATE users SET technician_id = null WHERE technician_id = id
3. DELETE FROM technicians WHERE id = id
```

---

## Manejo de errores

| Caso | Excepción |
|------|-----------|
| userId no existe en POST | `NotFoundException` → 404 |
| User ya tiene perfil en POST | `ConflictException` → 409 |
| id no existe en DELETE | `NotFoundException` → 404 |

---

## Tests

### `technicians.service.spec.ts` — unitarios con mocks de repositorios

| Test | Verifica |
|------|---------|
| `findAll` | retorna lista de users con perfil técnico |
| `assign` — éxito | crea Technician, actualiza `user.technicianId` |
| `assign` — user no existe | lanza `NotFoundException` |
| `assign` — user ya tiene perfil | lanza `ConflictException` |
| `remove` — éxito | setea `technicianId = null` en User, elimina Technician |
| `remove` — id no existe | lanza `NotFoundException` |

### `technicians.controller.spec.ts` — unitarios con mock del service

| Test | Verifica |
|------|---------|
| `GET /technicians` | llama `findAll()`, retorna 200 |
| `POST /technicians` — éxito | llama `assign()`, retorna 201 |
| `POST /technicians` — 404 | propaga `NotFoundException` |
| `POST /technicians` — 409 | propaga `ConflictException` |
| `DELETE /technicians/:id` — éxito | llama `remove()`, retorna 200 |
| `DELETE /technicians/:id` — 404 | propaga `NotFoundException` |

---

## Estructura de archivos

```
backend/src/technicians/
├── technician.entity.ts
├── technicians.module.ts
├── technicians.service.ts
├── technicians.controller.ts
├── technicians.service.spec.ts
├── technicians.controller.spec.ts
└── dto/
    └── assign-technician.dto.ts        # { userId: string (UUID) }
```

**Archivos existentes que se modifican:**

| Archivo | Cambio |
|---------|--------|
| `backend/src/users/user.entity.ts` | Agregar `technicianId` (columna) y `technician` (relación OneToOne) |
| `backend/src/app.module.ts` | Importar `TechnicianModule` |

---

## Dependencia de módulos

```
AppModule → TechnicianModule → UsersModule (para inyectar UserRepository)
AppModule → UsersModule (ya existente, sin cambios)
```

`UsersModule` no importa `TechnicianModule` — sin dependencia circular.

`TechnicianModule` importa `UsersModule` para acceder al repositorio de `User` y poder actualizar `technicianId`.