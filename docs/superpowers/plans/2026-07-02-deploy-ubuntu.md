# Deploy Ubuntu — Test y Producción — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dockerizar el frontend Angular con nginx, actualizar docker-compose para cubrir el stack completo, y documentar el ciclo de deploy para test (HTTP/IP) y producción (HTTPS/dominio con Let's Encrypt).

**Architecture:** Tres servicios en Docker Compose: `frontend` (nginx sirve Angular estático y proxea `/api/` al backend), `backend` (NestJS, solo accesible internamente), `db` (PostgreSQL). Para producción se agrega un override (`docker-compose.prod.yml`) con Certbot y config HTTPS.

**Tech Stack:** Docker Compose, nginx:alpine, node:20-alpine, certbot/certbot, Angular 17 (application builder), NestJS.

## Global Constraints

- Frontend output path: `dist/frontend/browser/` (Angular 17 application builder crea subcarpeta `browser/`)
- API proxy: nginx stripea el prefijo `/api` — `/api/auth/login` → `http://backend:3000/auth/login` (sin cambios en el backend)
- `environment.ts` de producción ya tiene `apiUrl: '/api'` — no modificar
- Backend no expone puertos al host en ningún entorno
- Variables sensibles nunca se commitean — solo los `.example`
- Certs de Let's Encrypt se guardan en bind mount `./certbot/conf/` (no volumen Docker nombrado, para facilitar primer deploy)
- `docker-compose.yml` = test server; `docker-compose.yml + docker-compose.prod.yml` = producción

---

### Task 1: Root .gitignore, .env.example y backend/.env.example

**Files:**
- Create: `.gitignore` (raíz)
- Create: `.env.example` (raíz)
- Create: `backend/.env.example`

**Interfaces:**
- Produce: documentación de variables requeridas que usan Tasks 5 y 6

- [ ] **Step 1: Verificar variables actuales del backend**

Revisar `backend/src/database/data-source.ts` o `backend/src/app.module.ts` para confirmar los nombres exactos de las env vars de TypeORM (DB_HOST, DB_PORT, etc.) y ajustar `backend/.env.example` si difieren.

- [ ] **Step 2: Crear .gitignore en la raíz**

```
# Entornos
.env
backend/.env

# Certs Let's Encrypt (producción)
certbot/

# OS
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Crear .env.example en la raíz**

```
# Variables que docker-compose.yml necesita en el host

# Password de PostgreSQL (debe coincidir con DB_PASSWORD en backend/.env)
DB_PASSWORD=changeme_db_password

# Solo para producción: dominio donde correrá la app
# DOMAIN=infraops.tudominio.com
```

- [ ] **Step 4: Crear backend/.env.example**

```
# Base de datos (debe apuntar al servicio "db" del docker-compose)
DB_HOST=db
DB_PORT=5432
DB_NAME=infraops
DB_USER=infraops
DB_PASSWORD=changeme_db_password

# JWT
JWT_SECRET=changeme_usa_una_cadena_larga_y_aleatoria

# App
PORT=3000
NODE_ENV=production
```

- [ ] **Step 5: Verificar que los .gitignore existentes cubren node_modules y dist**

`backend/.gitignore` y `frontend/.gitignore` ya deben excluir `node_modules/` y `dist/`. Solo verificar, no modificar si ya está correcto.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .env.example backend/.env.example
git commit -m "chore: agregar .gitignore raíz y archivos .env.example"
```

---

### Task 2: Backend Dockerfile — multi-stage

**Files:**
- Modify: `backend/Dockerfile`
- Create: `backend/.dockerignore`

**Interfaces:**
- Consume: `backend/package*.json`, `backend/src/`, `backend/collectors/`, `backend/docker-entrypoint.sh`
- Produce: imagen Docker que compila TypeScript internamente y corre migraciones al iniciar

El Dockerfile actual espera que `dist/` ya exista en el host. El multi-stage lo compila dentro de Docker.

- [ ] **Step 1: Crear backend/.dockerignore**

```
node_modules
dist
.env
*.md
.git
test
```

- [ ] **Step 2: Reescribir backend/Dockerfile con dos stages**

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: producción
FROM node:20-alpine AS production
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir pyVmomi==8.0.3.0.1 --break-system-packages
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY collectors/ ./collectors/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

- [ ] **Step 3: Verificar que el build funciona localmente**

```bash
docker build -t infraops-backend ./backend
```

Resultado esperado: imagen creada sin errores. El stage builder compila TypeScript; el stage production solo copia los artefactos.

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat(deploy): backend Dockerfile multi-stage — build interno sin dist local"
```

---

### Task 3: Frontend Dockerfile + nginx.conf (HTTP)

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.dockerignore`

