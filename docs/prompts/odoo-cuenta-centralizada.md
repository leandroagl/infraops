# Reemplazar credenciales Odoo por técnico → cuenta centralizada

## Contexto

InfraOps tenía un sistema de credenciales Odoo por técnico (API key individual cifrada en DB, onboarding obligatorio al primer login, cierre atómico usando las credenciales del técnico asignado). Ese sistema fue descartado porque en Odoo cualquier cuenta con permisos puede:
- Crear tickets y asignarlos a otro usuario vía `user_id`
- Imputar horas a nombre de otro empleado vía `employee_id` en `account.analytic.line`
- Postear notas a nombre de otro usuario vía `author_id` en `message_post`

La complejidad de las credenciales por técnico era innecesaria. Se reemplaza por una única cuenta centralizada (en dev: la cuenta del admin en `.env`; en producción: cuenta dedicada a definir con el equipo).

## Decisiones de diseño

1. Todos los métodos que usaban `OdooUserRpcService` pasan a usar `OdooSystemRpcService`
2. La atribución de horas al técnico asignado se mantiene vía `employee_id` (ya existía, no cambia)
3. Las notas internas también se atribuyen al técnico asignado vía `author_id` (partner_id del usuario Odoo del técnico)
4. `postInternalNote` recibe el `InfraOps userId` del técnico para resolver su `partner_id` en Odoo
5. El `partner_id` se resuelve en el momento (sin cachear, sin campo nuevo en DB) desde `odooUserId` vía `res.users.read`

## Qué se elimina

### Backend — archivos a borrar
- `backend/src/integrations/odoo/odoo-user-rpc.service.ts`
- `backend/src/integrations/odoo/odoo-user-rpc.service.spec.ts`
- `backend/src/integrations/odoo/odoo-user-rpc.module.ts`
- `backend/src/common/utils/crypto.util.ts`
- `backend/src/common/utils/crypto.util.spec.ts`
- `backend/src/users/dto/update-odoo-credentials.dto.ts`
- `backend/src/users/dto/update-odoo-exempt.dto.ts`
- `backend/src/users/users-me.controller.ts` *(el endpoint GET /users/me puede descartarse también)*

### Backend — archivos a modificar

**`backend/src/users/user.entity.ts`**  
Eliminar los 5 campos:
- `odooApiEmail`
- `odooApiKeyEnc`
- `odooKeyValid`
- `odooKeyValidatedAt`
- `odooExempt`

**`backend/src/migrations/`**  
Crear migración nueva que elimine esas 5 columnas de la tabla `users`. El timestamp del nombre debe ser posterior a la migración que las agregó (`1784016000000`).

**`backend/src/integrations/odoo/odoo.service.ts`**  
- Eliminar la inyección de `OdooUserRpcService` del constructor
- Eliminar el parámetro `creds: OdooUserCredentials` de `closeTicket`, `markTicketInProgress`, `logTimesheet`
- En `logTimesheet`, `closeTicket`, `markTicketInProgress`: reemplazar `this.userRpc.callKw(creds, ...)` por `this.systemRpc.callKw(...)`
- En `postInternalNote`: agregar parámetro `technicianUserId: string` y antes del `callKw` resolver el `partner_id` del técnico así:

```typescript
async postInternalNote(ticketId: number, note: string, technicianUserId: string): Promise<void> {
  const partnerId = await this.resolveUserPartnerId(technicianUserId);
  const kwargs: Record<string, unknown> = {
    body: note,
    message_type: 'comment',
    subtype_xmlid: 'mail.mt_note',
  };
  if (partnerId !== null) kwargs['author_id'] = partnerId;
  await this.systemRpc.callKw('helpdesk.ticket', 'message_post', [[ticketId]], kwargs);
}

private async resolveUserPartnerId(userId: string): Promise<number | null> {
  const user = await this.userRepo.findOne({ where: { id: userId } });
  if (!user?.odooUserId) return null;
  const results = await this.systemRpc.callKw<Array<{ id: number; partner_id: [number, string] }>>(
    'res.users', 'read', [[user.odooUserId]], { fields: ['partner_id'] }
  );
  return results?.[0]?.partner_id?.[0] ?? null;
}
```

**`backend/src/integrations/odoo/odoo-integration.module.ts`**  
Eliminar `OdooUserRpcModule` del array `imports`.

