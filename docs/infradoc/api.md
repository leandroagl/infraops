# API de InfraDoc (ITFlow 26.11)

Referencia de la API REST de ITFlow tal como la usa InfraOps. InfraOps solo usa el módulo
**Documentation** de ITFlow (assets, networks, domains, certificates, licencias, documents, etc.),
**y solo en modo lectura**.

- Doc oficial: https://docs.itflow.org/ (la versión vigente dice "ITFlow 26.11")
- Última validación contra una instancia real: **2026-11-16**, ITFlow 26.11, solo GET.
- Reescrito el 2026-11-16: la versión anterior era una copia de la doc previa a 26.08 y estaba desactualizada.

---

## 1. Autenticación y permisos (cambió en 26.08)

- Base: `https://<host>/api/v1/{módulo}/{función}.php`
- GET: `?api_key=KEY` en la query. POST: `api_key` en el body JSON (`Content-Type: application/json`).
- **Las keys pertenecen a un agente** (usuario de ITFlow) y heredan su rol, módulos y clientes visibles.
  Ya no existe el scope "All Clients" con `client_id = 0`. Se crean en **Admin > API Keys**
  (nombre, vencimiento, agente) y se muestran una sola vez.
- La actualización a 26.08 **borró todas las keys anteriores**.
- Los endpoints de este documento exigen el área **Support** del rol del agente. Credentials exige el
  área **Credentials** (aparte).
- Si el agente solo ve algunos clientes, la API devuelve solo esos, **sin dar error**.
- Los errores de permisos (26.11) nombran el nivel requerido y el que tiene la key.
- `api_key_decrypt_password` (solo credentials) va en el **body**, nunca en la query (cambio de 26.08).

### Configuración recomendada para InfraOps

- Un agente dedicado a InfraOps (así se puede deshabilitar sin afectar otras integraciones y queda
  trazable en el audit log).
- Rol con **Support en lectura**, acceso a **todos los clientes**.
- **Sin Credentials.** InfraOps no usa ese módulo. Como la key puede escribir según el rol, mantenerla
  de solo lectura.

## 2. Formato de respuesta

```json
{ "success": "True", "count": 1, "data": [ { "...": "..." } ] }
```

- `success` es el **string** `"True"` / `"False"`, no un booleano.
- Los valores numéricos llegan como string (`"asset_id": "1"`).
- Crear devuelve `data: [{ "insert_id": 123 }]`.
- Sin resultados puede venir sin `data` ni `count` y con `message`. Tratar ausencia como lista vacía.

## 3. Paginación

- `limit` y `offset` (verificado en vivo en `clients` y `assets`).
- **Sin `limit` devuelve 50 filas.** Si se supera el límite pedido, se trunca sin avisar.
- Nuestros valores: clients/locations `limit: 200` (hoy 55 clientes y 89 locations), assets `limit: 500`
  (máximo actual 66 assets por cliente).

## 4. Registros archivados — regla crítica para InfraOps

Un registro archivado equivale a eliminado y **nunca** debe aparecer en vistas ni en detección de tareas.

| Módulo | ¿La lectura devuelve archivados? | Qué hace InfraOps |
|---|---|---|
| clients | **Sí** (`client_archived_at`) | Filtra (`isActive`) |
| assets | **Sí** (`asset_archived_at`) | Filtra en `InfradocAssetsService` |
| certificates | **Sí** (`certificate_archived_at`) | Filtra |
| credentials | Sí (no los usamos) | — |
| networks, domains, locations, documents, software | **No** desde 26.10, ni siquiera por ID | El filtro es redundante pero inocuo |
| services | No por defecto; `archived=1` los incluye | — |

- Desde 26.10 la API no permite listar archivados. Para desarchivar hay que conocer el ID.
- Verificado 2026-11-16: 7 de 55 clientes, 17 assets y 5 certificados vienen archivados.

## 5. Módulos

Todos los `read.php` aceptan `client_id` (filtra a ese cliente, solo reduce lo que la key ya ve), `limit` y
`offset`. Los POST de escritura se limitan por el `client_id` enviado.

### Assets `/assets/`

