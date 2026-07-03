# Spec: Rediseño de filas de servidores Windows + columna Script Reinicio

**Fecha:** 2026-07-02
**Componente:** `maintenance-form` (formulario WINDOWS_DOMAIN_MAINTENANCE)

---

## Contexto

El formulario de mantenimiento Windows (`maintenance-form.component`) muestra la lista de servidores Windows en una tabla grilla clásica (header + rows con `grid-template-columns`). La sección de Veeam (`veeam-form`) usa un diseño de tarjetas con stripe lateral coloreado por estado, que resulta más legible y consistente con el design system.

Se aprobó migrar la lista de servidores Windows al mismo patrón visual que Veeam y agregar una nueva columna "Script reinicio" para registrar el estado del script de reinicio semanal programado (Task Scheduler de Windows).

---

## Cambios

### 1. Modelo de datos — `WindowsServerEntry`

Agregar campo `restartScript` a la interfaz existente:

```typescript
export interface WindowsServerEntry {
  serverId:      number;
  serverName:    string;
  updates:       'ok' | 'pending' | 'failed';
  restartScript: 'ok' | 'error' | 'no_task';
  notes?:        string;  // se elimina del formulario pero se mantiene en el modelo por compatibilidad
}
```

El campo `notes` se mantiene en el modelo para no romper payloads guardados, pero deja de aparecer en el formulario.

### 2. Formulario — `maintenance-form.component`

**Se elimina:**
- Diseño de tabla grilla (`.mf-srv-table`, `.mf-srv-head`, `.mf-srv-row` con grid)
- Expand panel por servidor (`.mf-expand-panel`, botón expand)
- Campo de notas individuales por servidor

**Se agrega:**
- Resumen de pills arriba de la lista: `X OK · X Advertencia · X Error`
- Lista de tarjetas estilo Veeam: una tarjeta por servidor
- Select "Script reinicio" por servidor

**Layout de cada tarjeta:**

```
[stripe 3px] | [nombre + IP (flex:1)] [Win Updates 110px] [Script reinicio 130px]
```

**Estructura HTML de cada tarjeta** (igual que `.vf-vm-row`):

```html
<div class="mf-srv-row" [ngClass]="'st-' + serverRowState(i)">
  <div class="mf-srv-stripe"></div>
  <div class="mf-srv-inner">
    <div class="mf-srv-name-cell">
      <span class="mf-srv-name">{{ vm.name }}</span>
      <span class="mf-srv-ip">{{ vm.ip ?? '—' }}</span>
    </div>
    <mat-form-field ... [ngClass]="selectClass(updates_value)">
      <!-- Win Updates select -->
    </mat-form-field>
    <mat-form-field ... [ngClass]="selectClass(restartScript_value)">
      <!-- Script reinicio select -->
    </mat-form-field>
  </div>
</div>
```

### 3. Estado del row (`serverRowState`)

Regla: el peor valor entre `updates` y `restartScript` determina el estado visual de la tarjeta.

| Condición | Estado | Visual |
|---|---|---|
| `failed` o `error` en cualquiera | `crit` | stripe rojo, border crit, fondo crit 5% |
| `pending` o `no_task` en cualquiera | `warn` | stripe amarillo, border warn, fondo warn 5% |
| Ambos `ok` | `ok` | stripe verde, border ok |

### 4. Coloring semántico de selects

Mismas clases CSS existentes (`.mf-sel--ok`, `.mf-sel--warn`, `.mf-sel--crit`):

| Valor | Clase |
|---|---|
| `ok` | `mf-sel--ok` |
| `pending` / `no_task` | `mf-sel--warn` |
| `failed` / `error` | `mf-sel--crit` |

### 5. Summary pills

Encima de la lista, tres pills mostrando conteo por estado (misma semántica que Veeam):

- `X OK` → `.p-ok` (verde) si X > 0
- `X Advertencia` → `.p-warn` (amarillo) si X > 0
- `X Error` → `.p-crit` (rojo) si X > 0

### 6. FormArray — campo nuevo

En `buildForm()`, cada grupo del array `servers` agrega `restartScript`:

```typescript
this.fb.group({
  updates:       ['ok'],
  restartScript: ['ok'],
  // notes eliminado del form
})
```

En `buildPayload()`, `restartScript` se incluye en cada `WindowsServerEntry`.

En `patchFormFromPayload()`, se restaura `restartScript` desde el payload guardado (default `'ok'` si no existe — compatibilidad con registros anteriores).

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `core/models/maintenance-log.models.ts` | Agregar `restartScript` a `WindowsServerEntry` |
| `maintenance-form.component.html` | Reemplazar sección servidores: tabla → tarjetas + pills |
| `maintenance-form.component.ts` | Agregar `restartScript` al form, helpers de estado, summary getters |
| `maintenance-form.component.scss` | Reemplazar estilos de tabla por estilos de tarjeta estilo Veeam |
| `maintenance-form.component.spec.ts` | Actualizar tests: nuevos controles, nuevos helpers |

---

## Fuera de scope

- No se modifican QNAP, Router, DC, ni ninguna otra sección del mismo formulario.
- No se agrega integración automática con Task Scheduler — el estado lo registra el técnico manualmente.
- El campo `notes` por servidor no se elimina del modelo ni del payload para mantener compatibilidad con logs existentes.
