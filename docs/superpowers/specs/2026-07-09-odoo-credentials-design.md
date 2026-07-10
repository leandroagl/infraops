# Spec: Credenciales Odoo por técnico

**Fecha:** 2026-07-09  
**Estado:** Aprobado por Leandro

---

## Contexto

InfraOps integra con Odoo para crear tickets de helpdesk, registrar horas (timesheet) y cerrar tickets al completar tareas de mantenimiento. Hasta ahora toda la integración usa un único service account del `.env`. Esta arquitectura impide trazabilidad real por técnico en Odoo: el tiempo registrado aparece siempre bajo el usuario del sistema, no del técnico que ejecutó el trabajo.

---

## Decisiones de diseño tomadas

| # | Decisión |
|---|---|
| 1 | Cada usuario de InfraOps guarda su propia API key de Odoo (email + token) |
| 2 | Sin key configurada el sistema bloquea el acceso a todos los módulos de tarea — sin fallback al service account |
| 3 | Al primer login se muestra un onboarding obligatorio para configurar la key, con validación contra Odoo en el momento de guardar |
| 4 | Si la key caduca o falla en uso, el sistema notifica al técnico visualmente antes de que pierda trazabilidad |
| 5 | El cierre de tarea es atómico: si Odoo falla, InfraOps no marca DONE |
| 6 | El service account del `.env` queda reservado para acciones sistémicas (creación automática de tareas, sincronización de partners/usuarios) |
| 7 | La API key se cifra en reposo con AES-256; la clave de cifrado vive en el `.env` |
| 8 | El campo `odooExempt` permite que un admin marque usuarios que no tienen cuenta Odoo — quedan exentos del onboarding |

---

## Arquitectura backend

### Split de OdooRpcService

Se crean dos servicios RPC en lugar del singleton actual:

**`OdooSystemRpcService`** — reemplaza al `OdooRpcService` actual
- Usa el service account del `.env` (`ODOO_USERNAME`, `ODOO_API_KEY`)
- Sin estado de `uid` cacheado — autentica por llamada (evita el bug de concurrencia existente)
- Usado por: `createTicket`, `syncPartners`, `syncUsers`, `resolveDoneStageId`, `resolveInProgressStageId`, todas las operaciones de tags
- Permanece como `@Injectable()` singleton en el módulo Odoo

**`OdooUserRpcService`** — nuevo
- Stateless: recibe `{ email, apiKey }` como parámetro por llamada
- Autentica como el usuario específico y ejecuta la llamada
- Usado por: `closeTicket`, `logTimesheet`, `markTicketInProgress`, `validateCredentials`
- Expone también `validateCredentials(email, apiKey): Promise<boolean>` para el onboarding

La lógica de `buildClient` / `call` se extrae a un helper compartido `odoo-rpc.helpers.ts`.

### Entidad User — campos nuevos

```typescript
// Nuevos campos en User entity
@Column({ name: 'odoo_api_email', nullable: true, default: null })
odooApiEmail: string | null;                        // sin cifrar (es el email, no el secret)

@Column({ name: 'odoo_api_key_enc', nullable: true, default: null })
odooApiKeyEnc: string | null;                       // AES-256-CBC cifrado, base64

@Column({ name: 'odoo_key_valid', default: false })
odooKeyValid: boolean;                              // true = última validación exitosa

@Column({ name: 'odoo_key_validated_at', type: 'timestamptz', nullable: true, default: null })
odooKeyValidatedAt: Date | null;

@Column({ name: 'odoo_exempt', default: false })
odooExempt: boolean;                                // admin puede marcar como exento
```

### Cifrado

- Algoritmo: AES-256-CBC
- Clave: `ODOO_ENCRYPT_KEY` en `.env` (32 bytes hex)
- IV: aleatorio por registro, almacenado como prefijo del campo cifrado (`iv:ciphertext` en base64)
- Utilidad: `backend/src/common/utils/crypto.util.ts` con `encrypt(plain, key)` / `decrypt(enc, key)`

### Nuevo endpoint: perfil de credenciales Odoo

`PUT /users/me/odoo-credentials`  
Body: `{ odooApiEmail: string, odooApiKey: string }`  
Guard: `JwtAuthGuard` (cualquier rol autenticado)  
Acción:
1. Valida formato del email
2. Llama a `OdooUserRpcService.validateCredentials(email, apiKey)`
3. Si falla: `400 Bad Request` con mensaje claro
4. Si éxito: cifra la key, guarda `odooApiEmail`, `odooApiKeyEnc`, `odooKeyValid: true`, `odooKeyValidatedAt: now()`

`GET /users/me`  
Devuelve perfil del usuario actual incluyendo `odooKeyValid`, `odooKeyValidatedAt`, `odooApiEmail`, `odooExempt` (nunca devuelve la key descifrada)

### Cambio en LoginResponseDto

```typescript
export class LoginResponseDto {
  accessToken: string;
  mustChangePassword: boolean;
  mustOdooSetup: boolean;      // true si !odooKeyValid && !odooExempt
  user: {
    id: string;
    email: string;
    role: UserRole;
    technicianId: string | null;
    odooKeyValid: boolean;
    odooExempt: boolean;
  };
}
```

### Cambio en updateStatus (cierre atómico)

`TasksService.updateStatus` no recibe parámetros adicionales. El técnico cuyas credenciales se usan es siempre el **técnico asignado a la tarea** (ya cargado via relation `task.technician.user`), independientemente de quién ejecute el cierre (admin, TL, o el propio técnico).

