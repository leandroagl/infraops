# Seed Admin — Diseño

**Fecha:** 2026-05-25  
**Estado:** Aprobado  
**Módulo:** `scripts` + `common/utils`  
**Stack:** NestJS · TypeORM · PostgreSQL · bcrypt

---

## Contexto

Al instalar InfraOps por primera vez no existe ningún usuario en la base de datos. Se necesita un script de inicialización que cree el primer usuario ADMIN para que el sistema pueda comenzar a usarse. El concepto es idéntico al `db:seed` de ONDRA Monitor.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|---|---|---|
| Enfoque del script | Standalone con DataSource directo | Mismo patrón que ONDRA Monitor. Sin overhead de NestJS, simple y conocido por el equipo |
| Idempotencia | Busca `role = ADMIN` antes de crear | Seguro de re-ejecutar sin duplicar usuarios |
| Contraseña | Generada aleatoriamente por el script | No hardcodear credenciales; se muestra una vez en consola |
| Output de contraseña | `process.stdout.write` (no logger) | Evita que quede registrada en archivos de log |
| Tests del script | Solo para `generateRandomPassword()` | El script es una secuencia de primitivas ya testeadas |

---

## Archivos

```
backend/src/
├── common/
│   └── utils/
│       └── password.util.ts    ← generateRandomPassword() + tests
├── scripts/
│   └── seed-admin.ts           ← script standalone de seeding
└── package.json                ← agrega script "db:seed"
```

---

## `generateRandomPassword()`

Genera una contraseña aleatoria de 12 caracteres con presencia garantizada de:
- Al menos 1 mayúscula
- Al menos 1 número  
- Al menos 1 carácter especial (`!@#$%^&*()-_=+`)

Usa `crypto.randomInt` para distribución uniforme. Aplica Fisher-Yates shuffle para evitar sesgos en la permutación final.

---

## Comportamiento del seed

### Verificación de idempotencia

Antes de crear nada, el script consulta si existe algún usuario con `role = 'ADMIN'`:
- Si existe → muestra mensaje y termina sin modificar nada
- Si no existe → crea el usuario admin

### Usuario creado

| Campo | Valor |
|---|---|
| `email` | `admininfraops@ondra.com.ar` |
| `role` | `ADMIN` |
| `mustChangePassword` | `true` |
| `isActive` | `true` |
| `lastLogoutAt` | `null` |
| `passwordHash` | `bcrypt(generatedPassword, 10)` |

### Output en consola

```
─────────────────────────────────────────────
Usuario admin creado:
  Email:      admininfraops@ondra.com.ar
  Contraseña: <contraseña generada>
  Guardá esta contraseña — no se volverá a mostrar.
─────────────────────────────────────────────
```

La contraseña se muestra **una sola vez** via `process.stdout.write`. No se loguea por Winston ni ningún otro sistema de logging.

---

## Script npm

```json
"db:seed": "ts-node -r tsconfig-paths/register src/scripts/seed-admin.ts"
```

Requiere que las variables de entorno de base de datos estén configuradas (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).

---

## Tests

### `password.util.spec.ts`
- La contraseña generada tiene exactamente 12 caracteres
- Contiene al menos una mayúscula
- Contiene al menos un número
- Contiene al menos un carácter especial
- Dos llamadas consecutivas devuelven contraseñas distintas (aleatoriedad)

El script `seed-admin.ts` no tiene tests unitarios — es una secuencia lineal de primitivas ya testeadas (TypeORM DataSource, bcrypt, `generateRandomPassword`).

---

## Flujo de ejecución (post-instalación)

```
1. npm run db:seed
2. Script conecta a PostgreSQL via DataSource
3. Verifica si existe usuario ADMIN → no existe
4. Genera contraseña aleatoria
5. Hashea con bcrypt (rounds: 10)
6. Inserta usuario en tabla 'users'
7. Muestra credenciales en consola una sola vez
8. Cierra conexión DataSource
```
