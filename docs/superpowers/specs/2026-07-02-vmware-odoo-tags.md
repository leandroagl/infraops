---
title: Tags Odoo para tareas VMware (SERVER_HOST_MAINTENANCE)
date: 2026-07-02
status: approved
---

## Objetivo

Al crear el ticket Odoo para tareas de tipo `SERVER_HOST_MAINTENANCE`, asignar automáticamente los tags "Virtualización" y "Gestión de servidores".

## Contexto

El patrón ya existe para `WINDOWS_DOMAIN_MAINTENANCE` (tags "Windows AD Domain" + "Windows Server") y `QNAP_MAINTENANCE` / `VEEAM_BACKUP` (tag "Backups (NAS)"). Este cambio replica exactamente ese mecanismo para VMware.

## Cambios en `odoo.service.ts`

1. Dos nuevos campos privados: `virtualizationTagId: number | null` y `serverManagementTagId: number | null`
2. Método `resolveVirtualizationTagId()`: busca tag por nombre `"Virtualización"` en `helpdesk.tag`
3. Método `resolveServerManagementTagId()`: busca tag por nombre `"Gestión de servidores"` en `helpdesk.tag`
4. En `createTicket`, bloque para `TaskType.SERVER_HOST_MAINTENANCE`:
   ```ts
   if (taskType === TaskType.SERVER_HOST_MAINTENANCE) {
     const virtualizationId = await this.resolveVirtualizationTagId();
     const serverMgmtId = await this.resolveServerManagementTagId();
     payload['tag_ids'] = [[6, 0, [virtualizationId, serverMgmtId]]];
   }
   ```

## Cambios en `odoo.service.spec.ts`

Agregar test case para `SERVER_HOST_MAINTENANCE` que verifica que `tag_ids` se envía con ambos IDs al crear el ticket.

## Nombres exactos de tags en Odoo

- `"Virtualización"` (con tilde)
- `"Gestión de servidores"` (con tilde, minúscula)