| Endpoint | Hace |
|---|---|
| `GET read.php` | Lista o busca |
| `POST create.php` | Crea (`client_id`, `asset_name` obligatorios) |
| `POST update.php` | Modifica (`asset_id` + `client_id` obligatorios) |
| `POST delete.php` | Elimina (`asset_id` + `client_id`; requiere Full en Support; borra sus interfaces y lo saca del rack) |

Filtros de lectura: `asset_id`, `asset_type`, `asset_name`, `asset_serial`, `asset_mac` (MAC de la interfaz
primaria), `asset_uri`, `asset_uri_2`.

- La lista y `asset_mac` incluyen la **interfaz primaria** aplanada (`interface_ip`, `interface_mac`,
  `interface_network_id`, etc.). **Una fila por asset**, sin duplicados (verificado: 868 filas, 868 IDs).
  Los otros filtros devuelven el asset sin interfaz.
- Campos: `asset_id`, `asset_type`, `asset_name`, `asset_description`, `asset_make`, `asset_model`,
  `asset_serial`, `asset_os`, `asset_uri`, `asset_uri_2`, `asset_uri_client`, `asset_status`,
  `asset_purchase_reference`, `asset_purchase_date`, `asset_warranty_expire`, `asset_install_date`,
  `asset_photo`, `asset_physical_location`, `asset_notes`, `asset_favorite`, `asset_vendor_id`,
  `asset_location_id`, `asset_contact_id`, `asset_client_id`, `asset_product_id`, `asset_invoice_id`,
  `asset_invoice_item_id`, `asset_created_at`, `asset_updated_at`, `asset_archived_at`,
  `asset_accessed_at`, `tags`, `asset_specs` y los `interface_*`.
- **Tipos válidos al crear:** Laptop, Desktop, Server, NAS, Virtual Machine, Firewall/Router, Switch,
  Access Point, Modem/ONT, UPS, PDU, Printer, Phone, Mobile Phone, Tablet, Display, Camera, NVR/DVR, Other.
  En la instancia hay tipos legados que no están en esa lista (por ejemplo "Otro").

#### `asset_specs` (nuevo)

Objeto con detalles propios de cada tipo (`{}` si no tiene). Claves por tipo:

| Tipo | Claves |
|---|---|
| Laptop, Desktop, Server | `cpu`, `ram_gb`, `storage` |
| Virtual Machine | `vm_host` (id o nombre de un server/NAS del cliente), `vcpus`, `ram_gb`, `storage` |
| NAS | `drive_bays`, `drives`, `raw_tb`, `usable_tb`, `raid`, `ports` |
| Firewall/Router | `ports`, `sfp_ports` |
| Switch | `ports`, `sfp_ports`, `poe_watts`, `managed` |
| Access Point | `wifi` |
| Modem/ONT | `circuit_id`, `isp_account`, `ports` |
| UPS | `va`, `watts`, `runtime_min`, `outlets`, `battery_installed`, `battery_replace` (fechas YYYY-MM-DD) |
| PDU | `pdu_type`, `outlets`, `power_input` |
| Printer | `color`, `supplies` |
| Phone | `extension` |
| Mobile Phone, Tablet | `phone_number`, `carrier`, `imei` |
| Display | `size_in`, `resolution` |
| Camera | `resolution` |
| NVR/DVR | `channels`, `storage`, `ports` |

Verificado 2026-11-16: **casi vacío en la práctica** (1 de 868 assets tiene specs, un Server con
`ram_gb`). No tomar decisiones de producto sobre `asset_specs` hasta que se cargue en ITFlow.
En la instancia tampoco hay assets de tipo NAS, UPS ni PDU: se registran como Server u Other.

### Networks `/networks/`

`GET read.php` (filtros `network_id`, `network_name`), `POST create.php`, `update.php`, `archive.php`,
`unarchive.php`. No hay delete. Solo se pueden modificar redes activas.
Create: `client_id`, `network_name` y `network` (por ejemplo `192.168.30.0/24`) obligatorios.
Campos de lectura: `network_id`, `network_name`, `network`, `network_vlan`, `network_gateway`,
`network_primary_dns`, `network_secondary_dns`, `network_dhcp_range`, `network_subnet`, `network_type`,
`network_location_id`, `network_vendor_id`, `network_client_id`, `tags`, fechas.

### Licencias (se llaman `software` en la API) `/software/`

