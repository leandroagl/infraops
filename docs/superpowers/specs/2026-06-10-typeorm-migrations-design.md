# TypeORM Migrations — Diseño

**Fecha:** 2026-06-10
**Estado:** aprobado

## Contexto

El proyecto usa `synchronize: true` en desarrollo y `synchronize: false` en producción.
Esto genera riesgo de divergencia entre entornos y no deja trazabilidad de los cambios de schema.
El objetivo es reemplazar el auto-sync por migraciones TypeORM en todos los entornos.

## Decisiones tomadas

- Migraciones activas en **todos los entornos** (dev, staging, prod) — mismo flujo, sin sorpresas al deployar.
- Las migraciones corren **automáticamente al arrancar el contenedor** Docker, antes de iniciar la app.
- Enfoque: **ts-node + tsconfig separado** para el CLI, usando `typeorm-ts-node-commonjs`.

## Archivos a crear / modificar

### Nuevos

```
backend/
├── src/
│   ├── database/
│   │   └── data-source.ts          ← DataSource para TypeORM CLI
│   └── migrations/                 ← carpeta de archivos de migración generados
├── tsconfig.migrations.json        ← override commonjs para typeorm CLI
└── docker-entrypoint.sh            ← entrypoint que corre migration:run antes de la app
```

### Modificados

- `backend/package.json` — agregar 4 scripts de migración
- `backend/src/app.module.ts` — `synchronize: false` fijo + `migrations` path

## data-source.ts

Carga las variables de entorno con `dotenv` directamente (sin NestJS).
Exporta un `DataSource` con las mismas entidades que `AppModule`.

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

Concatenación directa en lugar de `path.join` para evitar que en Windows los separadores `\` rompan los glob patterns que TypeORM procesa internamente. Con `__dirname + '/../'`, cuando ts-node corre desde `src/database/` apunta a `src/`; cuando corre el compilado desde `dist/database/` apunta a `dist/`.

## tsconfig.migrations.json

Extiende `tsconfig.json` y overridea solo lo necesario para que `typeorm-ts-node-commonjs` funcione:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node"
  }
}
```

## Scripts npm

Requiere `cross-env` como devDependency (compatibilidad Windows PowerShell / bash):

```json
"migration:generate": "cross-env TS_NODE_PROJECT=tsconfig.migrations.json typeorm-ts-node-commonjs -d src/database/data-source.ts migration:generate",
"migration:run":      "cross-env TS_NODE_PROJECT=tsconfig.migrations.json typeorm-ts-node-commonjs -d src/database/data-source.ts migration:run",
"migration:revert":   "cross-env TS_NODE_PROJECT=tsconfig.migrations.json typeorm-ts-node-commonjs -d src/database/data-source.ts migration:revert",
"migration:show":     "cross-env TS_NODE_PROJECT=tsconfig.migrations.json typeorm-ts-node-commonjs -d src/database/data-source.ts migration:show"
```

**Uso para generar una migración:**
```bash
npm run migration:generate -- src/migrations/NombreDeLaMigracion
```

El nombre de la migración se pasa como argumento posicional al final del comando.

**En producción** (`migration:run` en Docker), TypeORM corre sobre los `.js` compilados en `dist/`.
Para eso, el script de producción usa la versión compilada del `data-source`:

```json
"migration:run:prod": "typeorm -d dist/database/data-source.js migration:run"
```

## docker-entrypoint.sh

```bash
#!/bin/sh
set -e

echo "Corriendo migraciones..."
npm run migration:run:prod

echo "Iniciando aplicación..."
exec node dist/main
```

El `set -e` asegura que si las migraciones fallan, el contenedor no arranca — comportamiento deseado.

## AppModule

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

`synchronize` pasa a `false` fijo — ya no hay condición por `NODE_ENV`.

## Migración inicial

Después de configurar todo, se genera una migración inicial que captura el estado actual del schema:

```bash
npm run migration:generate -- src/migrations/InitialSchema
```

Esta migración se commitea junto con la configuración.
En una DB nueva (primer deploy), `migration:run` crea todas las tablas desde cero.
En una DB existente (la actual de dev), `migration:run` no hace nada porque las tablas ya existen — TypeORM detecta que el schema coincide.

## Flujo diario en desarrollo

1. Modificar una entidad
2. `npm run migration:generate -- src/migrations/DescripcionDelCambio`
3. Revisar el archivo generado en `src/migrations/`
4. `npm run migration:run`
5. Commitear entidad + archivo de migración juntos

## Flujo en producción (Docker)

1. `docker compose pull` / `docker compose build`
2. `docker compose up -d` — el entrypoint corre `migration:run:prod` automáticamente antes de arrancar la app