**Interfaces:**
- Consume: `frontend/package*.json`, `frontend/src/`, `frontend/angular.json`
- Produce: imagen nginx con Angular buildeado y config HTTP lista para test server

- [ ] **Step 1: Crear frontend/.dockerignore**

```
node_modules
dist
.env
*.md
.git
.angular
```

- [ ] **Step 2: Crear frontend/Dockerfile**

```dockerfile
# Stage 1: build Angular
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration production

# Stage 2: servir con nginx
FROM nginx:alpine
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

Nota: `dist/frontend/browser/` es el output del Angular 17 application builder (definido en `angular.json` como `outputPath: "dist/frontend"` — el builder agrega `browser/` automáticamente).

- [ ] **Step 3: Crear frontend/nginx.conf (config HTTP para test server)**

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Assets estáticos: cache agresivo (Angular genera hashes en los nombres)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API proxy: stripea /api/ y forwarda al backend interno
    # /api/auth/login → http://backend:3000/auth/login
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback: todas las rutas de Angular sirven index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 4: Verificar que el build funciona localmente**

```bash
docker build -t infraops-frontend ./frontend
```

Resultado esperado: imagen creada sin errores. Verificar que la etapa builder termina `ng build` exitosamente.

- [ ] **Step 5: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore
git commit -m "feat(deploy): frontend Dockerfile multi-stage con nginx HTTP"
```

---

### Task 4: nginx-prod.conf.template (HTTPS para producción)

**Files:**
- Create: `frontend/nginx-prod.conf.template`

**Interfaces:**
- Consume: variable de entorno `${DOMAIN}` (inyectada por docker-compose.prod.yml)
- Produce: config nginx con HTTPS + redirección HTTP→HTTPS + webroot para renovación de certs

El nginx oficial soporta templates en `/etc/nginx/templates/` — archivos `.conf.template` reciben `envsubst` automáticamente al iniciar el contenedor. Este archivo se monta vía volume override en docker-compose.prod.yml, reemplazando el `default.conf` bakeado en la imagen.

- [ ] **Step 1: Crear frontend/nginx-prod.conf.template**

```nginx
# Bloque HTTP: solo para ACME challenge (renovación) y redirect a HTTPS
server {
    listen 80;
    server_name ${DOMAIN};

    # Webroot para certbot --renew
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# Bloque HTTPS
server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    root /usr/share/nginx/html;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # API proxy: stripea /api/ y forwarda al backend interno
    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/nginx-prod.conf.template
git commit -m "feat(deploy): nginx template HTTPS con Let's Encrypt para producción"
```

---

### Task 5: docker-compose.yml — agregar frontend, ajustar backend

**Files:**
- Modify: `docker-compose.yml`

**Interfaces:**
- Consume: imágenes de Tasks 2 y 3, `.env` raíz con `DB_PASSWORD`
- Produce: stack completo para test server (HTTP, sin certbot)

- [ ] **Step 1: Reescribir docker-compose.yml**

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    env_file: ./backend/.env
    depends_on:
      - db

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: infraops
      POSTGRES_USER: infraops
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Cambios respecto al original:
- Se agrega servicio `frontend`
- Se elimina `ports: "3000:3000"` del backend (ya no expuesto al host)

- [ ] **Step 2: Verificar stack de test server localmente**

Requiere tener `backend/.env` con valores válidos y un `.env` raíz con `DB_PASSWORD`.

```bash
# Crear .env raíz si no existe
cp .env.example .env
# Editar con valores locales de prueba (no reales)

docker compose up --build -d
```

Esperar ~30 segundos (migraciones de DB) y luego verificar:

```bash
# Verifica que nginx sirve el frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost
# Esperado: 200

# Verifica que el proxy /api funciona
curl -s -o /dev/null -w "%{http_code}" http://localhost/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test","password":"test"}'
# Esperado: 401 (backend responde — credenciales inválidas es ok, prueba que el proxy funciona)
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(deploy): docker-compose agrega frontend nginx, backend sin puerto expuesto"
```

---

### Task 6: docker-compose.prod.yml — HTTPS + Certbot

**Files:**
- Create: `docker-compose.prod.yml`

**Interfaces:**
- Consume: `frontend/nginx-prod.conf.template` (Task 4), bind mounts `./certbot/`, variable `DOMAIN` del `.env` raíz
- Produce: override para producción con HTTPS y renovación automática de certs

- [ ] **Step 1: Crear docker-compose.prod.yml**

