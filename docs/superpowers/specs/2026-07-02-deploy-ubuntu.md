# Spec: Deploy en Ubuntu — Test y Producción

**Fecha:** 2026-07-02
**Estado:** borrador

---

## Objetivo

Definir cómo buildear y deployar InfraOps en servidores Ubuntu, con dos entornos diferenciados:

- **Test server** — acceso por IP, HTTP, branch `develop`
- **Prod server** — dominio propio, HTTPS (Let's Encrypt), branch `main` + tags

El deploy tiene que ser reproducible con un conjunto mínimo de comandos. Cualquier técnico del equipo debe poder actualizar cualquier entorno siguiendo el README.

---

## Arquitectura

Todo el stack corre en Docker Compose. No hay dependencias instaladas en el sistema operativo salvo `docker`, `docker compose` y `git`.

```
┌─────────────────────────────────────────┐
│  Ubuntu Server                          │
│                                         │
│  ┌──────────┐    ┌──────────────────┐   │
│  │  nginx   │───▶│    backend       │   │
│  │ :80/:443 │    │  NestJS :3000    │   │
│  │          │    └────────┬─────────┘   │
│  │ Angular  │             │             │
│  │  static  │    ┌────────▼─────────┐   │
│  │ + proxy  │    │   postgres :5432  │   │
│  └──────────┘    └──────────────────┘   │
│                                         │
│  (prod only)                            │
│  ┌──────────┐                           │
│  │ certbot  │  ← renueva certs SSL      │
│  └──────────┘                           │
└─────────────────────────────────────────┘
```

**Ruteo en nginx:**
- `GET /` y rutas Angular → sirve `index.html` (SPA fallback)
- `GET /assets/*`, `/favicon.ico`, etc. → archivos estáticos
- `GET /api/*` → reverse proxy hacia backend `:3000`

Esto elimina CORS: desde el browser todo va al mismo origen.

---

## Archivos a crear o modificar

```
infraops/
├── README.md                        ← nuevo (reemplaza el boilerplate de NestJS)
├── docker-compose.yml               ← actualizar: agregar servicio frontend/nginx
├── docker-compose.prod.yml          ← nuevo: override para HTTPS + certbot
├── frontend/
│   ├── Dockerfile                   ← nuevo: multi-stage (node build → nginx)
│   └── nginx.conf                   ← nuevo: config de nginx para el contenedor
└── backend/
    └── Dockerfile                   ← actualizar: convertir a multi-stage
```

---

## Dockerfiles

### Backend (multi-stage)

**Etapa 1 — build:** imagen Node completa, corre `npm ci` + `npm run build`.
**Etapa 2 — producción:** imagen Node slim, copia solo `dist/`, `collectors/`, `package*.json` (solo prod deps). Corre el entrypoint con migraciones.

El Dockerfile actual espera que `dist/` ya exista localmente. El multi-stage lo construye dentro de Docker, sin necesidad de buildear en Windows primero.

### Frontend (multi-stage)

**Etapa 1 — build:** imagen Node, corre `npm ci` + `ng build --configuration production`. Salida en `dist/frontend/browser/`.
**Etapa 2 — serve:** imagen `nginx:alpine`, copia los estáticos y el `nginx.conf`.

### nginx.conf

Un único archivo que:
- Sirve archivos estáticos de Angular con cache headers apropiados
- Aplica SPA fallback (`try_files $uri $uri/ /index.html`)
- Proxea `/api/` hacia `http://backend:3000/`
- En producción: redirige HTTP → HTTPS (manejado por docker-compose.prod.yml con server_name)

---

## docker-compose.yml (base — test server)

Servicios: `frontend` (nginx), `backend` (NestJS), `db` (postgres).

- `frontend` expone puerto `80`, depende de `backend`
- `backend` no expone puertos al host (solo interno, nginx lo alcanza por nombre de servicio)
- `db` persiste datos en volumen `pgdata`
- Variables sensibles via `backend/.env`

## docker-compose.prod.yml (override — producción)

Agrega sobre el base:
- Servicio `certbot` (imagen `certbot/certbot`)
- Volumen compartido `certbot-certs` entre `certbot` y `frontend`
- Volumen `certbot-www` para el challenge HTTP-01 de Let's Encrypt
- Puerto `443` mapeado en `frontend`
- Variable `DOMAIN` para que nginx sepa el `server_name`

En producción se levantan ambos archivos:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Flujo de primera vez en producción (HTTPS)

Let's Encrypt requiere que el servidor responda en el puerto 80 para validar el dominio. El nginx no puede tener SSL configurado hasta que exista el certificado. El orden es:

1. Levantar nginx **solo en HTTP** (config temporal sin SSL)
2. Correr Certbot en modo standalone o webroot para obtener el cert
3. Reemplazar nginx.conf con la versión HTTPS completa
4. Reiniciar nginx

El README documenta este flujo paso a paso con los comandos exactos.

**Renovación automática:** Certbot en modo `renew` + `--deploy-hook "docker compose restart frontend"`. Se puede configurar como cron en el host o como policy de restart en el compose.

---

## Gestión de versiones

| Rama | Entorno | Estrategia |
|---|---|---|
| `feature/*` | local | desarrollo |
| `develop` | test server | deploy manual en cada merge |
| `main` | prod | solo merges validados desde develop + tag vX.Y |

**Tag en cada release:**
```bash
git tag v1.2
git push origin v1.2
```

**Rollback en producción:**
```bash
git checkout v1.1
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
# si hubo migraciones de DB:
docker compose exec backend npm run migration:revert
```

---

## Variables de entorno

El archivo `backend/.env` no se commitea. Cada servidor tiene el suyo. El README documenta todas las variables requeridas con descripción y ejemplo (sin valores reales).

Variables mínimas esperadas:
- `DB_PASSWORD` — password de postgres
- `JWT_SECRET` — secreto para tokens JWT
- `PORT` — puerto del backend (default 3000)
- Cualquier otra que agregue el backend (integrations con Odoo, InfraDoc, etc.)

En producción se agrega:
- `DOMAIN` — dominio para el nginx y Certbot

---

## README — Estructura

```
# InfraOps

## ¿Qué es esto?
## Stack
## Entornos y ramas
## Requisitos del servidor
## Configuración inicial (.env)

## Test Server — Setup inicial
## Test Server — Actualizar

## Producción — Setup inicial
### Primer deploy (obtener certificado SSL)
### Configurar renovación automática
## Producción — Actualizar
## Producción — Rollback

## Nginx — Configuración
## Logs y troubleshooting
```

---

## Fuera de scope

- CI/CD automatizado (GitHub Actions, etc.) — queda para una iteración futura
- Monitoreo / alertas del servidor
- Backups de la base de datos (mencionarlo en README como pendiente)
- Múltiples instancias / balanceo de carga
