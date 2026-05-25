# Clients Module — Diseño

**Fecha:** 2026-05-25
**Estado:** Aprobado
**Módulo:** `clients`
**Stack:** NestJS · TypeORM · PostgreSQL · @nestjs/schedule · @nestjs/axios

---

## Contexto

El módulo `clients` provee acceso a la lista de clientes de ONDRA dentro de InfraOps. Los clientes **no se gestionan en InfraOps** — altas, bajas y modificaciones ocurren en InfraDoc. InfraOps mantiene una tabla local sincronizada desde InfraDoc API que sirve como fuente para listados y como referencia FK para el módulo `tasks` (paso 4 del orden de desarrollo).

InfraDoc expone los clientes vía REST API. No soporta webhooks, por lo que la sincronización es pull-based: cron automático cada 4 horas más trigger manual disponible para todos los roles.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Fuente de datos | InfraDoc API (no DB directa) | Contrato estable; aislamiento ante actualizaciones de InfraDoc; seguridad (no exponer credenciales de DB) |
| Sync strategy | Cron cada 4h + trigger manual | Datos frescos en horario laboral sin intervención; botón para el caso puntual |
| Rate limit del trigger | 60s global (no por usuario) | El sync actualiza datos compartidos; syncs concurrentes no aportan valor |
| Rate limit scope | En memoria (no en DB) | Simple para 20 usuarios internos; se reinicia con el proceso sin impacto operativo |
| Acceso a lista | Todos los roles autenticados | Los técnicos necesitan ver clientes al asignar o filtrar tareas |
| Acceso al trigger | Todos los roles autenticados | Cualquiera puede necesitar refrescar datos; el rate limit evita abuso |
| Almacenamiento | Todos los campos de InfraDoc | Se muestran en el frontend; no hay razón para descartar ninguno |
| PK local | UUID (InfraOps) + `infradocId` int único | Consistencia con el resto del sistema; `infradocId` permite llamadas posteriores a InfraDoc |
| `isActive` | Derivado de `client_archived_at` de InfraDoc | InfraDoc no elimina clientes, los archiva |
| Detalle en tiempo real | Diferido al módulo `integrations/infradoc` | Fuera de scope de este módulo; el enrichment pertenece a la capa de integraciones |
| Nomenclatura externa | "InfraDoc" (no "ITFlow") | ITFlow es un detalle de implementación; la capa de negocio habla de InfraDoc |

---

## Entidad local

```typescript
@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  infradocId: number;                // client_id en InfraDoc

  @Column()
  name: string;                      // client_name

  @Column({ nullable: true })
  abbreviation: string | null;       // client_abbreviation (máx 6 chars)

  @Column({ nullable: true })
  type: string | null;               // client_type

  @Column({ nullable: true })
  website: string | null;            // client_website

  @Column({ nullable: true })
  referral: string | null;           // client_referral

  @Column({ type: 'numeric', nullable: true })
  rate: number | null;               // client_rate

  @Column({ nullable: true })
  currencyCode: string | null;       // client_currency_code

  @Column({ type: 'int', nullable: true })
  netTerms: number | null;           // client_net_terms

  @Column({ nullable: true })
  taxIdNumber: string | null;        // client_tax_id_number

  @Column({ default: false })
  isLead: boolean;                   // client_is_lead

  @Column({ type: 'text', nullable: true })
  notes: string | null;              // client_notes

  @Column({ default: true })
  isActive: boolean;                 // false si client_archived_at != null en InfraDoc

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

---

## Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/clients` | JWT — todos los roles | Lista clientes desde DB local, ordenados por `name ASC` |
| `POST` | `/clients/sync` | JWT — todos los roles | Fuerza sync con InfraDoc. Rate limit global 60s |

### GET /clients

- Devuelve todos los campos de la entidad **excepto** `infradocId` y `lastSyncedAt` (internos)
- Sin paginación (35 clientes activos, escala baja)
- Sin filtros en v1 (se agregan cuando `tasks` los necesite)

### POST /clients/sync

Respuesta exitosa:
```json
{
  "ok": true,
  "data": {
    "created": 2,
    "updated": 1,
    "archived": 0,
    "unchanged": 32,
    "syncedAt": "2026-05-25T14:03:00.000Z"
  }
}
```