```yaml
services:
  frontend:
    environment:
      - DOMAIN=${DOMAIN}
    volumes:
      # Reemplaza el nginx.conf bakeado en la imagen con la versión HTTPS
      - ./frontend/nginx-prod.conf.template:/etc/nginx/templates/default.conf.template:ro
      # Certs de Let's Encrypt (generados en el primer deploy)
      - ./certbot/conf:/etc/letsencrypt:ro
      # Webroot para renovación automática
      - ./certbot/www:/var/www/certbot:ro
    ports:
      # Solo se agrega 443 — el 80:80 viene del docker-compose.yml base
      # Docker Compose fusiona listas de ports, no las reemplaza
      - "443:443"

  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    # Renueva cada 12 horas; certbot solo actúa cuando quedan < 30 días
    entrypoint: >
      /bin/sh -c "trap exit TERM;
      while :; do
        certbot renew --webroot -w /var/www/certbot --quiet;
        sleep 12h & wait $${!};
      done"
```

Nota: Docker Compose fusiona (no reemplaza) las listas de `ports` al combinar archivos. El resultado final tendrá `80:80` (del base) + `443:443` (del override) = ambos puertos mapeados correctamente.

- [ ] **Step 2: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "feat(deploy): docker-compose.prod.yml con HTTPS y Certbot para producción"
```

---

### Task 7: README.md

**Files:**
- Create: `README.md` (raíz del proyecto)

**Interfaces:**
- Consume: todo lo anterior
- Produce: documentación completa de deploy para ambos entornos

- [ ] **Step 1: Crear README.md**

```markdown
# InfraOps

Sistema de orquestación de trabajo interno de ONDRA. Reemplaza planillas Excel para coordinar tareas técnicas recurrentes: mantenimientos de servidores, visitas a clientes, controles de UPS y antivirus, inventario de parque.

## Stack

- **Backend:** NestJS · TypeORM · PostgreSQL
- **Frontend:** Angular 17
- **Infraestructura:** Docker Compose · nginx

## Entornos y ramas

| Entorno | Rama | Acceso | SSL |
|---|---|---|---|
| Local (desarrollo) | `feature/*` | `localhost:4200` / `localhost:3000` | No |
| Test | `develop` | IP del servidor, puerto 80 | No |
| Producción | `main` | Dominio propio, puerto 443 | Let's Encrypt |

**Ciclo de vida:**
```
feature/* → develop (test server) → main (producción)
```

Cada release a producción se tagea: `git tag v1.x && git push origin v1.x`

---

## Requisitos del servidor (test y producción)

```bash
# Ubuntu 22.04+
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
# Cerrar sesión y volver a entrar para que aplique el grupo
```

---

## Configuración inicial (ambos entornos)

```bash
git clone <repo-url> infraops
cd infraops

# Variables de entorno para docker-compose
cp .env.example .env
nano .env   # setear DB_PASSWORD (y DOMAIN solo en producción)

# Variables del backend
cp backend/.env.example backend/.env
nano backend/.env   # setear DB_PASSWORD, JWT_SECRET y resto
```

### Variables requeridas

**`.env` (raíz):**

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_PASSWORD` | Password de PostgreSQL | cadena aleatoria larga |
| `DOMAIN` | Solo producción: dominio de la app | `infraops.tudominio.com` |

**`backend/.env`:**

| Variable | Descripción |
|---|---|
| `DB_HOST` | Nombre del servicio DB en compose (`db`) |
| `DB_PORT` | Puerto PostgreSQL (`5432`) |
| `DB_NAME` | Nombre de la base (`infraops`) |
| `DB_USER` | Usuario PostgreSQL (`infraops`) |
| `DB_PASSWORD` | Debe coincidir con el `.env` raíz |
| `JWT_SECRET` | Secreto para tokens JWT |
| `PORT` | Puerto del backend (`3000`) |

---

## Test Server

### Setup inicial

```bash
git checkout develop
docker compose up --build -d
```

La primera vez tarda más (compila Angular + TypeScript + corre migraciones).

Verificar que está corriendo:

```bash
docker compose ps
curl http://localhost       # debe devolver HTML del frontend
curl http://localhost/api/  # debe responder (401 o similar, no 502)
```

La app queda disponible en `http://<IP-del-servidor>`.

### Actualizar

```bash
git pull
docker compose up --build -d
```

Las migraciones de base de datos corren automáticamente al reiniciar el backend.

---

## Producción

### Setup inicial (primera vez)

**Prerequisito:** el dominio debe apuntar a la IP del servidor antes de este paso.

