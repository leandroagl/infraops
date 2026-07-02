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
