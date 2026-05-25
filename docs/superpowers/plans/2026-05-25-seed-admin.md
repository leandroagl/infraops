# Seed Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el script `npm run db:seed` que genera el primer usuario ADMIN con contraseña aleatoria mostrada una sola vez en consola.

**Architecture:** Script standalone que crea un `DataSource` de TypeORM directamente (sin levantar NestJS), verifica si ya existe un ADMIN (idempotente), y si no existe crea el usuario con contraseña generada criptográficamente.

**Tech Stack:** TypeORM DataSource · bcrypt · Node.js crypto · ts-node · dotenv

---

## Archivos

| Acción | Archivo |
|---|---|
| Crear | `backend/src/common/utils/password.util.ts` |
| Crear | `backend/src/common/utils/password.util.spec.ts` |
| Crear | `backend/src/scripts/seed-admin.ts` |
| Modificar | `backend/package.json` |

**Contexto del proyecto:**
- `backend/src/users/user.entity.ts` — entidad User con campos: `id`, `email`, `passwordHash`, `role`, `mustChangePassword`, `isActive`, `lastLogoutAt`, `createdAt`
- `backend/src/users/user-role.enum.ts` — `UserRole.ADMIN | TL | TECHNICIAN | COORDINATOR`
- TypeORM 0.3.x, NestJS 11, PostgreSQL

---

## Task 1: Utilidad `generateRandomPassword()`

**Files:**
- Create: `backend/src/common/utils/password.util.spec.ts`
- Create: `backend/src/common/utils/password.util.ts`

- [ ] **Step 1: Crear el archivo de test**

Crear `backend/src/common/utils/password.util.spec.ts`:

```typescript
import { generateRandomPassword } from './password.util';

describe('generateRandomPassword', () => {
  it('generates a password of exactly 12 characters', () => {
    expect(generateRandomPassword()).toHaveLength(12);
  });

  it('contains at least one uppercase letter', () => {
    expect(/[A-Z]/.test(generateRandomPassword())).toBe(true);
  });

  it('contains at least one number', () => {
    expect(/[0-9]/.test(generateRandomPassword())).toBe(true);
  });

  it('contains at least one special character', () => {
    expect(/[!@#$%^&*()\-_=+]/.test(generateRandomPassword())).toBe(true);
  });

  it('generates different passwords on consecutive calls', () => {
    const p1 = generateRandomPassword();
    const p2 = generateRandomPassword();
    expect(p1).not.toBe(p2);
  });
});
```

- [ ] **Step 2: Verificar que el test falla**

```bash
cd backend && npx jest password.util.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './password.util'`

- [ ] **Step 3: Implementar `generateRandomPassword()`**

Crear `backend/src/common/utils/password.util.ts`:

```typescript
import crypto from 'crypto';

export function generateRandomPassword(): string {
  const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower   = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()-_=+';
  const all     = upper + lower + numbers + special;

  const mandatory = [
    upper[crypto.randomInt(upper.length)],
    numbers[crypto.randomInt(numbers.length)],
    special[crypto.randomInt(special.length)],
  ];

  const rest = Array.from({ length: 9 }, () => all[crypto.randomInt(all.length)]);

  const combined = [...mandatory, ...rest];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
cd backend && npx jest password.util.spec.ts --no-coverage
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/common/utils/password.util.ts src/common/utils/password.util.spec.ts
git commit -m "feat(common): utilidad generateRandomPassword con tests"
```

---

## Task 2: Script de seed y npm script

**Files:**
- Create: `backend/src/scripts/seed-admin.ts`
- Modify: `backend/package.json`

> **Nota:** Este script no tiene tests unitarios. Es una secuencia lineal sobre primitivas ya testeadas (TypeORM, bcrypt, `generateRandomPassword`). La verificación es ejecutarlo contra una base de datos real.

- [ ] **Step 1: Crear el script de seed**

Crear `backend/src/scripts/seed-admin.ts`:

```typescript
import 'reflect-metadata';
import { config } from 'dotenv';
config();

import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { generateRandomPassword } from '../common/utils/password.util';

const SEED_EMAIL = 'admininfraops@ondra.com.ar';

async function seed(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'infraops',
    entities: [User],
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    const userRepository = dataSource.getRepository(User);

    const existing = await userRepository.findOne({
      where: { role: UserRole.ADMIN },
    });

    if (existing) {
      process.stdout.write('El usuario admin ya existe. Seed omitido.\n');
      return;
    }

    const plainPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const admin = userRepository.create({
      email: SEED_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
      mustChangePassword: true,
      isActive: true,
    });

    await userRepository.save(admin);

    process.stdout.write('\n─────────────────────────────────────────────\n');
    process.stdout.write('Usuario admin creado:\n');
    process.stdout.write(`  Email:      ${SEED_EMAIL}\n`);
    process.stdout.write(`  Contraseña: ${plainPassword}\n`);
    process.stdout.write('  Guardá esta contraseña — no se volverá a mostrar.\n');
    process.stdout.write('─────────────────────────────────────────────\n\n');
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err: unknown) => {
  process.stderr.write(`Error en seed: ${String(err)}\n`);
  process.exit(1);
});
```

- [ ] **Step 2: Agregar el script npm**

En `backend/package.json`, dentro de `"scripts"`, agregar después de `"test:e2e"`:

```json
"db:seed": "ts-node -r tsconfig-paths/register src/scripts/seed-admin.ts"
```

El bloque `scripts` completo queda:

```json
"scripts": {
  "build": "nest build",
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod": "node dist/main",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e": "jest --config ./test/jest-e2e.json",
  "db:seed": "ts-node -r tsconfig-paths/register src/scripts/seed-admin.ts"
},
```

- [ ] **Step 3: Verificar que el test suite general sigue pasando**

```bash
cd backend && npx jest --no-coverage
```

Expected: todos los tests pasan (el spec de password.util + los 21 tests de auth)

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/scripts/seed-admin.ts package.json
git commit -m "feat(scripts): seed del usuario admin inicial"
```

---

## Uso post-instalación

```bash
# Con .env en el directorio backend/:
cd backend
npm run db:seed

# Sin .env (env vars ya exportadas en el shell):
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=secret DB_NAME=infraops npm run db:seed
```

El script es idempotente — ejecutarlo cuando ya existe un ADMIN imprime el mensaje de omisión y termina sin modificar nada.