Error por cooldown (429):
```json
{
  "ok": false,
  "error": "Sync ejecutado recientemente. Intentá de nuevo en unos segundos."
}
```

---

## Lógica de sync

```
syncWithInfradoc(skipCooldown = false):
  1. Si !skipCooldown y lastSyncAt != null y (now - lastSyncAt) < 60s:
       → lanzar TooManyRequestsException
  2. GET /api/v1/clients/read.php?limit=200 a InfraDoc
  3. Para cada cliente devuelto:
       a. Si infradocId no existe en DB → INSERT  → created++
       b. Si existe y algún campo cambió (name, abbreviation, type, website,
          referral, rate, currencyCode, netTerms, taxIdNumber, isLead, notes,
          isActive) → UPDATE → updated++
       c. Si existe y nada cambió        →          unchanged++
  4. Para cada cliente en DB local cuyo infradocId NO aparece en la respuesta:
       → UPDATE isActive = false          → archived++
  5. lastSyncAt = now()
  6. Retornar { created, updated, archived, unchanged, syncedAt: now() }
```

**Cron:** `@Cron('0 */4 * * *')` llama `syncWithInfradoc(skipCooldown = true)`.

**Rate limit en memoria:** `private lastSyncAt: Date | null = null` en `ClientsService`. Se reinicia al reiniciar el proceso — aceptable; un reinicio no es un evento de abuso.

---

## InfradocService

Vive en `clients/infradoc/infradoc.service.ts`. Responsabilidad única: hacer llamadas HTTP a InfraDoc API. Usa `@nestjs/axios`. Variables de entorno requeridas: `INFRADOC_URL`, `INFRADOC_API_KEY`.

Cuando se construya el módulo `integrations/infradoc` (paso 8 del orden de desarrollo), este service se extrae y mueve allí.

```typescript
@Injectable()
export class InfradocService {
  async getClients(): Promise<InfradocClient[]>
}
```

`InfradocClient` es una interfaz interna que mapea los campos de la respuesta de InfraDoc API.

---

## Estructura de archivos

```
backend/src/clients/
├── client.entity.ts
├── clients.module.ts
├── clients.service.ts
├── clients.controller.ts
├── clients.service.spec.ts
├── clients.controller.spec.ts
└── infradoc/
    └── infradoc.service.ts
```

---

## Tests

### clients.service.spec.ts — unitarios con mocks

| Test | Qué verifica |
|------|-------------|
| `syncWithInfradoc` — cliente nuevo en InfraDoc | INSERT, retorna `created: 1` |
| `syncWithInfradoc` — cliente con datos modificados | UPDATE, retorna `updated: 1` |
| `syncWithInfradoc` — cliente sin cambios | no toca DB, retorna `unchanged: 1` |
| `syncWithInfradoc` — cliente ausente en respuesta InfraDoc | `isActive = false`, retorna `archived: 1` |
| `syncWithInfradoc` — cooldown activo (< 60s) | lanza `TooManyRequestsException` |
| `syncWithInfradoc` — skipCooldown = true (cron) | ejecuta sin error aunque cooldown activo |
| `findAll` | retorna lista ordenada por nombre desde repositorio |

### clients.controller.spec.ts — unitarios con mock del service

| Test | Qué verifica |
|------|-------------|
| `GET /clients` | llama `clientsService.findAll()`, devuelve `200` con lista |
| `POST /clients/sync` — éxito | llama `clientsService.syncWithInfradoc()`, devuelve `200` con diff |
| `POST /clients/sync` — cooldown activo | propaga `TooManyRequestsException` → `429` |

---

## Variables de entorno nuevas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `INFRADOC_URL` | URL base de InfraDoc API | `https://infradoc.ondra.com.ar` |
| `INFRADOC_API_KEY` | API key de InfraDoc (scope: all clients) | — |

---

## Manejo de errores

| Caso | Excepción |
|------|-----------|
| Cooldown activo en sync manual | `TooManyRequestsException` → 429 |
| InfraDoc API no responde / error HTTP | `ServiceUnavailableException` → 503 |
| InfraDoc devuelve `success: "False"` | `ServiceUnavailableException` → 503 |

---

## Dependencias nuevas

- `@nestjs/schedule` — cron jobs
- `@nestjs/axios` — HTTP client para InfraDoc