Al cerrar (DONE / NOT_DONE con ticket Odoo):
1. Recupera las credenciales cifradas del técnico asignado a la tarea desde la DB (via `task.technician.user`)
2. Si `odooKeyValid === false` o `odooApiKeyEnc === null`: lanza `400` con mensaje "El técnico asignado no tiene credenciales Odoo configuradas"
3. Descifra la key en memoria
4. Llama a `OdooUserRpcService` con esas credenciales
5. Si Odoo falla: lanza excepción — InfraOps NO actualiza el status de la tarea
6. Si Odoo responde OK: actualiza el status en DB

---

## Frontend

### AuthService — nuevos helpers

```typescript
mustOdooSetup(): boolean  // lee localStorage 'mustOdooSetup'
clearOdooSetup(): void
odooKeyValid(): boolean
```

### AuthGuard — nueva condición

```typescript
canActivate(): boolean {
  if (!auth.isAuthenticated()) → /login
  if (auth.mustChangePassword()) → /login/change-password
  if (auth.mustOdooSetup()) → /onboarding/odoo           // NUEVO
  return true;
}
```

### Nueva ruta: `/onboarding/odoo`

Componente `OdooSetupComponent` en `features/auth/odoo-setup/`  
- Fuera del shell principal (misma estructura que change-password)
- Form: `odooApiEmail` (pre-cargado con el email InfraOps del usuario, editable), `odooApiKey`
- Steps visuales (dots): paso 1 done (login) → paso 2 activo (Odoo) → paso 3 pendiente (ingreso)
- Botón "Validar y continuar": llama a `PUT /users/me/odoo-credentials`, on success → `clearOdooSetup()` → navega a `/dashboard`
- Único escape: "Cerrar sesión"
- Loading state durante validación

### Panel de perfil: `/profile`

Nueva ruta dentro del shell con sidebar.  
Componente `ProfileComponent` en `features/profile/`  
Secciones:
1. **Cuenta InfraOps** — nombre, email, rol, botón "Cambiar contraseña"
2. **Integración Odoo** — muestra estado (chip ok/crit), email configurado, key enmascarada (últimos 4 chars), fecha de última validación, botones "Actualizar credenciales" y "Revocar key"

La sidebar del shell incluye un ítem "Mi perfil" bajo sección "Cuenta".

### Notificación de key inválida

Cuando `OdooUserRpcService` lanza error al cerrar una tarea, el frontend muestra un snackbar persistente:

> "Error al registrar en Odoo. Verificá tus credenciales en Mi perfil antes de reintentar."

Con link directo a `/profile`.

---

## Flujo completo de onboarding

```
Login OK
  ├─ mustChangePassword=true → /login/change-password → clearFlag → vuelve a evaluar
  ├─ mustOdooSetup=true      → /onboarding/odoo
  │     ├─ Ingresa email + key
  │     ├─ PUT /users/me/odoo-credentials
  │     │     ├─ Odoo rechaza → error inline, no avanza
  │     │     └─ Odoo acepta → clearOdooSetup → /dashboard
  │     └─ Cerrar sesión
  └─ Todo OK → /dashboard
```

---

## Módulo admin: exempciones

En el ABM de usuarios (admin), nueva columna / toggle `Exento de Odoo`.  
`PATCH /users/:id` acepta `{ odooExempt: boolean }` — solo rol `ADMIN`.  
Usuarios exentos no son redirigidos al onboarding, acceden a todos los módulos.

---

## Testing

### Backend
- `CryptoUtil`: tests unitarios de encrypt/decrypt round-trip y key inválida
- `OdooUserRpcService.validateCredentials`: mock de xmlrpc, prueba uid=0 (credenciales wrongas), uid válido, error de red
- `AuthService.login`: verifica que `mustOdooSetup` sea `true` cuando `!odooKeyValid && !odooExempt`
- `TasksService.updateStatus` al cerrar: prueba path con credenciales faltantes (400), con Odoo fallando (no actualiza status), con Odoo OK (actualiza status)
- `PUT /users/me/odoo-credentials`: prueba validación OK, Odoo rechaza, formato inválido

### Frontend
- `AuthGuard`: tres branches de redirect (mustChangePassword, mustOdooSetup, ok)
- `OdooSetupComponent`: form inválido no envía, error de API muestra mensaje, success navega a /dashboard
- `ProfileComponent`: muestra estado ok/sin configurar según `odooKeyValid`

---

## Migraciones de DB

Una migración:
- Agrega `odoo_api_email` (varchar, nullable)
- Agrega `odoo_api_key_enc` (varchar, nullable)
- Agrega `odoo_key_valid` (boolean, default false)
- Agrega `odoo_key_validated_at` (timestamptz, nullable)
- Agrega `odoo_exempt` (boolean, default false)

---

## Variables de entorno nuevas

| Variable | Descripción |
|---|---|
| `ODOO_ENCRYPT_KEY` | Clave AES-256 de 32 bytes en hex para cifrar las API keys de usuarios |

---

## Lo que NO cambia

- `OdooSystemRpcService` (ex `OdooRpcService`) sigue usando `ODOO_USERNAME` / `ODOO_API_KEY` para todas las acciones sistémicas
- La creación de tareas (`createTicket`) usa el service account — no las credenciales del técnico
- Los endpoints de sync admin (`/admin/odoo/sync/*`) no cambian
- `odooUserId` y `odooEmployeeId` siguen sincronizándose vía sync admin (no por el técnico)
