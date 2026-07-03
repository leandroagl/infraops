Implementar OdooModule en NestJS para InfraOps.

## Contexto del sistema

InfraOps es el sistema interno de ONDRA, un MSP argentino. Stack: NestJS + TypeORM + PostgreSQL. Los clientes se cachean desde InfraDoc (fuente de verdad, read-only). Los técnicos se crean directamente en InfraOps. Odoo es la ticketera de la empresa.

## Por qué existe este módulo

InfraOps necesita conocer los IDs de Odoo para clientes y técnicos con el fin de crear tickets automáticamente cuando se generan mantenimientos. La integración con Odoo es via JSON-RPC (Odoo no tiene REST puro). Este módulo es un servicio compartido que otros módulos de InfraOps consumen.

## Decisiones de arquitectura ya tomadas

- InfraOps NO depende de n8n para esta operación. La comunicación con Odoo es directa desde NestJS.
- El match de clientes se hace por CUIT (campo `vat` en Odoo, campo `tax_id` en la entidad Client de InfraOps).
- El match de técnicos se hace por email.
- Odoo devuelve `false` como booleano cuando un campo no tiene valor (no string vacío). Hay que manejar esto.
- El campo de identificación en Odoo es `l10n_latam_identification_type_id`, donde el ID 4 corresponde a CUIT.
- Solo interesan los `res.partner` donde `is_company = true` y `vat != false`.

## Cambios en entidades existentes

Agregar los siguientes campos opcionales:

En la entidad `Client`:
- `odoo_partner_id: number | null` — ID del partner en Odoo
- `odoo_synced_at: Date | null` — última vez que se sincronizó

En la entidad `Technician` (o `User`):
- `odoo_user_id: number | null` — ID del usuario en Odoo
- `odoo_synced_at: Date | null`

## Lo que debe implementar el OdooModule

### OdooService — métodos requeridos

1. `syncPartners(): Promise<SyncResult>`
   - Consulta Odoo: todos los `res.partner` con `is_company=true` y `vat != false`
   - Para cada partner: busca el cliente en InfraOps por `tax_id` (CUIT)
   - Si matchea: actualiza `odoo_partner_id` y `odoo_synced_at`
   - Si no matchea: lo registra como pendiente en el resultado
   - Retorna resumen: `{ matched: number, unmatched: string[], total: number }`

2. `syncUsers(): Promise<SyncResult>`
   - Consulta Odoo: todos los `res.users` activos
   - Para cada usuario: busca el técnico en InfraOps por email
   - Si matchea: actualiza `odoo_user_id` y `odoo_synced_at`
   - Si no matchea: lo registra como pendiente
   - Retorna el mismo formato de SyncResult

3. `resolvePartnerId(clientId: number): Promise<number | null>`
   - Devuelve el `odoo_partner_id` del cliente. Si no tiene, intenta el sync puntual por CUIT.

4. `resolveUserId(technicianId: number): Promise<number | null>`
   - Idem para técnicos por email.

### OdooController

- `POST /admin/odoo/sync/partners` — dispara `syncPartners()`, solo rol ADMIN
- `POST /admin/odoo/sync/users` — dispara `syncUsers()`, solo rol ADMIN
- `GET /admin/odoo/sync/status` — devuelve cuántos clientes y técnicos tienen `odoo_partner_id` / `odoo_user_id` nulos

### Configuración

Variables de entorno necesarias:
ODOO_URL=https://odoo.dominio.com
ODOO_DB=nombre_base
ODOO_USERNAME=usuario
ODOO_API_KEY=api_key

## Cómo es la autenticación con Odoo

Odoo usa JSON-RPC. El flujo es:
1. Autenticar: `POST /web/dataset/call_kw` con `res.users` `authenticate` para obtener `uid`
2. Usar `uid` + `api_key` en todas las llamadas subsiguientes

Usar `HttpModule` de NestJS (`@nestjs/axios`) para las llamadas HTTP.

## Restricciones

- TDD: cada método público del servicio debe tener sus tests unitarios con mocks de HttpService
- No hardcodear URLs ni credenciales, todo desde ConfigService
- Si Odoo no responde, el error debe ser descriptivo y no romper el flujo de InfraOps
- El módulo debe poder importarse desde otros módulos (TasksModule lo va a necesitar para crear tickets)
- Seguir las convenciones del proyecto: módulo NestJS estándar con barrel exports, DTOs tipados, sin any