# Spec: Módulo Users — ABM de usuarios internos

**Fecha:** 2026-05-25  
**Estado:** Aprobado

---

## Contexto

ABM de usuarios internos de ONDRA (~20 personas). Solo accesible para el rol `ADMIN`. No es registro público — el admin crea las cuentas manualmente. Es el segundo módulo del backend, después de `auth`.

---

## Arquitectura

`UsersModule` pasa a ser el dueño de la entidad `User`. `AuthModule` deja de importar `TypeOrmModule.forFeature([User])` directamente y pasa a importar `UsersModule` (que exporta el repositorio vía `TypeOrmModule.forFeature([User])`).

```
backend/src/users/
├── user.entity.ts              ← MODIFICAR: agregar campo name
├── user-role.enum.ts           ← sin cambios
├── users.module.ts             ← NUEVO
├── users.controller.ts         ← NUEVO
├── users.controller.spec.ts    ← NUEVO
├── users.service.ts            ← NUEVO
├── users.service.spec.ts       ← NUEVO
└── dto/
    ├── create-user.dto.ts      ← NUEVO
    └── update-user.dto.ts      ← NUEVO

backend/src/auth/auth.module.ts ← MODIFICAR: importar UsersModule
backend/src/app.module.ts       ← MODIFICAR: importar UsersModule
```

---

## Entidad

Se agrega el campo `name` a `User`:

```typescript
@Column({ default: '' })
name: string;
```

`nullable: false` con `default: ''`. En desarrollo, `synchronize: true` aplica el cambio automáticamente. El usuario admin existente (seed) queda con `name: ''` y puede editarse vía PATCH.

---

## DTOs

### CreateUserDto
```typescript
name: string    // @IsString, @IsNotEmpty
email: string   // @IsEmail
role: UserRole  // @IsEnum(UserRole)
```

### UpdateUserDto
`PartialType(CreateUserDto)` — todos los campos opcionales.

---

## Endpoints

Todos bajo `/users`, protegidos con `JwtAuthGuard` + `@Roles(UserRole.ADMIN)`.

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| `GET` | `/users` | — | `User[]` |
| `POST` | `/users` | `CreateUserDto` | `User` + `plainPassword` |
| `PATCH` | `/users/:id` | `UpdateUserDto` | `User` actualizado |
| `PATCH` | `/users/:id/status` | `{ isActive: boolean }` | `User` actualizado |
| `POST` | `/users/:id/reset-password` | — | `{ plainPassword }` |

Las respuestas de usuario nunca incluyen `passwordHash` ni `lastLogoutAt`.

---

## Reglas de negocio

1. **Autoedición bloqueada:** si `id === currentUser.id` en PATCH o reset-password → 403. Evita que el admin se desactive o cambie su propio rol.
2. **Creación:** contraseña generada con `generateRandomPassword()`, hasheada con bcrypt (10 rounds), `mustChangePassword: true` automático. La `plainPassword` se devuelve en la respuesta una sola vez.
3. **Reset password:** misma lógica que creación — nueva contraseña generada, `mustChangePassword: true`, devuelta al admin.
4. **Email único:** si al editar el email ya existe en otro usuario → 409 Conflict.
5. **Not found:** cualquier `:id` inexistente → 404.

---

## Testing

TDD obligatorio. Tests unitarios con mocks.

### users.service.spec.ts
- `findAll`: devuelve lista de usuarios
- `create`: genera contraseña, hashea, setea `mustChangePassword: true`, devuelve `plainPassword`
- `update`: actualiza campos; 404 si no existe; 409 si email ya en uso; 403 si autoedición
- `updateStatus`: activa/desactiva; 403 si autoedición
- `resetPassword`: genera nueva contraseña, hashea, setea `mustChangePassword: true`; 403 si autoedición

### users.controller.spec.ts
- Verifica que cada endpoint delega correctamente al método del service con los argumentos esperados.

Sin tests de integración (consistente con el resto del proyecto).

---

## Utilidades reutilizadas

- `generateRandomPassword()` — `backend/src/common/utils/password.util.ts`
- `JwtAuthGuard`, `RolesGuard`, `@Roles()`, `@CurrentUser()` — exportados desde `AuthModule`