# TypeORM Migrations — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `synchronize: true` por migraciones TypeORM versionadas, activas en todos los entornos, con ejecución automática al arrancar el contenedor Docker.

**Architecture:** Se agrega un `DataSource` independiente de NestJS para el CLI de TypeORM, un `tsconfig.migrations.json` que overridea el módulo a commonjs (necesario porque el tsconfig principal usa nodenext), y un `docker-entrypoint.sh` que corre `migration:run` antes de iniciar la app. El `AppModule` pasa a `synchronize: false` fijo.

**Tech Stack:** TypeORM 0.3.30, NestJS 11, `typeorm-ts-node-commonjs` (incluido en typeorm), `cross-env` (compatibilidad Windows/Linux), ts-node, PostgreSQL.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/tsconfig.migrations.json` | Crear | Override `module: commonjs` para el CLI |
| `backend/src/database/data-source.ts` | Crear | DataSource autónomo para TypeORM CLI |
| `backend/src/migrations/` | Crear (vacío) | Carpeta donde van las migraciones generadas |
| `backend/package.json` | Modificar | Agregar 5 scripts de migración + `cross-env` devDep |
| `backend/src/app.module.ts` | Modificar | `synchronize: false`, agregar `migrations` path |
| `backend/docker-entrypoint.sh` | Crear | Correr `migration:run:prod` antes de `node dist/main` |

---

## Task 1: Instalar cross-env y crear tsconfig.migrations.json

**Files:**
- Modify: `backend/package.json`
- Create: `backend/tsconfig.migrations.json`

- [ ] **Step 1: Instalar cross-env como devDependency**

Desde `backend/`:
```bash
npm install --save-dev cross-env
```

Verificar que `cross-env` aparece en `devDependencies` de `package.json`.

- [ ] **Step 2: Crear tsconfig.migrations.json**

Crear `backend/tsconfig.migrations.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

Este archivo overridea únicamente el sistema de módulos. El `tsconfig.json` principal usa `nodenext`, que es incompatible con `typeorm-ts-node-commonjs`. Este override solo afecta al CLI de migraciones, no al build normal de la app.

- [ ] **Step 3: Verificar que TypeScript acepta el archivo**

```bash
npx tsc --project tsconfig.migrations.json --noEmit
```

Esperado: sin errores (puede mostrar warnings, está bien).

- [ ] **Step 4: Commit**

```bash
git add tsconfig.migrations.json package.json package-lock.json
git commit -m "chore: agregar cross-env y tsconfig para CLI de migraciones"
```

---

## Task 2: Crear src/database/data-source.ts

**Files:**
- Create: `backend/src/database/data-source.ts`

Este archivo es el punto de entrada del CLI de TypeORM. Debe ser independiente de NestJS — carga las variables de entorno directamente con `dotenv` y exporta un `DataSource`. No se inyecta en NestJS, solo lo usa el CLI.

- [ ] **Step 1: Crear el directorio y el archivo**

Crear `backend/src/database/data-source.ts`:
```typescript
import 'dotenv/config';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'infraops',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
});
```

**Por qué concatenación en lugar de `path.join`:** `path.join` normaliza separadores a `\` en Windows, lo que rompe los patrones glob que TypeORM procesa internamente. La concatenación directa preserva `/` en todos los OS.

**Por qué `__dirname + '/../'`:** cuando ts-node corre este archivo desde `src/database/`, `__dirname` es `.../src/database` y `/../` apunta a `src/`. Cuando corre el `.js` compilado desde `dist/database/`, apunta a `dist/`. El glob `{.ts,.js}` resuelve lo que exista en cada contexto.

- [ ] **Step 2: Verificar que TypeScript compila el archivo sin errores**

```bash
npx tsc --project tsconfig.migrations.json --noEmit
```

Esperado: sin errores de tipos.

- [ ] **Step 3: Commit**

```bash
git add src/database/data-source.ts
git commit -m "feat: agregar DataSource autónomo para CLI de migraciones TypeORM"
```

---

## Task 3: Agregar scripts de migración en package.json

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Agregar los 5 scripts en la sección `"scripts"`**

En `backend/package.json`, dentro de `"scripts"`, agregar después de `"db:seed:prod"`:

```json
"migration:generate": "cross-env TS_NODE_PROJECT=tsconfig.migrations.json typeorm-ts-node-commonjs -d src/database/data-source.ts migration:generate",
"migration:run":      "cross-env TS_NODE_PROJECT=tsconfig.migrations.json typeorm-ts-node-commonjs -d src/database/data-source.ts migration:run",
"migration:revert":   "cross-env TS_NODE_PROJECT=tsconfig.migrations.json typeorm-ts-node-commonjs -d src/database/data-source.ts migration:revert",
"migration:show":     "cross-env TS_NODE_PROJECT=tsconfig.migrations.json typeorm-ts-node-commonjs -d src/database/data-source.ts migration:show",
"migration:run:prod": "typeorm -d dist/database/data-source.js migration:run"
```

**Nota sobre `migration:generate`:** el nombre de la migración se pasa como argumento posicional al final:
```bash
npm run migration:generate -- src/migrations/NombreDeLaMigracion
```

**Nota sobre `migration:run:prod`:** este script corre sobre los `.js` compilados en `dist/`. Lo usa el `docker-entrypoint.sh`. No usa ts-node ni cross-env porque en el contenedor todo es JS compilado.

- [ ] **Step 2: Verificar que los scripts son reconocidos por npm**

Con la DB de desarrollo levantada, correr:
```bash
npm run migration:show
```

Esperado: imprime una lista de migraciones (vacía por ahora — algo como `No migrations are pending`). Si arroja error de conexión a la DB, verificar que las variables de entorno en `.env` son correctas. Si arroja error de TypeScript, verificar `tsconfig.migrations.json`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: agregar scripts de migración TypeORM en package.json"
```

