# UniFi Network Alerts — Diseño

## Contexto

InfraOps integra UniFi Site Manager (`api.ui.com`) para centralizar las alertas de red de todos los clientes. ONDRA gestiona múltiples sites de UniFi (uno o más por cliente); hoy esas alertas solo se ven cliente por cliente en la consola de Ubiquiti. Este módulo las unifica en `/network` dentro de InfraOps.

**Alcance:**
- Visualización unificada de alertas activas de todos los sites habilitados
- Apertura manual de ticket Odoo desde una alerta
- Creación automática de tickets por cron para alertas de severidad crítica (configurable)
- Configuración de sites por cliente en Admin

**Fuera de alcance:** historial de alertas resueltas, métricas de uptime, topología de red.

---

## Arquitectura — Backend

### Módulos nuevos

```
backend/src/
├── integration-config/
│   ├── entities/unifi-config.entity.ts       ← API key cifrada (singleton id=1)
│   └── dto/unifi-integration-config.dto.ts
├── integrations/
│   └── unifi/
│       ├── unifi.module.ts
│       ├── unifi.service.ts                  ← llama a api.ui.com
│       └── dto/unifi-api.dto.ts              ← AlertItem, SiteInfo (DTOs tipados de la API)
└── unifi/
    ├── unifi.module.ts
    ├── unifi-sites.controller.ts             ← CRUD mapeo site→cliente
    ├── unifi-sites.service.ts
    ├── unifi-alerts.controller.ts            ← alertas activas + ticket manual
    ├── unifi-alerts.service.ts
    ├── unifi-auto-config.controller.ts       ← config auto-tickets
    ├── unifi-auto-config.service.ts
    ├── unifi-ticket.entity.ts                ← deduplicación (como expiration_tickets)
    ├── unifi-site-config.entity.ts           ← mapeo site→cliente
    └── dto/
        ├── unifi-alert.dto.ts
        ├── unifi-site-config.dto.ts
        └── unifi-auto-config.dto.ts
```

### Credenciales — `UnifiConfig` (integration-config)

Singleton (id=1), cifrado con AES-256-GCM igual que el resto de integraciones.

```typescript
@Entity('unifi_config')
export class UnifiConfig {
  @PrimaryColumn() id: number;           // siempre 1
  @Column({ nullable: true }) apiKey: string;  // cifrado
  @Column({ nullable: true }) updatedAt: Date;
  @Column({ nullable: true }) updatedBy: string;
}
```

Autenticación contra `api.ui.com`: header `Authorization: Bearer <apiKey>`.

### Mapeo site→cliente — `UnifiSiteConfig`

Un cliente puede tener 0, 1 o N sites.

```typescript
@Entity('unifi_site_configs')
export class UnifiSiteConfig {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() clientId: number;           // FK → clients
  @Column() siteId: string;             // ID del site en api.ui.com
  @Column() siteName: string;           // nombre editable en Admin
  @Column({ default: true }) enabled: boolean;
}
```

### Deduplicación — `UnifiTicket`

Previene abrir múltiples tickets Odoo para la misma alerta. Igual al patrón de `expiration_tickets`.

```typescript
@Entity('unifi_tickets')
export class UnifiTicket {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() alertId: string;            // ID de alerta en api.ui.com
  @Column() siteId: string;
  @Column() clientId: number;
  @Column() odooTicketId: number;
  @Column() createdAt: Date;
}
```

### API UniFi Site Manager

Base URL: `https://api.ui.com`

| Endpoint | Uso |
|---|---|
| `GET /ea/sites` | Listar todos los sites de la cuenta |
| `GET /ea/alerts?siteId=<id>&status=active` | Alertas activas de un site |

`UnifiService` encapsula estas llamadas, devuelve DTOs tipados. No hay caché: cada request al backend llama a `api.ui.com`.

