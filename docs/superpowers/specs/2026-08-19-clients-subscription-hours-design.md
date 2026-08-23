# Diseño: Horas de suscripción en tabla de clientes

**Fecha:** 2026-08-19  
**Estado:** aprobado para implementación

---

## Contexto

La tabla de clientes (`/clients`) actualmente muestra solo nombre y dirección. Se agrega visibilidad de las horas mensuales del contrato de cada cliente, tomadas en tiempo real del módulo de suscripciones de Odoo. La dirección se elimina.

---

## Qué se construye

### Backend

**Nuevo método `OdooService.getSubscriptionHours`**

Firma:
```ts
getSubscriptionHours(partnerIds: number[]): Promise<{ partnerId: number; contracted: number; delivered: number }[]>
```

Estrategia: 2 llamadas a Odoo para todos los clientes en simultáneo (no N llamadas).

Llamada 1 — traer líneas de suscripción:
```
sale.order.line.search_read(
  domain=[
    ['order_id.partner_id', 'in', partnerIds],
    ['product_id.name', 'in', ['Hora Única', 'Hora Única Garantia']],
    ['order_id.state', 'in', ['sale', 'done']],
  ],
  fields=['product_uom_qty', 'qty_delivered', 'order_id']
)
```

Llamada 2 — resolver order_id → partner_id:
```
sale.order.read(
  ids=[...order_ids únicos del resultado anterior],
  fields=['partner_id']
)
```

Luego, agrupar por `partnerId` y sumar `product_uom_qty` y `qty_delivered` de las líneas de cada partner.

**No cachear:** `qty_delivered` cambia durante el mes; siempre ir a Odoo en vivo.

**Nuevo endpoint `GET /clients/subscription-hours`**

- Ubicación: `ClientsController`
- Guard: roles existentes (mismo acceso que `GET /clients`)
- Lógica:
  1. Traer todos los clientes activos con `odooPartnerId` no nulo
  2. Llamar a `odooService.getSubscriptionHours([...partnerIds])`
  3. Mapear `partnerId → clientId`
  4. Calcular `available = contracted - delivered`
- Respuesta:
```ts
{ clientId: string; contracted: number; delivered: number; available: number }[]
```
- Clientes sin `odooPartnerId` no aparecen en la respuesta (no hay datos disponibles).

### Frontend

**Carga paralela**

`ClientsListComponent` dispara `GET /clients` y `GET /clients/subscription-hours` en paralelo al inicializar. La tabla muestra los nombres de clientes apenas llega el primer response. Las horas se mergean al array local cuando llega el segundo, sin recargar (`tasks[idx] = { ...tasks[idx], hours }` — patrón de reactividad del proyecto).

**Columna eliminada:** `primaryAddress`

**Columna nueva: "Horas del mes"**

Celda con dos secciones:

1. Tres métricas en fila:
   - `Contratadas` — valor en `--tx-md`, label 9px uppercase
   - `Usadas` — valor coloreado por umbral (ver abajo), label 9px uppercase  
   - `Disponibles` — valor en `--tx-hi`, label 9px uppercase
   - Fuente de valores: `--font-mono`

2. Barra de progreso (4px alto) + porcentaje:
   - Track: `--elevated`
   - Fill coloreado por umbral
   - Porcentaje a la derecha en `--font-mono` 10px `--tx-lo`

**Umbrales de color:**

| Consumo         | Token       |
|-----------------|-------------|
| < 70%           | `--ok`      |
| 70% – 90%       | `--warn`    |
| > 90%           | `--crit`    |

El umbral aplica al color del valor "Usadas" y al fill de la barra.

**Estado skeleton:** mientras llegan las horas, la celda muestra tres bloques animados (shimmer) en lugar de los valores. El nombre del cliente ya es visible.

**Buscador:** se mueve al lado izquierdo del header (antes del título), sin cambios funcionales.

---

## Edge cases

| Caso | Comportamiento |
|---|---|
| `contracted = 0` | Mostrar `—` en los tres valores, sin barra. No dividir por cero. |
| `delivered > contracted` | Mostrar valores reales (available negativo se muestra como `0`), barra al 100% con color `--crit`. |

---

## Lo que NO cambia

- El endpoint `GET /clients` no se toca
- `resolveSaleLineId()` no se toca (sigue siendo el método para linkear tickets)
- No se cachea nada de Odoo en la base de datos de InfraOps

---

## Archivos afectados

| Archivo | Cambio |
|---|---|
| `backend/src/integrations/odoo/odoo.service.ts` | Nuevo método `getSubscriptionHours` |
| `backend/src/clients/clients.controller.ts` | Nuevo endpoint `GET /clients/subscription-hours` |
| `backend/src/clients/clients.module.ts` | Importar `OdooModule` si no está |
| `frontend/.../clients-list.component.ts` | Carga paralela, merge local de horas |
| `frontend/.../clients-list.component.html` | Quitar `primaryAddress`, agregar columna horas |
| `frontend/.../clients-list.component.scss` | Estilos de la celda de horas |

---

## Testing

- **Backend:** tests unitarios para `getSubscriptionHours` — mock de `callKw`, verificar agrupación y suma de líneas por partner, verificar que `available = contracted - delivered`
- **Backend:** test del endpoint — mock del service, verificar mapeo `partnerId → clientId`
- **Frontend:** test del componente — verificar que las dos llamadas se hacen en paralelo, que el merge actualiza el array local sin recargar, que el skeleton aparece antes de que lleguen las horas
