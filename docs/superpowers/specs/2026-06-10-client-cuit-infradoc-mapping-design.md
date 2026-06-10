# Design: Client CUIT mapping desde InfraDoc

**Fecha:** 2026-06-10  
**Estado:** aprobado

## Contexto

El módulo de billing de InfraDoc (ITFlow) no está activado en la instancia de ONDRA, por lo que el campo `client_tax_id_number` siempre es nulo. ONDRA utiliza el campo `client_industry` para almacenar el CUIT de cada cliente.

El módulo Odoo ya implementa `syncPartners()` que matchea clientes por `taxIdNumber` (CUIT). Para que el match funcione, `taxIdNumber` debe poblarse desde la fuente correcta.

## Cambio

**Archivo:** `backend/src/clients/infradoc/infradoc.service.ts`  
**Método:** `mapClient()`

```ts
// Antes
taxIdNumber: (raw.client_tax_id_number as string) ?? null,

// Después
taxIdNumber: (raw.client_industry as string) ?? null,
```

No hay cambios en la entidad, migraciones, ni en `OdooService`.

## Flujo resultante

1. `POST /admin/clients/sync` → InfraDoc devuelve `client_industry` con el CUIT → se guarda en `clients.tax_id_number`
2. `POST /admin/odoo/sync/partners` → matchea `clients.tax_id_number` con `res.partner.vat` en Odoo → guarda `odoo_partner_id`

## Tests afectados

- `backend/src/clients/infradoc/infradoc.service.spec.ts`: actualizar fixture de mock para usar `client_industry` en lugar de `client_tax_id_number` en el caso que valida el mapeo de CUIT.
