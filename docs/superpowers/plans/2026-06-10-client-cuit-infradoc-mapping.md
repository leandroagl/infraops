# Client CUIT mapping desde InfraDoc — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leer el CUIT del cliente desde el campo `client_industry` de InfraDoc en lugar de `client_tax_id_number` (que requiere el módulo billing, no activado en ONDRA).

**Architecture:** Cambio puntual en `InfradocService.mapClient()`. No hay cambios de schema, migraciones ni en `OdooService`. El resto del flujo (sync de clientes → sync de Odoo partners) ya funciona correctamente.

**Tech Stack:** NestJS · Jest · TypeORM

---

## Archivos

- Modify: `backend/src/clients/infradoc/infradoc.service.ts` (método `mapClient`, línea 89)
- Modify: `backend/src/clients/infradoc/infradoc.service.spec.ts` (fixture `makeRaw` y nuevo test)

---

### Task 1: Test que verifica el mapeo de `client_industry` → `taxIdNumber`

**Files:**
- Modify: `backend/src/clients/infradoc/infradoc.service.spec.ts`

- [ ] **Step 1: Agregar `client_industry` al fixture `makeRaw` y quitar `client_tax_id_number`**

En `infradoc.service.spec.ts`, reemplazar el objeto de `makeRaw`:

```ts
const makeRaw = (override: Record<string, unknown> = {}) => ({
  client_id: '1',
  client_name: 'ACME Corp',
  client_abbreviation: 'ACME',
  client_type: 'Empresa',
  client_website: 'acme.com',
  client_referral: null,
  client_rate: null,
  client_currency_code: null,
  client_net_terms: null,
  client_industry: null,
  client_is_lead: '0',
  client_notes: null,
  client_archived_at: null,
  ...override,
});
```

- [ ] **Step 2: Agregar test que verifica que `client_industry` se mapea a `taxIdNumber`**

Agregar este test dentro del bloque `describe('InfradocService')`, después del test de `isActive`:

```ts
it('mapea client_industry a taxIdNumber', async () => {
  httpService.get.mockReturnValue(
    of(axiosRes({
      success: 'True',
      count: 1,
      data: [makeRaw({ client_industry: '20123456780' })],
    })),
  );

  const result = await service.getClients();

  expect(result[0].taxIdNumber).toBe('20123456780');
});
```

- [ ] **Step 3: Correr el test nuevo para verificar que falla**

```bash
cd backend && npx jest infradoc.service.spec --no-coverage
```

Resultado esperado: el test `mapea client_industry a taxIdNumber` falla con `Expected: "20123456780", Received: null`.

---

### Task 2: Implementación — leer desde `client_industry`

**Files:**
- Modify: `backend/src/clients/infradoc/infradoc.service.ts`

- [ ] **Step 1: Cambiar la línea de `taxIdNumber` en `mapClient()`**

En `infradoc.service.ts`, método `mapClient()`, reemplazar:

```ts
// Antes
taxIdNumber: (raw.client_tax_id_number as string) ?? null,
```

por:

```ts
// Después
taxIdNumber: (raw.client_industry as string) ?? null,
```

- [ ] **Step 2: Correr todos los tests del módulo clients**

```bash
cd backend && npx jest --testPathPattern="clients" --no-coverage
```

Resultado esperado: todos los tests pasan (incluido el nuevo).

- [ ] **Step 3: Commit**

```bash
git add backend/src/clients/infradoc/infradoc.service.ts \
        backend/src/clients/infradoc/infradoc.service.spec.ts
git commit -m "fix(clients): leer CUIT desde client_industry en lugar de client_tax_id_number"
```
