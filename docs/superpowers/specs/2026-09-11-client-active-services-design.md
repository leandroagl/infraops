# Diseño: Servicios contratados por cliente (Odoo Subscriptions)

**Fecha:** 2026-09-11
**Estado:** borrador — pendiente confirmar contra la instancia real de Odoo (ver "Abierto / a confirmar")

---

## Contexto

Hoy no hay forma técnica de ver qué servicios comerciales tiene contratados un cliente
(hosting, backup en la nube, planes de soporte, antivirus, etc.) sin entrar a Odoo y
revisar sus suscripciones una por una. Esa información se pierde en el día a día operativo.

Los servicios viven en el módulo **Subscriptions** de Odoo (v19). Un mismo cliente puede
tener varias suscripciones simultáneas, separadas por moneda (una en ARS con soporte
mensual y planes de hosting, otra en USD con backup en la nube y similares) — es un
detalle contable de Odoo, no algo que InfraOps deba reflejar.

Para esta primera versión, **no interesa** costo, moneda, ni fechas de renovación
(los servicios corren mes a mes por regla de negocio). Solo interesa: **qué servicios
tiene el cliente y si están al día o no**.

Un caso real detectado: cuando un cliente deja de pagar, Odoo lo refleja como
"cancelado" (`churn`), que en la práctica funciona como una pausa (puede reactivarse).
Por eso se decide mostrar el estado (activo / inactivo) en vez de ocultarlo.

`Client.odooPartnerId` (`backend/src/clients/client.entity.ts:63`) ya vincula cada
cliente de InfraOps con su partner de Odoo — es el mismo campo que usa
`OdooService.getSubscriptionHours`. No hace falta agregar nada al modelo de `Client`.

---

## Qué se construye

### Backend

**Nuevo método `OdooService.getActiveServices`**

Mismo patrón de 2 llamadas que `getSubscriptionHours` (`odoo.service.ts:270-325`):
no se puede pedir todo en un solo `search_read` porque `subscription_state` vive en
`sale.order`, no en `sale.order.line`.

Llamada 1 — líneas de las suscripciones de todos los clientes en simultáneo:
```ts
sale.order.line.search_read(
  domain=[
    ['order_id.partner_id', 'in', partnerIds],
    ['order_id.is_subscription', '=', true],
  ],
  fields=['product_id', 'order_id'],
)
```

Llamada 2 — resolver `order_id` → partner + estado:
```ts
sale.order.read(
  ids=[...order_ids únicos de la llamada 1],
  fields=['partner_id', 'subscription_state'],
)
```

Firma:
```ts
getActiveServices(
  partnerIds: number[],
): Promise<{ partnerId: number; productId: number; productName: string; active: boolean }[]>
```

Clasificación de estado (colapsado a binario, sin exponer el detalle de Odoo):

```ts
const ACTIVE_SUBSCRIPTION_STATES = ['3_progress']; // a confirmar contra la instancia real
// todo lo demás (paused, churn) => active: false
```

No se filtran estados `draft`/`renewal` a nivel de dominio — se excluyen directamente
en la query si `subscription_state` no está en `['3_progress', '4_paused', '6_churn']`,
para no mostrar como "inactivo" algo que en realidad nunca llegó a facturarse.

**Normalización de nombres — `service-product-display-names.ts`**

Mismo patrón que `task-description-defaults.ts` (constante, no tabla nueva en la DB —
son pocas excepciones, no ameritan una entidad):

```ts
export const SERVICE_PRODUCT_DISPLAY_NAME_OVERRIDES: Record<number, string> = {
  // completar con los product_id reales de Kaspersky una vez identificados
  // 4821: 'Kaspersky Endpoint Security',
};
```

Se aplica por `productId` (no por matcheo de texto sobre el nombre) para no depender
de que el código de producto tenga un formato reconocible.

**Nuevo método `OdooService.getClientActiveServices`**

Agrupa por cliente, dedupe por producto, aplica overrides de nombre:

```ts
export interface ClientServiceDto {
  name: string;
  active: boolean;
}

export class ClientActiveServicesDto {
  clientId: string;
  services: ClientServiceDto[];
}

getClientActiveServices(): Promise<ClientActiveServicesDto[]>
```

Lógica:
1. Traer clientes activos con `odooPartnerId` no nulo (mismo filtro que
   `getClientSubscriptionHours`).
2. Llamar `getActiveServices(partnerIds)`.
3. Agrupar por `partnerId` → `clientId`.
4. Dedupe por `(clientId, productId)`: si el mismo producto aparece en más de una
   línea/orden para el mismo cliente, `active = true` si **alguna** está activa.
5. Nombre mostrado: `SERVICE_PRODUCT_DISPLAY_NAME_OVERRIDES[productId] ?? productName`.

**No cachear:** mismo criterio que el resto de las integraciones con Odoo/InfraDoc —
se lee en vivo en cada request, nada se persiste en la DB de InfraOps.

