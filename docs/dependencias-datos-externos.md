# Dependencias de Datos Externos — InfraDoc y Odoo

Este documento describe qué campos de InfraDoc y Odoo deben estar correctamente poblados para que InfraOps funcione. Si un campo está vacío, nulo, o mal cargado, la tarea o alerta correspondiente **no se genera y no hay error visible** — simplemente se omite en silencio.

---

## 1. InfraDoc — Requisitos por tipo de asset

### 1.1 Servidor físico (ESXi / BMC)

Requerido para generar tareas de tipo `SERVER_HOST_MAINTENANCE`.

| Campo | Valor esperado | Consecuencia si falta o es incorrecto |
|---|---|---|
| `asset_type` | `'Server'` (exacto) | El host no se detecta, la tarea no se genera |
| `asset_uri` o `asset_uri_2` | URL del host ESXi | No se puede conectar al hipervisor |
| `interface_name` (BMC) | Debe contener `'ilo'`, `'idrac'` o `'xclarity'` (case-insensitive) | No se detecta la interfaz de gestión BMC |
| `interface_ip` (BMC) | IP del BMC | Se detecta el tipo de BMC pero la IP queda nula, el técnico no puede acceder |

**Nota:** `interface_name` e `interface_ip` corresponden a una interfaz de red del asset (no al asset en sí). Debe existir una interfaz cuyo nombre contenga exactamente una de esas cadenas.

---

### 1.2 Máquina virtual Windows

Requerido para generar tareas de tipo `WINDOWS_DOMAIN_MAINTENANCE`.

| Campo | Valor esperado | Consecuencia si falta o es incorrecto |
|---|---|---|
| `asset_type` | `'Virtual Machine'` (exacto) | La VM no se procesa |
| `asset_os` | Debe empezar con `'Windows Server'` (case-insensitive) | **La VM no se detecta.** Si el campo está vacío, en `null`, o contiene otro valor (por ej. el dato cargado en el campo Serial Number), la máquina no aparece en ningún grupo y la tarea nunca se genera |
| `asset_description` | Si contiene `'Domain Controller'` → se clasifica como DC; si no → como Windows VM genérica | Afecta la clasificación pero no bloquea la tarea |

> **Caso real documentado:** una VM tenía el sistema operativo escrito en el campo Serial Number en vez del campo Operating System (`asset_os`). InfraOps leía `asset_os = null` y descartaba la máquina silenciosamente. La tarea de Veeam Backup nunca se generaba para ese cliente.

---

### 1.3 NAS / QNAP

Requerido para generar tareas de tipo `QNAP_MAINTENANCE` y `VEEAM_BACKUP`.

| Campo | Valor esperado | Consecuencia si falta o es incorrecto |
|---|---|---|
| `asset_type` | `'NAS'` | Si no coincide, se evalúa `asset_make` como fallback |
| `asset_make` | `'QNAP'` (case-insensitive) | Si `asset_type` no es NAS y `asset_make` tampoco es QNAP, el dispositivo no se detecta |

**Regla de detección:** se agrega al grupo NAS si `asset_type = 'NAS'` **o** si `asset_make.toLowerCase() = 'qnap'`. Basta uno de los dos, pero al menos uno debe estar correcto.

**Caso frecuente de error:** asset con `asset_type = 'Storage'` y `asset_make` vacío → no se detecta como NAS.

---

### 1.4 Router / Firewall

Requerido para generar tareas de tipo `ROUTER_MAINTENANCE`.

| Campo | Valor esperado | Consecuencia si falta o es incorrecto |
|---|---|---|
| `asset_type` | Exactamente uno de: `'Firewall/Router'`, `'Router'`, `'Firewall'` | Si el valor tiene espacios distintos o es `'Network Device'` u otro texto, no se detecta |

**Nota:** la comparación es case-insensitive pero el formato de barra y texto debe coincidir. `'Firewall / Router'` (con espacios) **no coincide**.

---

### 1.5 Vencimientos (garantías, certificados, dominios, licencias)

InfraOps genera alertas y tickets en Odoo para cada ítem próximo a vencer. Si el campo de fecha de vencimiento está vacío, el ítem se omite silenciosamente — nunca dispara alerta.

| Tipo | Campos requeridos | Consecuencia si falta |
|---|---|---|
| Garantía de asset | `asset_id`, `asset_warranty_expire`, `asset_client_id` | No se monitorea la garantía |
| Certificado | `certificate_id`, `certificate_expire`, `certificate_client_id` | No se alerta el vencimiento |
| Dominio | `domain_id`, `domain_expire`, `domain_client_id` | No se alerta el vencimiento |
| Licencia de software | `software_id`, `software_expire`, `software_client_id` | No se alerta el vencimiento |

Adicionalmente, `asset_name`, `certificate_name`, `domain_name` y `software_name` deben estar poblados para que el ticket creado en Odoo tenga descripción útil.

---

## 2. InfraOps — Campos en la entidad Client

Para que un cliente pueda recibir tareas e integrarse con Odoo, los siguientes campos deben estar correctamente configurados en la entidad `Client` de InfraOps:

| Campo | Descripción | Consecuencia si falta |
|---|---|---|
| `infradocId` | ID del cliente en InfraDoc | No se pueden consultar sus assets; ninguna tarea de infraestructura se genera |
| `taxIdNumber` | CUIT en formato `30-XXXXXXXX-X` | No se puede hacer el match con `res.partner.vat` de Odoo; `odooPartnerId` nunca se resuelve |
| `odooPartnerId` | ID del partner en Odoo (se llena por sincronización) | No se pueden crear tickets en Odoo para este cliente |