---

## Task 4: Modificar AppModule — deshabilitar synchronize

**Files:**
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Actualizar la configuración de TypeOrmModule**

En `backend/src/app.module.ts`, reemplazar el bloque `TypeOrmModule.forRoot`:

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'infraops',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
}),
```

Los cambios respecto al original:
- Se agrega `migrations: [__dirname + '/migrations/*{.ts,.js}']`
- `synchronize: process.env.NODE_ENV !== 'production'` se reemplaza por `synchronize: false` fijo

**Importante:** NestJS no corre las migraciones automáticamente aunque `migrations` esté configurado. El array `migrations` solo le indica dónde están los archivos; quien las ejecuta es el CLI (`migration:run`) o el entrypoint de Docker.

- [ ] **Step 2: Correr los tests para asegurar que no se rompió nada**

```bash
npm test
```

Esperado: todos los tests pasan. Los tests usan mocks de repositorio, no dependen del `synchronize` flag.

- [ ] **Step 3: Levantar la app en dev para verificar que arranca sin synchronize**

```bash
npm run start:dev
```

Esperado: la app arranca sin errores. Como la DB ya tiene el schema correcto (synchronize la mantuvo hasta ahora), no hay tablas faltantes.

- [ ] **Step 4: Commit**

```bash
git add src/app.module.ts
git commit -m "feat: deshabilitar synchronize y configurar path de migraciones en AppModule"
```

---

## Task 5: Generar migración inicial

**Files:**
- Create: `backend/src/migrations/<timestamp>-InitialSchema.ts` (generado automáticamente)

La migración inicial captura el schema completo para que una DB vacía pueda ser inicializada con `migration:run`. Para generarla correctamente se necesita una DB vacía (sin tablas), porque `migration:generate` calcula el DIFF entre la DB actual y las entidades — si la DB ya tiene las tablas, el diff es vacío.

- [ ] **Step 1: Dropear todas las tablas de la DB de desarrollo**

Con `psql` o cualquier cliente PostgreSQL conectado a la DB `infraops`:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

Esto elimina todas las tablas. La DB queda vacía pero existe.

- [ ] **Step 2: Generar la migración inicial**

```bash
npm run migration:generate -- src/migrations/InitialSchema
```

Esperado: TypeORM compara las entidades con la DB vacía y genera un archivo `src/migrations/<timestamp>-InitialSchema.ts` con todos los `CREATE TABLE`, constraints, e índices.

- [ ] **Step 3: Revisar el archivo generado**

Abrir `src/migrations/<timestamp>-InitialSchema.ts` y verificar que:
- Tiene un método `up()` con los CREATE TABLE para: `users`, `clients`, `technicians`, `tasks`, `maintenance_logs`
- Tiene un método `down()` con los DROP TABLE correspondientes
- Las columnas de `users` incluyen `odoo_user_id` y `odoo_synced_at`
- La tabla `technicians` NO tiene `odoo_user_id` ni `odoo_synced_at`

- [ ] **Step 4: Correr la migración para recrear la DB**

```bash
npm run migration:run
```

Esperado: TypeORM crea todas las tablas ejecutando el `up()` de la migración inicial. Luego imprime algo como:
```
query: START TRANSACTION
query: CREATE TABLE "users" ...
...
query: INSERT INTO "migrations"("timestamp", "name") VALUES ($1, $2) ...
query: COMMIT
Migration InitialSchema<timestamp> has been  executed successfully.
```

- [ ] **Step 5: Verificar que migration:show marca la migración como ejecutada**

```bash
npm run migration:show
```

Esperado: muestra `[X] InitialSchema<timestamp>` (marcada como ejecutada).

- [ ] **Step 6: Volver a cargar el seed de datos**

```bash
npm run db:seed
```

Esto recrea el usuario admin inicial que se perdió al dropear las tablas.

- [ ] **Step 7: Correr los tests para confirmar que todo sigue funcionando**

```bash
npm test
```

Esperado: todos los tests pasan.

- [ ] **Step 8: Commit**

```bash
git add src/migrations/
git commit -m "feat: migración inicial — schema completo desde entidades"
```

---

## Task 6: Crear docker-entrypoint.sh

**Files:**
- Create: `backend/docker-entrypoint.sh`

- [ ] **Step 1: Crear el archivo**

Crear `backend/docker-entrypoint.sh`:
```sh
#!/bin/sh
set -e