`GET read.php` (filtro `software_id`), `POST archive.php`, `unarchive.php` (`software_id` + `client_id`).
No hay create ni update. Los archivados no se devuelven. Archivar por API solo setea
`software_archived_at`; **no** elimina los vínculos con assets y contactos (la web sí).
Campos: `software_id`, `software_name`, `software_description`, `software_version`, `software_type`,
`software_license_type`, `software_key`, `software_seats`, `software_purchase_reference`,
`software_purchase`, `software_expire`, `software_notes`, `software_vendor_id`, `software_client_id`,
`software_template_id`, `tags`, fechas.

- Verificado: 55 filas de 30 clientes. `software_type` son 19 Security Software, 10 SaaS, 9 Other,
  8 System Software, 4 Desktop Application, 2 Web Application, 2 Operating System y 1 con el valor
  "Aplicación de escritorio". `software_license_type` son 22 User, 19 Device y 14 vacío. No asumir valores
  fijos (la doc oficial muestra "Subscription", que acá no existe).
- 37 de 55 tienen `software_expire`. `software_template_id` es 0 en todas.
- **`software_key` llega en texto plano.** InfraOps no debe mapearla, guardarla ni loguear respuestas
  crudas de este endpoint.

### Domains `/domains/`

`GET read.php` (`domain_id`, `domain_name`), `POST create.php`, `update.php`, `archive.php`,
`unarchive.php`. No hay delete. Los archivados no se devuelven.
Crear o actualizar hace **consultas DNS y WHOIS en vivo**: completa IP, name servers, MX, TXT, DMARC, DKIM
y reemplaza `domain_expire` con el de WHOIS si lo encuentra.
Campos: `domain_id`, `domain_name`, `domain_description`, `domain_expire`, `domain_auto_renew`,
`domain_ip`, `domain_name_servers`, `domain_mail_servers`, `domain_txt`, `domain_dmarc`, `domain_dkim`,
`domain_raw_whois`, `domain_notes`, `domain_registrar`, `domain_webhost`, `domain_dnshost`,
`domain_mailhost` (ids de vendor), `domain_client_id`, `domain_refreshed_at`, `tags`, fechas.
Verificado: `domain_auto_renew` es `0` en los 163 dominios, así que hoy no aporta información.

### Certificates `/certificates/`

`GET read.php` (`certificate_id`, `certificate_name`), `POST create.php`. No hay update ni delete.
Crear con un host hace que ITFlow se conecte y registre lo que sirve; con `certificate_public_key` (PEM)
toma emisor, fechas, nombres y huella del PEM.
Campos: `certificate_id`, `certificate_name`, `certificate_description`, `certificate_domain`,
`certificate_names`, `certificate_issued_by`, `certificate_issued_at`, `certificate_expire`,
`certificate_public_key`, `certificate_fingerprint`, `certificate_check_status`, `certificate_checked_at`,
`certificate_domain_id`, `certificate_client_id`, fechas. (No devuelve `tags`.)
`certificate_check_status` (nuevo) tomó estos valores: `ok` 72, `untrusted` 7, `unreachable` 7,
`mismatch` 1 y null 5.

### Services `/services/` (nuevo, no integrado en InfraOps)

Solo `GET read.php`. Filtros: `service_id` (incluye archivados), `service_name`, `review_due=1`
(revisión vence en los próximos 30 días o ya venció, ordenado por fecha), `archived=1` (incluye archivados).
Campos: `service_id`, `service_name`, `service_description`, `service_category`, `service_importance`,
`service_backup`, `service_notes`, `service_review_due`, `service_reviewed_at`, `service_review_interval`,
`service_client_id`, `tags`, fechas.
Verificado: 15 servicios de 10 clientes (importancia High 7, Low 6, Medium 2). Ninguno tiene
`service_review_due` cargado y `review_due=1` devuelve vacío.

### Documents `/documents/`

`GET read.php` (`document_id`), `POST create.php`, `update.php` (conserva la versión anterior),
`archive.php`, `unarchive.php`. Los archivados no se devuelven. `document_content` es HTML y las imágenes
`data:` se guardan como archivos.
Campos: `document_id`, `document_name`, `document_description`, `document_content`,
`document_content_raw`, `document_client_visible`, `document_folder_id`, `document_template_id`,
`document_created_by`, `document_updated_by`, `document_reviewed_by`, `document_reviewed_at`,
`document_client_id`, `tags`, fechas.