### Endpoints InfraOps

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/integration-config/unifi` | ADMIN | API key (masked) |
| `PATCH` | `/integration-config/unifi` | ADMIN | Actualizar API key |
| `POST` | `/integration-config/unifi/test` | ADMIN | Test de conectividad |
| `GET` | `/unifi/sites` | ADMIN, TL | Listar sites configurados |
| `POST` | `/unifi/sites` | ADMIN | Agregar site→cliente |
| `PATCH` | `/unifi/sites/:id` | ADMIN | Editar (nombre, habilitado) |
| `DELETE` | `/unifi/sites/:id` | ADMIN | Eliminar mapeo |
| `GET` | `/unifi/alerts` | ADMIN, TL, COORDINATOR | Alertas activas (todos los sites) |
| `POST` | `/unifi/alerts/:alertId/ticket` | ADMIN, TL | Abrir ticket Odoo manualmente |
| `GET` | `/unifi/auto-config` | ADMIN | Config auto-tickets |
| `PATCH` | `/unifi/auto-config` | ADMIN | Actualizar config |

### Cron de auto-tickets

- Corre diariamente a las 8am (mismo horario que cron de vencimientos)
- Config en `OdooConfig` o tabla propia: `enabled`, `severities: string[]`, `helpdeskTeamId`, `tagIds`
- Flujo por cada site habilitado:
  1. Fetch alertas activas desde `api.ui.com`
  2. Filtrar por severidad ≥ umbral configurado
  3. Para cada alerta: buscar en `unifi_tickets` por `alertId`
  4. Si no existe → abrir ticket Odoo → insertar en `unifi_tickets`
  5. Si existe → skip
- Al activar por primera vez: solo alerta las que aparezcan a partir de ese momento, no las preexistentes (mismo comportamiento que vencimientos)

---

## Arquitectura — Frontend

### Vista `/network`

Entrada nueva en sidebar entre Backups y Admin.

**Estructura:**
```
KPI strip
  ALERTAS ACTIVAS | CRÍTICAS | CLIENTES AFECTADOS

Barra de filtros
  [Cliente ▼]  [Site ▼]  [Severidad ▼]  [Con ticket / Sin ticket]

Ag-Grid
  CLIENTE | SITE | SEVERIDAD | TIPO | MENSAJE | HACE | TICKET

Drawer de detalle (al hacer click en fila)
  - Cliente, Site, Severidad, Tipo
  - Mensaje completo
  - Timestamp
  - Ticket Odoo asociado (si existe) con link
  - Botón "Abrir ticket en Odoo" (solo si no tiene ticket)
```

**Chips de severidad:** colores del design system
- `critical` → `--crit`
- `high` → `--warn`
- `medium` / `low` → `--tx-lo`

### Admin — configuración

**Integraciones tab → "UniFi":** API key + botón Test (igual que JetBackup, Acronis).

**Nueva tab "Red"** en Admin (al nivel de "Backups"):

Sub-sección **Sites por cliente:**
- `mat-table` con columnas: Cliente | Site ID | Nombre | Habilitado | Acciones
- Botón "Agregar site": abre diálogo con selector de cliente + campo Site ID + nombre

Sub-sección **Auto-tickets:**
- Toggle habilitado/deshabilitado
- Multi-select de severidades que disparan ticket (`critical`, `high`)
- Selector equipo Odoo
- Multi-select tags Odoo

### Módulo Angular

`NetworkModule` en `frontend/src/app/network/`:
```
network/
├── network.module.ts
├── network-routing.module.ts
├── network.component.ts          ← vista principal /network
├── network-alert-drawer.component.ts
└── services/
    └── network.service.ts
```

---

## Decisiones de diseño

1. **Sin caché de alertas en DB** — alineado con el principio del proyecto (InfraDoc, VMware). Datos de infraestructura externa se leen en tiempo real.
2. **`UnifiTicket` como excepción acotada** — igual que `expiration_tickets`: no guarda inventario ni alertas, solo registra qué ticket de Odoo ya se creó para cada alertId.
3. **Un API key global** — UniFi Site Manager es una cuenta de ONDRA que tiene acceso a todos los sites de clientes. No hay credenciales por cliente.
4. **Sites en DB** — el mapeo site→cliente sí se persiste (es config operativa de InfraOps, no datos de infraestructura del cliente).
5. **Ag-Grid para la tabla principal** — vista con potencial de >20 filas, filtros y severidad con renderer custom.

---

## Orden de implementación

1. Backend: `UnifiConfig` entity + `integration-config` endpoints + test
2. Backend: `UnifiSiteConfig` entity + CRUD endpoints
3. Backend: `UnifiService` (llamadas a `api.ui.com`)
4. Backend: `UnifiAlertsService` + endpoint `GET /unifi/alerts`
5. Backend: endpoint `POST /unifi/alerts/:alertId/ticket`
6. Backend: `UnifiTicket` entity + cron auto-tickets + config endpoints
7. Frontend: Admin tab "Red" (sites config + auto-config)
8. Frontend: Admin Integraciones tab "UniFi" (API key)
9. Frontend: `/network` vista principal + drawer