```bash
git checkout main

# 1. Configurar .env con DOMAIN=infraops.tudominio.com
nano .env

# 2. Crear directorios para los certs
mkdir -p certbot/conf certbot/www

# 3. Obtener certificado (nginx NO debe estar corriendo)
docker run --rm \
  -p 80:80 \
  -v $(pwd)/certbot/conf:/etc/letsencrypt \
  certbot/certbot certonly --standalone \
  --email admin@ondra.com \
  --agree-tos \
  --no-eff-email \
  -d $(grep ^DOMAIN .env | cut -d= -f2)

# 4. Levantar el stack completo con HTTPS
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Verificar:

```bash
curl https://infraops.tudominio.com       # HTML del frontend
curl https://infraops.tudominio.com/api/  # respuesta del backend
```

### Configurar renovación automática de certificados

Los certs de Let's Encrypt duran 90 días. El contenedor `certbot` intenta renovar cada 12 horas automáticamente. Sin embargo, nginx necesita reiniciarse para cargar el nuevo cert.

Agregar este cron en el servidor (como el usuario que corre docker):

```bash
crontab -e
```

```
# Reinicia nginx los domingos a medianoche para cargar certs renovados
0 0 * * 0 cd /ruta/a/infraops && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend
```

### Actualizar

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Antes de actualizar producción, siempre validar primero en el test server.

### Rollback

```bash
# Ver versiones disponibles
git tag

# Volver a una versión anterior
git checkout v1.1
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

Si la versión anterior tenía migraciones de base de datos diferentes:

```bash
docker compose exec backend npm run migration:revert
```

Ejecutar una vez por cada migración a revertir.

---

## Nginx — Configuración

### Test server (HTTP)

La configuración está en `frontend/nginx.conf` y se incluye en la imagen al buildear. No requiere intervención en el servidor.

Comportamiento:
- `/` → sirve `index.html` de Angular (con SPA fallback para rutas del router)
- `/assets/*`, `*.js`, `*.css` → archivos estáticos con cache largo
- `/api/*` → proxy hacia `http://backend:3000/` (el prefijo `/api` se stripea)

### Producción (HTTPS)

La configuración en `frontend/nginx-prod.conf.template` se monta sobre la imagen vía volume override en `docker-compose.prod.yml`. El contenedor aplica `envsubst` automáticamente reemplazando `${DOMAIN}`.

Comportamiento adicional:
- Puerto 80 redirige a HTTPS (excepto el endpoint `/.well-known/acme-challenge/` para renovación)
- Puerto 443 con TLS 1.2/1.3
- Certs desde `/etc/letsencrypt/live/${DOMAIN}/`

Para modificar la configuración de nginx en producción:

```bash
# Editar el template
nano frontend/nginx-prod.conf.template

# Reiniciar nginx (sin rebuild de imagen)
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend
```

---

## Logs y troubleshooting

```bash
# Ver logs de todos los servicios
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f backend
docker compose logs -f frontend

# Estado de los contenedores
docker compose ps

# Entrar al contenedor del backend
docker compose exec backend sh

# Ver logs de nginx (accesos)
docker compose exec frontend cat /var/log/nginx/access.log

# Correr migraciones manualmente
docker compose exec backend npm run migration:run:prod

# Ver migraciones aplicadas
docker compose exec backend npm run migration:show
```

### El backend no levanta

1. Verificar logs: `docker compose logs backend`
2. Verificar que `backend/.env` existe y tiene todas las variables
3. Verificar que la DB está up: `docker compose ps db`
4. Verificar conexión: `docker compose exec backend sh -c "nc -zv db 5432"`

### nginx devuelve 502 Bad Gateway en `/api/`

El backend no está respondiendo. Verificar:

```bash
docker compose ps backend
docker compose logs backend
```

### Certificado SSL vencido

```bash
# Forzar renovación manual
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec certbot \
  certbot renew --force-renewal --webroot -w /var/www/certbot

# Reiniciar nginx para cargar el nuevo cert
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend
```

---

## Pendiente (fuera de scope v1)

- Backups automáticos de la base de datos
- Monitoreo del servidor (uptime, alertas)
- CI/CD automatizado (GitHub Actions)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README con instrucciones completas de deploy test y producción"
```

---

## Verificación final

Una vez completas todas las tareas, el estado esperado del repo es:

```
infraops/
├── .gitignore              ✅ nuevo
├── .env.example            ✅ nuevo
├── README.md               ✅ nuevo
├── docker-compose.yml      ✅ actualizado (agrega frontend)
├── docker-compose.prod.yml ✅ nuevo (HTTPS + certbot)
├── backend/
│   ├── .dockerignore       ✅ nuevo
│   ├── .env.example        ✅ nuevo
│   └── Dockerfile          ✅ actualizado (multi-stage)
└── frontend/
    ├── .dockerignore       ✅ nuevo
    ├── Dockerfile          ✅ nuevo
    ├── nginx.conf          ✅ nuevo (HTTP, test server)
    └── nginx-prod.conf.template  ✅ nuevo (HTTPS, producción)
```

**Smoke test del test server completo:**

```bash
docker compose up --build -d
# Esperar ~60s
docker compose ps   # todos "Up"
curl http://localhost                          # 200 + HTML Angular
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a","password":"b"}'           # 401 (proxy funciona)
docker compose down
```
