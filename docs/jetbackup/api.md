# JetBackup 5 — API usada por InfraOps

Resumen de lo que InfraOps consume de la API de JetBackup 5 (WHM/cPanel). Fuente oficial: <https://docs.jetbackup.com/v5.4/api/>. Los campos de respuesta de abajo están verificados contra el WHM de ONDRA (JetBackup 5.4.1.4, cPanel); lo que no está acá no se probó.

Implementación: `backend/src/integrations/jetbackup/jetbackup.service.ts`.
Configuración (URL, usuario, token cifrado): Admin → Integraciones → JetBackup.

## Conexión

| Dato | Valor |
|---|---|
| URL | `https://<host-whm>:2087/cgi/addons/jetbackup5/api.cgi` |
| Método | `POST` |
| Header | `Authorization: whm <usuario>:<token>` (token de WHM → Manage API Tokens) |
| Body | `function=<nombre>&<parámetros>` (form-encoded). También acepta JSON plano, p. ej. `{"function":"listBackupJobs"}` |
| Certificado | autofirmado → el cliente HTTP desactiva la verificación TLS |

Los parámetros anidados se mandan con corchetes, como `http_build_query`: `find[info.ID]=...`, `sort[start_time]=-1`. Los booleanos son `1`/`0`.

Todas las respuestas tienen el mismo envoltorio; el JSON de abajo se muestra abreviado:

```json
{ "success": 1, "message": "", "data": { }, "system": { "version": "5.4.1.4", "type": "cPanel" } }
```

`success: 0` indica error y `message` trae el motivo (ej. `No queue type provided`).

## Funciones usadas

### `listBackupJobs`

Sin parámetros. `data.jobs[]` con, entre otros:

| Campo | Uso |
|---|---|
| `_id` | Identificador del job (se guarda como `jobId`) |
| `name` | Nombre visible |
| `type` | `1` = backup de cuentas, `3` = backup de la configuración de JetBackup (se excluye del selector) |
| `disabled` | `0` / `1` |
| `running` | vacío cuando no corre |
| `last_run`, `last_completed`, `next_run` | fechas ISO 8601 (no se usan para el semáforo: se usa el log) |

> `type: 3` es una deducción a partir del job "JetBackup Config" del WHM de ONDRA; la doc no define los valores de `type`. Está en una constante en el servicio.

Cada job trae además `destination_details[]` con datos del destino (host, usuario, ruta). **No** se usa ni se guarda.

### `listLogs`

Una fila por ejecución. Parámetros usados:

| Parámetro | Valor | Para qué |
|---|---|---|
| `find[info.ID]` | `_id` del job | Filtrar por job |
| `find[Type]` | `1` | Solo ejecuciones de backup (también hay logs de restauración, destinos, etc.) |
| `sort[start_time]` | `-1` | Más reciente primero |
| `limit` | `1` | Solo la última |

Campos de cada log: `_id`, `start_time`, `end_time`, `execution_time` (segundos), `status`, `type`, `info` (`Backup`, `ID`, `Total Accounts`), `file`, `items`.

`status` observado en 117 logs: `1` (110 veces), `2` (5) y `4` (2). Los `2` y `4` eran de logs que **no** son de backup (`type` ≠ 1). Todavía no se vio un backup parcial o fallido, por lo que el significado de `status` para backups distinto de `1` no está confirmado.

### `listLogItems`

Parámetro: `log_id` (el `_id` del log). Devuelve `data.items[]`, uno por cuenta respaldada, con:

| Campo | Uso |
|---|---|
| `status` | `100` = completado correctamente (única escala vista; no es la de `listLogs`) |
| `message` | Texto de JetBackup (ej. `Backup completed successfully`). Se muestra en el detalle del job |
| `started`, `ended`, `execution_time` | tiempos de la cuenta |

### Funciones disponibles, no usadas todavía

- `listAlerts` / `getAlert`: alertas con título y mensaje. El mensaje de cierre incluye `Total Completed / Partial / Failed / Aborted`, útil para distinguir una ejecución parcial si hace falta (requiere parsear texto).
- `listQueueGroups`, `listQueueItems`: piden un `type` y un `queue group id` respectivamente; no se exploraron.
- `listAccounts`: cuentas cPanel (`username`, `domain`, `active`, `suspended`).

## Cómo se calcula el estado de un job en InfraOps

| Condición | Resultado |
|---|---|
| El job no existe en `listBackupJobs` | `Failed` — "El job ya no existe en JetBackup" |
| Sin logs de backup | sin resultado |
| Último log con `status = 1` | `Success` |
| Último log con otro `status` | `Failed` |
| `running` con valor | `isRunning` (no se marca desactualizado) |
| Fin del último log hace más de 30 h | `isStale` |

El mensaje es la unión de los `message` de los ítems cuyo `status` ≠ `100`; si todos terminaron bien, el primer mensaje disponible. Si falla la lectura de los ítems, el resultado se mantiene y el mensaje queda vacío.

## Reproducir consultas desde el WHM

```bash
jetbackup5api -F listBackupJobs
jetbackup5api -F listLogs -D "find[info.ID]=<jobId>&find[Type]=1&sort[start_time]=-1&limit=1"
jetbackup5api -F listLogItems -D "log_id=<logId>"
```