**`backend/src/tasks/tasks.service.ts`**  
- Eliminar el import de `decrypt` y de `OdooUserCredentials`
- Eliminar el método privado `getOdooCredentials`
- Eliminar `ConfigService` del constructor si solo se usaba para la clave de cifrado
- En `updateStatus`, eliminar el bloque que busca `odooApiKeyEnc` y construye credenciales
- Las llamadas a `odooService.closeTicket` y `odooService.markTicketInProgress` ya no pasan `creds`
- Las llamadas a `odooService.postInternalNote` ahora pasan el `userId` del técnico asignado como tercer argumento

**`backend/src/auth/dto/login-response.dto.ts`**  
Eliminar `mustOdooSetup`, `odooKeyValid`, `odooExempt` del DTO.

**`backend/src/auth/auth.service.ts`**  
Eliminar la lógica de `mustOdooSetup` del método `login`.

**`backend/src/users/users.service.ts`**  
Eliminar `getMe`, `updateOdooCredentials`, `updateOdooExempt`. Eliminar imports de `OdooUserRpcService`, `encrypt`, `ConfigService` si no tienen otro uso.

**`backend/src/users/users.controller.ts`**  
Eliminar `PATCH :id/odoo-exempt`.

**`backend/src/users/users.module.ts`**  
Eliminar `OdooUserRpcModule` del `imports`. Eliminar `UsersMeController` de `controllers`.

### Frontend — archivos a borrar
- `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.ts`
- `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.html`
- `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.scss`
- `frontend/src/app/features/auth/odoo-setup/odoo-setup.component.spec.ts`
- `frontend/src/app/core/services/profile.service.ts` *(si solo tenía métodos Odoo)*
- `frontend/src/app/core/services/profile.service.spec.ts`

### Frontend — archivos a modificar

**`frontend/src/app/core/models/auth.models.ts`**  
Eliminar `mustOdooSetup` de `LoginResponse`. Eliminar `odooKeyValid` y `odooExempt` de `AuthUser`.

**`frontend/src/app/core/services/auth.service.ts`**  
- Eliminar `MUST_ODOO_SETUP_KEY`
- Eliminar `mustOdooSetup()` y `clearMustOdooSetup()`
- Eliminar el `localStorage.setItem` de `mustOdooSetup` en el método `login`
- Eliminar el `localStorage.removeItem` de `mustOdooSetup` en `logout`

**`frontend/src/app/core/guards/auth.guard.ts`**  
Eliminar la condición `if (this.auth.mustOdooSetup())`.

**`frontend/src/app/features/auth/auth.module.ts`**  
Eliminar `OdooSetupComponent` de declarations y su ruta `odoo-setup`.

**`frontend/src/app/features/profile/profile.component.ts` y `.html`**  
Eliminar la sección "Integración Odoo" (estado de key, email configurado, botones de actualizar/revocar). Conservar el resto del componente si tiene otras secciones (datos de cuenta InfraOps, cambio de contraseña).

## Lo que NO cambia

- `OdooSystemRpcService` — sin modificaciones
- `OdooRpcHelpers` — sin modificaciones
- Los campos `odooUserId` y `odooEmployeeId` en `User` — se mantienen, son necesarios
- La creación de tickets (`createTicket`) — sin cambios
- Sync de partners y usuarios — sin cambios
- El campo `employee_id` en timesheet — ya existe, sin cambios

## Orden de implementación sugerido

1. Migración de DB (eliminar 5 columnas)
2. User entity (eliminar los 5 campos)
3. Eliminar `OdooUserRpcService` + module + crypto.util
4. Refactorizar `OdooService` (quitar `userRpc`, actualizar los 4 métodos)
5. Refactorizar `TasksService` (quitar credential lookup)
6. Refactorizar `AuthService` backend + `LoginResponseDto`
7. Limpiar `UsersService` y controllers
8. Frontend: auth.models, auth.service, auth.guard
9. Frontend: eliminar OdooSetupComponent y ruta
10. Frontend: limpiar ProfileComponent

## Verificación

Al terminar, el flujo de cierre de tarea debe:
- Registrar timesheet con `employee_id` del técnico asignado ✓
- Postear nota interna con `author_id` = partner_id del técnico asignado ✓
- Todo autenticado con la cuenta sistema del `.env` ✓
- Sin bloquear por "credenciales no configuradas" ✓
- Sin pantalla de onboarding al primer login ✓
