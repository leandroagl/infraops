# InfraOps

Sistema de orquestación de trabajo técnico recurrente para **ONDRA MSP**.
Reemplaza planillas Excel para coordinar mantenimientos de servidores, visitas a clientes,
controles de UPS e inventario de parque informático.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS · TypeORM · PostgreSQL |
| Frontend | Angular 17 · Angular Material · Ag-Grid |
| Auth | JWT · Guards por rol |
| Tests | Jest (backend) · Karma/Jasmine (frontend) |

---

## Requisitos previos

- **Node.js** >= 20
- **npm** >= 10
- **Docker Desktop** (Windows) — para la base de datos
- **Angular CLI**: `npm install -g @angular/cli`

---

## Levantar el entorno de desarrollo

### 1. Base de datos (Docker)

Levantar un contenedor de PostgreSQL con volumen persistente:

```bash
docker run -d --name infraops-db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=infraops -p 5432:5432 -v infraops-db-data:/var/lib/postgresql/data postgres:15
```

Para detener / reiniciar el contenedor sin perder datos:

```bash
docker stop infraops-db
docker start infraops-db
```

### 2. Backend

```bash
cd backend

# Instalar dependencias
npm install

# Copiar variables de entorno y completarlas
cp .env.example .env
```

Editar `backend/.env` con los valores reales:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=infraops

JWT_SECRET=cadena_aleatoria_de_al_menos_32_caracteres

INFRADOC_URL=https://infradoc.ondra.com.ar
INFRADOC_API_KEY=tu_api_key
```

Levantar en modo watch (TypeORM sincroniza el schema automáticamente en desarrollo):

```bash
npm run start:dev
```

El backend queda en `http://localhost:3000`.

Opcionalmente, crear el usuario admin inicial:

```bash
npm run db:seed
```

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Levantar en modo desarrollo
npm start
```

El frontend queda en `http://localhost:4200` con proxy al backend configurado.

---

## Scripts útiles

### Backend (`backend/`)

| Comando | Descripción |
|---|---|
| `npm run start:dev` | Watch mode (recarga automática) |
| `npm run test` | Tests unitarios |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:cov` | Coverage |
| `npm run test:e2e` | Tests end-to-end |
| `npm run db:seed` | Crea usuario admin inicial |
| `npm run lint` | Lint + autofix |

### Frontend (`frontend/`)

| Comando | Descripción |
|---|---|
| `npm start` | Dev server en puerto 4200 |
| `npm test` | Tests con Karma |
| `npm run build` | Build de producción |

---

## Estructura del proyecto

```
infraops/
├── backend/        # NestJS API
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── clients/
│   │   ├── technicians/
│   │   ├── tasks/
│   │   ├── maintenance-logs/
│   │   └── common/
│   └── .env.example
├── frontend/       # Angular app
│   └── src/
├── docs/
│   ├── domain-model.md
│   ├── flows/
│   └── mockups/    # HTML de referencia visual
└── CLAUDE.md       # Guía de desarrollo para Claude Code
```

---

## Convenciones

- **Código:** inglés (variables, clases, archivos)
- **Docs y commits:** español
- **TDD obligatorio:** test antes que implementación
- **Un archivo a la vez:** confirmar antes de generar múltiples archivos

Ver [CLAUDE.md](CLAUDE.md) para el contexto completo del proyecto.
