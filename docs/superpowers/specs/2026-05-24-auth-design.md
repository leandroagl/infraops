# Auth Module — Diseño

**Fecha:** 2026-05-24  
**Estado:** Aprobado  
**Módulo:** `auth`  
**Stack:** NestJS · TypeORM · PostgreSQL · Passport JWT

---

## Contexto

El módulo `auth` es el primero en construirse dentro de InfraOps. Provee autenticación JWT para los ~20 usuarios internos de ONDRA (técnicos, coordinadora, TL y admins). No hay usuarios externos.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Refresh token | No — token único 24h | Usuarios internos, tablets en campo, simplicidad |
| Almacenamiento en frontend | `localStorage` con clave `infraops_token` | Convención definida en REVIEW_RULES |
| Logout server-side | `lastLogoutAt` en `User` | Sin tabla extra, persiste entre reinicios, válido para equipo pequeño |
| Restricción por `mustChangePassword` | Solo en frontend (guard Angular) | Over-engineering innecesario para 20 usuarios internos |

---

## Endpoints

| Método | Ruta | Auth requerida | Descripción |
|--------|------|---------------|-------------|
| `POST` | `/auth/login` | No | Login con email + password |
| `POST` | `/auth/logout` | JWT | Actualiza `lastLogoutAt` en User |
| `POST` | `/auth/change-password` | JWT | Cambia contraseña, limpia `mustChangePassword` |

---

## JWT

### Payload
```typescript
interface JwtPayload {
  sub: string;                // userId
  email: string;
  role: UserRole;             // ADMIN | TL | TECHNICIAN | COORDINATOR
  mustChangePassword: boolean;
  iat: number;                // emitido automáticamente
  exp: number;                // iat + 24h
}
```

### Configuración
- Algoritmo: HS256 (jsonwebtoken default)
- Expiry: `24h`
- Secret: variable de entorno `JWT_SECRET` (mínimo 32 caracteres)

---

## Flujos

### Login
1. Recibe `{ email, password }`
2. Busca el `User` por email. Si no existe → `UnauthorizedException` (mensaje genérico)
3. Verifica password con `bcrypt.compare`. Si falla → `UnauthorizedException` (mismo mensaje genérico)
4. Construye payload con `mustChangePassword` del User
5. Firma JWT con expiry 24h
6. Devuelve `{ token, mustChangePassword, user: { id, email, role } }`

### Logout
1. Recibe request con JWT válido (JwtAuthGuard)
2. Actualiza `user.lastLogoutAt = new Date()` vía `UserRepository`
3. Devuelve `204 No Content`

### Change Password
1. Recibe `{ currentPassword, newPassword }` con JWT válido
2. Extrae userId del `req.user.sub`
3. Verifica `currentPassword` con bcrypt contra el hash actual. Si falla → `UnauthorizedException`
4. Hashea `newPassword` con bcrypt (rounds: 10)
5. Actualiza `passwordHash` y setea `mustChangePassword = false`
6. Devuelve `204 No Content`

### Validación de token en cada request (JwtStrategy.validate)
1. Passport verifica firma y expiración del token
2. `validate()` consulta el User por `payload.sub`
3. Si `user.lastLogoutAt` no es `null` y `new Date(payload.iat * 1000) < user.lastLogoutAt` → token revocado → lanza `UnauthorizedException`
   - Nota: JWT `iat` está en segundos; `Date` trabaja en milisegundos → multiplicar por 1000
   - Si `lastLogoutAt` es `null` (usuario nunca hizo logout) → token siempre válido
4. Retorna el payload completo → disponible como `req.user`

---

## Estructura de archivos

```
backend/src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── dto/
│   ├── login.dto.ts              # { email, password }
│   ├── change-password.dto.ts    # { currentPassword, newPassword }
│   └── login-response.dto.ts     # { token, mustChangePassword, user }
├── guards/
│   ├── jwt-auth.guard.ts         # Extiende AuthGuard('jwt')
│   └── roles.guard.ts            # Lee @Roles(), valida req.user.role
├── decorators/
│   ├── roles.decorator.ts        # @Roles(...roles: UserRole[])
│   └── current-user.decorator.ts # @CurrentUser() → JwtPayload
├── strategies/
│   └── jwt.strategy.ts           # Valida firma + iat > lastLogoutAt
├── auth.controller.spec.ts
└── auth.service.spec.ts
```

---

## Manejo de errores

| Caso | Excepción |
|------|-----------|
| Email no encontrado | `UnauthorizedException` — "Credenciales inválidas" |
| Password incorrecta | `UnauthorizedException` — "Credenciales inválidas" |
| Token expirado o inválido | `UnauthorizedException` |
| Token revocado (post-logout) | `UnauthorizedException` |
| Rol insuficiente | `ForbiddenException` |
| Password actual incorrecta en change-password | `UnauthorizedException` |

El mensaje de error en login es siempre el mismo ("Credenciales inválidas") para no revelar si el email existe en el sistema.

---

## Guards y decoradores

### JwtAuthGuard
Extiende `AuthGuard('jwt')` de `@nestjs/passport`. Aplicado con `@UseGuards(JwtAuthGuard)`. Puede registrarse globalmente en `main.ts` o por controller.

### RolesGuard
Implementa `CanActivate`. Lee metadata de `@Roles()` via `Reflector`. Si no hay roles requeridos, permite el acceso. Si los hay, compara con `req.user.role`. Siempre se usa junto a `JwtAuthGuard`.

### @Roles(...roles)
```typescript
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
```

### @CurrentUser()
```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

## Validaciones de DTOs

### LoginDto
- `email`: `@IsEmail()`, `@IsNotEmpty()`
- `password`: `@IsString()`, `@IsNotEmpty()`

### ChangePasswordDto
- `currentPassword`: `@IsString()`, `@IsNotEmpty()`
- `newPassword`: `@IsString()`, `@MinLength(8)`

---

## Tests

### auth.service.spec.ts — unitarios con mocks
- `login`: credenciales válidas → devuelve token y payload correcto
- `login`: email inexistente → `UnauthorizedException`
- `login`: password incorrecta → `UnauthorizedException`
- `logout`: actualiza `lastLogoutAt` del user
- `changePassword`: password actual válida → actualiza hash y limpia flag
- `changePassword`: password actual inválida → `UnauthorizedException`

### auth.controller.spec.ts — unitarios con mock del service
- `POST /auth/login`: llama a `authService.login()` y devuelve `200` con el resultado
- `POST /auth/logout`: llama a `authService.logout()` y devuelve `204`
- `POST /auth/change-password`: llama a `authService.changePassword()` y devuelve `204`

---

## Dependencias externas requeridas

- `@nestjs/passport`
- `@nestjs/jwt`
- `passport`
- `passport-jwt`
- `bcrypt` + `@types/bcrypt`
- `class-validator` + `class-transformer`