### Locations `/locations/`

`GET read.php` (`location_id`), `POST create.php`, `update.php`, `archive.php`, `unarchive.php`, `delete.php`.
**Una location debe estar archivada antes de poder eliminarla.** Los archivados no se devuelven.

### Vendors `/vendors/`

`GET read.php` (`vendor_id`), `POST create.php`, `update.php`, `archive.php`, `unarchive.php`.
Los archivados no se devuelven.

### Clients `/clients/`

`GET read.php` (`client_name`), `POST create.php`, `update.php`, `archive.php`, `unarchive.php`,
`delete.php` (desde 26.09). Archivar un cliente detiene sus facturas recurrentes.

**Cambios de 26.11 que afectan a InfraOps:**
- `client_rate` y `client_net_terms` **ya no existen**: tarifas, plazos y SLA pasan a contratos.
  `clients/read` no los devuelve y `clients/update` no los modifica.
- `client_is_lead` → `client_lead`.
- Campos nuevos: `tags`, `client_reminders`, `client_portal_signup`, `client_default_tax_id`,
  `client_tax_exempt*`, `client_card_fee_exempt`, `client_favorite`, `client_updated_at`,
  `client_accessed_at`.
- Siguen: `client_id`, `client_name`, `client_type`, `client_website`, `client_referral`,
  `client_currency_code`, `client_tax_id_number`, `client_abbreviation`, `client_notes`,
  `client_created_at`, `client_archived_at`.

### Credentials `/credentials/`

Fuera del alcance de InfraOps. Requiere el área Credentials y `api_key_decrypt_password` en el body,
incluso para leer. No habilitar este permiso en la key de InfraOps.

### Otros módulos (no usados por InfraOps)

contacts, tickets (create, resolve, close, replies), invoices, invoice_items, payments, products, quotes,
expenses: ver la doc oficial.

## 6. Qué consume InfraOps

| Dato | Endpoint | Código |
|---|---|---|
| Clientes | `clients/read.php` | `backend/src/clients/infradoc/infradoc.service.ts` |
| Locations | `locations/read.php` | `backend/src/clients/infradoc/infradoc.service.ts` |
| Assets e interfaces | `assets/read.php` | `backend/src/integrations/infradoc/infradoc-assets.service.ts` |
| Vencimientos (licencias, dominios, certificados, garantías) | `software`, `domains`, `certificates`, `assets` | `NotificationsService.getExpirations` |

## 7. Pendientes conocidos

- `client_rate` y `client_net_terms` ya no llegan: el mapeo `rate: raw.client_rate ? ... : null` de
  `infradoc.service.ts` deja `rate` en `null` para todos los clientes.
- `docs/superpowers/specs/2026-05-25-clients-design.md` y los planes de clients todavía mencionan
  `client_rate`.
- **`client_id=0` ya no significa "todos los clientes".** Con las keys nuevas, `read.php?client_id=0`
  devuelve HTTP 200 con `success:"False"` y "No resource...". Verificado 2026-11-16 en assets, certificates,
  domains y software. Para listar todo hay que omitir `client_id`, como hace `NotificationsService`
  (con `limit: 9999`).
- `IntegrationConfigService.testInfraDoc()` usa justamente `client_id: 0` y solo mira el código HTTP:
  con una key válida da "Conexión exitosa" aunque la respuesta sea `success:"False"`, y con una key
  inválida falla bien (401). Funciona hoy, pero no valida la respuesta. Conviene quitar `client_id: 0` y
  comprobar `success === 'True'`.

## 8. Errores comunes

| Mensaje / código | Causa |
|---|---|
| 401, "Authentication failed. API key is invalid or has expired." | Key inválida, vencida, o borrada por la actualización a 26.08 |
| "No resource (for this client and company) with the specified parameter(s)." | No existe o la key no tiene acceso |
| 404 con HTML de Apache | Ruta inexistente (por ejemplo `/licenses/`: se llama `/software/`) |
| 405 | Solo GET y POST |

Ante problemas, revisar los logs de Apache/PHP del servidor de InfraDoc y el log de la app de ITFlow
(desde 26.09 las consultas fallidas de la API se registran ahí).
