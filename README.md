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
| Producción | `main` | Dominio público, puerto 443 | Let's Encrypt |

**Ciclo de vida:**
```
feature/* → develop (test server) → main (producción)
```

Cada release a producción se tagea: `git tag v1.x && git push origin v1.x`

---

## Requisitos del servidor (test y producción)

```bash
# Ubuntu 22.04+ — instalar desde el repo oficial de Docker (no usar docker.io)
sudo apt update
sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
# Cerrar sesión y volver a entrar (o ejecutar newgrp docker) para que aplique el grupo
```

---

## Configuración inicial (ambos entornos)

```bash
git clone <repo-url> infraops
cd infraops

# Variables de entorno para docker-compose
cp .env.example .env
nano .env   # setear DB_PASSWORD (y SERVER_IP solo en producción)

# Variables del backend
cp backend/.env.example backend/.env
nano backend/.env   # setear DB_PASSWORD, JWT_SECRET y resto
```

### Variables requeridas

**`.env` (raíz):**

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_PASSWORD` | Password de PostgreSQL | cadena aleatoria larga |
| `SERVER_IP` | Solo producción: IP interna del servidor | `192.168.1.50` |

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
| `INFRADOC_URL` | URL base de InfraDoc (ej: `http://192.168.1.x`) — **requerido**, el backend crashea sin esto |
| `INFRADOC_API_KEY` | API key de InfraDoc — **requerido** |

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

### Crear usuario admin inicial

Solo la primera vez, una vez que el backend está corriendo:

```bash
docker compose exec backend node dist/scripts/seed-admin.js
```

Imprime el email y la contraseña generada. **Guardar la contraseña — no se vuelve a mostrar.**
El usuario tiene `mustChangePassword: true`, así que pedirá cambiarla al primer login.

### Scripts de base de datos

#### Limpiar tareas de un mes (reset-month)

Útil para deshacer una generación mensual en el servidor de pruebas.
Requiere `ALLOW_TASK_RESET=true` en `backend/.env` — **nunca habilitar en producción.**

```bash
# Dry-run: muestra cuántas tareas se borrarían (no borra nada)
docker compose exec backend node dist/scripts/reset-month.js --year=2026 --month=08

# Aplicar el borrado
docker compose exec backend node dist/scripts/reset-month.js --year=2026 --month=08 --confirm
```

> **Nota local (desarrollo):** `npm run db:reset-month` no pasa argumentos correctamente en PowerShell.
> Usar ts-node directamente desde `backend/`:
> ```powershell
> npx ts-node -r tsconfig-paths/register src/scripts/reset-month.ts --year=2026 --month=08 --confirm
> ```

### Actualizar

```bash
git pull
docker compose up --build -d
```

Las migraciones de base de datos corren automáticamente al reiniciar el backend.

---

## Producción

El dominio de producción es `infraops.ondra.com.ar`. HTTPS con certificado Let's Encrypt (renovación automática).

**Prerrequisito:** el dominio debe apuntar a la IP pública del servidor y los puertos 80 y 443 deben estar abiertos en el firewall/router.

---

### Primer deploy — obtener el certificado SSL

Let's Encrypt requiere que el servidor responda en el puerto 80 para validar el dominio. El proceso es en dos pasos para evitar el problema del huevo y la gallina (nginx no puede arrancar con SSL si el cert no existe todavía).

```bash
git checkout main

# Configurar .env
cp .env.example .env
nano .env
# Setear:
#   DB_PASSWORD=<contraseña segura>
#   DOMAIN=infraops.ondra.com.ar

# Configurar backend/.env
cp backend/.env.example backend/.env
nano backend/.env   # setear DB_PASSWORD, JWT_SECRET y demás

# Paso 1: levantar el stack en HTTP (sin prod overlay)
# nginx sirve /.well-known/acme-challenge/ para que certbot pueda validar
docker compose up --build -d

# Paso 2: obtener el cert con certbot (webroot, sin detener nginx)
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d infraops.ondra.com.ar \
  --email admin@ondra.com.ar \
  --agree-tos --no-eff-email

# Paso 3: reiniciar con el stack completo (HTTPS + renovación automática)
docker compose down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Verificar:

```bash
curl https://infraops.ondra.com.ar       # HTML del frontend
curl https://infraops.ondra.com.ar/api/  # respuesta del backend (401 o similar)
```

---

### Renovación automática

El servicio `certbot` del compose corre en loop y renueva el cert automáticamente cuando quedan menos de 30 días. Pero nginx necesita un restart para cargar el cert renovado.

Agregar al crontab del servidor:

```bash
# Ejecutar en el servidor (abre el editor de crontab)
crontab -e

# Agregar esta línea — reinicia nginx los domingos a las 3am
0 3 * * 0 cd /opt/infraops && docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend
```

---

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
- Puerto 80 sirve el ACME challenge de certbot y redirige todo lo demás a HTTPS
- Puerto 443 con TLS 1.2/1.3
- Certs desde `/etc/letsencrypt/live/${DOMAIN}/` (volumen compartido con el servicio certbot)

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

El cert del servidor dura 2 años. Al renovar (pasos 2 y 4 del setup), copiar los nuevos archivos al servidor y reiniciar nginx:

```bash
# Copiar los nuevos certs al servidor
scp infraops-server.crt infraops-server.key usuario@192.168.1.x:~/infraops/certs/

# Reiniciar nginx para cargar el nuevo cert (sin rebuild)
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend
```

---

## Pendiente (fuera de scope v1)

- Backups automáticos de la base de datos
- Monitoreo del servidor (uptime, alertas)
- CI/CD automatizado (GitHub Actions)