`odooPartnerId` se rellena automáticamente cuando corre la sincronización `syncPartners()`. Si el cliente tiene `taxIdNumber` correcto y el partner en Odoo tiene el mismo CUIT en el campo `vat`, la sincronización resuelve el mapeo sola.

---

## 3. Odoo — Requisitos en partners (clientes)

| Campo | Valor esperado | Consecuencia si falta |
|---|---|---|
| `res.partner.is_company` | `true` | El partner se ignora en la sincronización |
| `res.partner.vat` | CUIT del cliente (no nulo) | El partner se descarta; `Client.odooPartnerId` nunca se resuelve |

El CUIT se normaliza al comparar (se eliminan guiones), por lo que `30-50438253-9` y `30504382539` son equivalentes. Sin embargo, si `vat` es `false` o `null` en Odoo, el cliente queda desvinculado.

---

## 4. Odoo — Requisitos en usuarios (técnicos)

La sincronización `syncUsers()` cruza `res.users.login` con `User.email`. Si no hay match exacto, el técnico queda sin IDs de Odoo y **no puede cerrar tareas**.

| Campo Odoo | Equivalente InfraOps | Consecuencia si no coincide |
|---|---|---|
| `res.users.login` | `User.email` | El usuario no se sincroniza; `odooUserId` y `odooEmployeeId` quedan nulos |
| `res.users.active` | — | Debe ser `true`; usuarios inactivos se ignoran |
| `hr.employee.user_id` | — | Debe estar vinculado al usuario; sin esto `odooEmployeeId` queda nulo |

**Consecuencia crítica:** si `User.odooEmployeeId` es nulo, el técnico **no puede marcar ninguna tarea como DONE ni NOT_DONE**. El sistema lanza error al intentar registrar el timesheet en Odoo.

---

## 5. Configuración interna de InfraOps (TaskTypeConfig)

Para cada tipo de tarea, el administrador debe configurar los tags de Odoo en `TaskTypeConfig`. Si esta configuración está vacía, la tarea no se puede crear aunque toda la infraestructura esté bien cargada.

| Config | Requerido | Consecuencia si falta |
|---|---|---|
| `odooTagIds` por TaskType | Al menos un tag | `BadRequestException`: no se puede crear la tarea |
| `helpdeskTeamId` | ID del equipo en Odoo | Tickets sin equipo asignado o error al crear |
| `stageInProgressName` | Nombre exacto del stage "en progreso" en Odoo | `ServiceUnavailableException` al abrir tarea |
| `stageDoneName` | Nombre exacto del stage "done" en Odoo | Error al cerrar tarea |
| `expirationsHelpdeskTeamId` | ID del equipo de alertas | Tickets de vencimiento no se crean (silencioso) |

---

## 6. Resumen de fallos silenciosos

Estos fallos **no arrojan error visible al usuario**. La tarea o alerta simplemente no aparece.

| Escenario | Qué pasa |
|---|---|
| VM con `asset_os` vacío o en campo incorrecto | No se clasifica; tarea `WINDOWS_DOMAIN_MAINTENANCE` o `VEEAM_BACKUP` no se genera |
| Servidor sin `asset_uri` | Se detecta como servidor pero no puede conectarse al ESXi |
| BMC con `interface_name` que no contiene 'ilo'/'idrac'/'xclarity' | No se detecta la interfaz de gestión |
| QNAP con `asset_type` y `asset_make` incorrectos | No se agrupa como NAS; tarea `QNAP_MAINTENANCE` / `VEEAM_BACKUP` no se genera |
| Router con `asset_type` con formato distinto | No se detecta; tarea `ROUTER_MAINTENANCE` no se genera |
| Asset sin fecha de vencimiento | No genera alerta ni ticket |
| Partner Odoo sin `vat` | No se mapea; cliente sin `odooPartnerId` |
| Técnico con email distinto en Odoo vs InfraOps | Sin `odooEmployeeId`; no puede cerrar tareas |

---

## 7. Checklist de auditoría periódica

Antes de cada generación mensual de tareas (`generateMonth`), verificar:

**En InfraDoc:**
- [ ] Servidores tienen `asset_uri` o `asset_uri_2` cargado
- [ ] Interfaces BMC tienen `interface_name` con 'iLO', 'iDRAC' o 'XClarity' e `interface_ip`
- [ ] VMs Windows tienen `asset_os` que empieza con `'Windows Server'` (campo Operating System, no Serial Number)
- [ ] NAS/QNAP tienen `asset_type = 'NAS'` o `asset_make = 'QNAP'`
- [ ] Routers tienen `asset_type` exactamente en `['Firewall/Router', 'Router', 'Firewall']`
- [ ] Assets con garantía tienen `asset_warranty_expire` cargado
- [ ] Dominios tienen `domain_expire` cargado
- [ ] Certificados tienen `certificate_expire` cargado
- [ ] Licencias tienen `software_expire` cargado

**En Odoo:**
- [ ] Partners de clientes tienen `vat` cargado e `is_company = true`
- [ ] Usuarios tienen `res.users.login` igual al email en InfraOps
- [ ] Usuarios están vinculados a un `hr.employee`

**En InfraOps:**
- [ ] Todos los clientes con infraestructura tienen `infradocId` y `taxIdNumber`
- [ ] Corrida reciente de `syncPartners()` → `odooPartnerId` poblado
- [ ] Corrida reciente de `syncUsers()` → `odooUserId` y `odooEmployeeId` poblados
- [ ] Todos los `TaskTypeConfig` tienen `odooTagIds` configurados
