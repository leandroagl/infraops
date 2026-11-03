# Alertas WAN de UniFi — Diseño

**Fecha:** 2026-10-23 · **Branch:** `feature/unifi-wan-alerts`

## Objetivo

Hoy el módulo Red (`/network`) solo alerta por dispositivos o consolas offline. Un corte de
WAN con failover (el gateway sigue online, el cliente sigue andando por WAN2) no se ve.
Se agregan alertas de WAN con el mismo tratamiento visual y el mismo flujo de ticket manual
que las alertas existentes. InfraOps solo visualiza; la acción es cargar el ticket.

## Fuente de datos (verificada contra la cuenta real, 2026-10-23)

`GET api.ui.com/ea/sites` (el mismo que ya consultamos) trae por site:

- `statistics.internetIssues[]`: entradas con `index` (bucket de 5 min desde epoch) y flags
  `wanDowntime`, `wan2FailoverActive`, `highLatency` (+ `latencyAvgMs`, `latencyMaxMs`),
  `notReported`, `count`.
- `statistics.counts`: `criticalNotification`, `offlineGatewayDevice`, `offlineDevice`, etc.

`statistics` viene por site, así que funciona también en hosts compartidos (UOS Server,
32 sites) sin depender de la API local. `/v1/sites` devuelve lo mismo que `/ea/sites`.

Caso real de referencia: Bonifacio UDM Pro, con `wanDowntime` + `wan2FailoverActive`.

## Alcance

| Evento | Condición | Severidad | `type` |
|---|---|---|---|
| Caída de WAN | alguna entrada con `wanDowntime: true` | `critical` | `wan_down` |
| Failover activo | alguna entrada con `wan2FailoverActive: true` y sin `wanDowntime` en el mismo incidente | `high` | `wan_failover` |

**Fuera de alcance (decidido):**
- `highLatency`: hay muchos sites con 10-25 ms que serían ruido.
- `criticalNotification`: sin `stat/alarm`/`stat/event` (404 en las versiones actuales de
  Network, tanto por el Cloud Connector como directo) no hay detalle de qué alarma es.
  Pendiente: probar `/v2/api/site/{site}/system-log/...` por POST.
- Persistencia: la alerta existe mientras la API la reporte (ventana móvil). Si nadie la ve
  en ese lapso se pierde, salvo que el cron de auto-ticket ya haya abierto ticket.

## Diseño

### Backend

- `UnifiService`: nuevo método que devuelve `hostId` + `statistics` por site (sin romper
  `getSiteHostMap`, que usa el resto del código).
- `UnifiAlertsService.getAlerts()`: además de dispositivos offline, genera alertas WAN por
  cada site habilitado.
- `AlertWithTicketDto.type` suma `wan_down | wan_failover`.
- **alertId:** `${hostId}:${siteId}:${type}:${index}` donde `index` es el del primer bucket
  del incidente. `internetIssues` es una ventana móvil: sin el `index`, un corte nuevo
  heredaría el ticket del anterior.
- `deviceName` / `deviceModel`: no aplican a WAN; se completan con el site/gateway cuando se
  conozca, o quedan vacíos. A definir en el plan.

### Frontend

- `AlertType` en `network.models.ts` suma los tipos nuevos.
- Etiquetas e íconos en el grid y el drawer. Sin componentes nuevos.

### Cron de auto-ticket

Sin cambios. Toma cualquier alerta de `getAlerts()` cuya severidad esté en la config
(`unifi_auto_config.severities`), por lo que las caídas de WAN abrirán ticket solas si el
auto-ticket está habilitado con `critical`.

## Comportamiento observado de `internetIssues` (2026-10-23, 55 sites)

- **No es una ventana corta**: es un historial de rachas. Cada entrada es `index` (inicio,
  bucket de 5 min) + `count` (cantidad de buckets; si falta, es 1). Hay entradas de hasta
  78 días de antigüedad (`notReported`, `count: 271`).
- Por eso **se filtra por recencia**: solo genera alerta una racha cuyo fin
  (`index + count`) caiga dentro de las últimas N horas. N es configurable; valor inicial a
  definir (propuesta: 24 h). Sin este filtro, un corte viejo quedaría como alerta para siempre.
- En Bonifacio, la racha de caída (`count: 3`) trae `wanDowntime` y `wan2FailoverActive` en
  la **misma entrada**; 15 min después hay otra entrada solo con failover. Un incidente puede
  producir dos entradas. Es un único caso observado.

## Decisiones

- **Antigüedad máxima (N): 24 h**, constante en código (no configurable desde Admin).
- **Una alerta por racha**: sin fusionar rachas contiguas. Un mismo corte puede verse como
  `wan_down` y luego `wan_failover`. Se revisa si en la práctica resulta ruidoso.