**Nuevo endpoint — `ClientServicesController`**

Mismo patrón que `SubscriptionHoursController` (controller dedicado y chico, no
metido dentro de `ClientsController`):

```ts
@Controller('clients/services')
@UseGuards(JwtAuthGuard)
export class ClientServicesController {
  @Get()
  getAll(): Promise<ClientActiveServicesDto[]> {
    return this.odooService.getClientActiveServices();
  }
}
```

Un solo endpoint, sin parámetros. Alcanza tanto para el overview de un cliente
individual (el drawer ya tiene el array completo de clientes cargado por el padre,
según la regla de reactividad de estado del proyecto) como para el dashboard
agregado — que se arma **pivoteando esta misma respuesta en el frontend**, sin
endpoint nuevo: filas = cliente, columnas = servicio, sin volver a pedirle nada a Odoo.

### Frontend

**Nuevo modelo — `client.models.ts`**

```ts
export interface ClientService {
  name: string;
  active: boolean;
}

export interface ClientActiveServices {
  clientId: string;
  services: ClientService[];
}
```

**Presentación mínima (sin definir layout final — pendiente del mockup de tabs
del overview):**
- Por cliente: lista de chips, uno por servicio, coloreado por `active`
  (`--ok` / `--tx-lo` o similar — a definir junto con el resto del design system
  cuando se cierre el mockup).
- Dashboard agregado: se arma pivoteando el mismo array ya cargado, no requiere
  una segunda fuente de datos.

Esta parte se deja deliberadamente abierta: el spec cubre que el dato exista y
cómo se obtiene; dónde y cómo se ve dentro del overview se cierra cuando el mockup
de tabs esté definido.

---

## Edge cases

| Caso | Comportamiento |
|---|---|
| Cliente sin `odooPartnerId` | No aparece en la respuesta (mismo criterio que `subscription-hours`) |
| Cliente sin ninguna suscripción | `services: []` |
| Mismo producto en 2 líneas (ARS y USD) | Una sola entrada; `active` = OR de ambas |
| `subscription_state` en `draft`/`renewal` | La línea se excluye de la query, no aparece como servicio |
| Producto sin override de nombre | Se muestra `product_id[1]` tal cual viene de Odoo |

---

## Lo que NO cambia

- `Client.odooPartnerId` — se reutiliza, no se agrega ningún campo nuevo a `Client`.
- `getSubscriptionHours` / `getClientSubscriptionHours` — sin cambios, es una lectura independiente.
- No se cachea nada de Odoo en la base de InfraOps.
- No se expone costo, moneda, ni fecha de renovación en ningún punto de esta feature.

---

## Abierto / a confirmar (antes de implementar)

1. **Valores reales de `subscription_state`** en esta instancia de Odoo 19 — confirmar
   contra un caso real (ej. `fields_get` sobre `sale.order` o inspeccionar una
   suscripción conocida) antes de fijar `ACTIVE_SUBSCRIPTION_STATES`.
2. **Nombre exacto del campo `is_subscription`** en `sale.order` — verificar que
   sigue llamándose así en v19 y no cambió de ubicación/nombre.
3. **`product_id` reales de los productos Kaspersky** que muestran código en vez de
   nombre, para completar `SERVICE_PRODUCT_DISPLAY_NAME_OVERRIDES`.
4. **Ubicación final en la UI** — qué tab del overview de cliente y cómo se ve el
   dashboard agregado, pendiente del mockup en curso.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `backend/src/integrations/odoo/odoo.service.ts` | Agregar `getActiveServices`, `getClientActiveServices` |
| `backend/src/integrations/odoo/service-product-display-names.ts` | **Crear** — mapa de overrides |
| `backend/src/integrations/odoo/dto/client-active-services.dto.ts` | **Crear** — `ClientServiceDto`, `ClientActiveServicesDto` |
| `backend/src/integrations/odoo/client-services.controller.ts` | **Crear** |
| `backend/src/integrations/odoo/odoo-integration.module.ts` | Declarar `ClientServicesController` |
| `frontend/src/app/core/models/client.models.ts` | Agregar `ClientService`, `ClientActiveServices` |
| `frontend/src/app/features/clients/clients-list/clients-list.component.ts` | (o el componente de overview que resulte del mockup) consumir el endpoint |

---

## Testing

- **Backend `getActiveServices`:** mock de `callKw` — verificar las 2 llamadas
  (líneas → orders), verificar que solo entran estados relevantes al dominio.
- **Backend `getClientActiveServices`:** dedupe por `(clientId, productId)` con
  `active = OR`; aplicación del override de nombre cuando el `productId` está en
  el mapa; clientes sin `odooPartnerId` no aparecen.
- **Backend controller:** mock del service, verificar shape de la respuesta.
- **Frontend:** una vez definida la presentación, test de que los chips reflejan
  `active` y que el pivot del dashboard agrupa correctamente por servicio.