echo "Corriendo migraciones..."
npm run migration:run:prod

echo "Iniciando aplicación..."
exec node dist/main
```

`set -e` asegura que si `migration:run:prod` falla (por ejemplo, SQL inválido o DB inaccesible), el contenedor se detiene en lugar de arrancar con un schema roto.

`exec node dist/main` reemplaza el proceso shell por el proceso Node, para que las señales del sistema operativo (SIGTERM, SIGINT) lleguen directamente a la app.

- [ ] **Step 2: Dar permisos de ejecución**

En Linux/Mac:
```bash
chmod +x docker-entrypoint.sh
```

En Windows (solo si usás Git Bash o WSL para el build):
```bash
git update-index --chmod=+x backend/docker-entrypoint.sh
```

El segundo comando le indica a Git que el archivo es ejecutable, lo cual se preserva en el repositorio y es respetado por el build de Docker en Linux.

- [ ] **Step 3: Verificar que el archivo tiene el bit de ejecución en Git**

```bash
git ls-files --stage backend/docker-entrypoint.sh
```

Esperado: el primer número es `100755` (ejecutable). Si es `100644`, correr el `git update-index` del paso anterior.

- [ ] **Step 4: Commit**

```bash
git add docker-entrypoint.sh
git commit -m "feat: docker-entrypoint que corre migraciones antes de iniciar la app"
```

---

## Task 7: Conectar entrypoint en Dockerfile (si existe)

**Files:**
- Modify: `backend/Dockerfile` (si existe; si no, este task se saltea)

- [ ] **Step 1: Verificar si existe un Dockerfile**

```bash
ls backend/Dockerfile
```

Si no existe, este task no aplica. Saltear al task 8.

- [ ] **Step 2: Agregar el entrypoint al Dockerfile**

Buscar la línea `CMD` o `ENTRYPOINT` al final del Dockerfile y reemplazarla por:

```dockerfile
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: conectar docker-entrypoint en Dockerfile"
```

---

## Task 8: Verificación final y documentación del flujo

- [ ] **Step 1: Correr todos los tests**

```bash
cd backend && npm test
```

Esperado: todos los tests pasan.

- [ ] **Step 2: Verificar que la app arranca en dev**

```bash
npm run start:dev
```

Esperado: la app arranca sin errores y sin intentar hacer synchronize.

- [ ] **Step 3: Verificar el flujo completo de migration:generate con un cambio de prueba**

Agregar un campo temporal a cualquier entidad, por ejemplo en `user.entity.ts`:
```typescript
@Column({ nullable: true, default: null })
testField: string | null;
```

Correr:
```bash
npm run migration:generate -- src/migrations/TestMigration
```

Esperado: genera `src/migrations/<timestamp>-TestMigration.ts` con un `ALTER TABLE "users" ADD COLUMN "testField"`.

Deshacer el cambio de prueba:
1. Eliminar el campo de la entidad
2. Eliminar el archivo de migración generado
3. No commitear este cambio de prueba

- [ ] **Step 4: Commit final de limpieza si hay cambios sin commitear**

```bash
git status
# si hay algo:
git add -A
git commit -m "chore: configuración de migraciones TypeORM completa"
```

---

## Referencia rápida — Flujo diario

```bash
# Después de modificar una entidad:
npm run migration:generate -- src/migrations/DescripcionDelCambio

# Revisar el archivo generado en src/migrations/
# Luego aplicarlo:
npm run migration:run

# Commitear entidad + migración juntos:
git add src/<entidad>.entity.ts src/migrations/<timestamp>-DescripcionDelCambio.ts
git commit -m "feat: <descripción del cambio de schema>"

# Si algo salió mal:
npm run migration:revert

# Ver estado de migraciones:
npm run migration:show
```
