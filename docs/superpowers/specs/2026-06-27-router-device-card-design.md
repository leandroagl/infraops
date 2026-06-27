# Router Device Card — Design Spec
**Fecha:** 2026-06-27

## Contexto

El `RouterFormComponent` actualmente renderiza cada router con una card inline simple (dot de color + nombre/IP + checkboxes planos). El patrón aprobado en el proyecto es el de `QnapDeviceCardComponent`: card extraída a subcomponente con header/body separados, secciones con `mf-section-lbl`, y layout de campos en filas temáticas.

Este spec define la extracción del card de router al mismo patrón visual y estructural.

---

## Decisiones de diseño

- **Sin badge en el header:** los campos del router son booleanos/string, no hay un "estado de salud" derivable que justifique un badge semántico en el header.
- **Componente extraído:** `RouterDeviceCardComponent` vive dentro de `router-form/router-device-card/`, igual que `qnap-device-card/` dentro de `qnap-form/`.
- **Dos secciones:** "Firmware" y "Configuración" — separan conceptualmente las acciones de actualización de las de backup.

---

## Estructura de archivos

```
router-form/
├── router-form.component.ts        (existente — agregar getRouterGroup())
├── router-form.component.html      (simplificado: stack de app-router-device-card)
├── router-form.component.scss      (simplificado: solo .rf-devices-stack)
├── router-form.component.spec.ts   (existente)
└── router-device-card/
    ├── router-device-card.component.ts
    ├── router-device-card.component.html
    ├── router-device-card.component.scss
    └── router-device-card.component.spec.ts
```

---

## Inputs del componente

```typescript
@Input() device!: InfraAsset;   // name, ip
@Input() group!: FormGroup;     // firmwareUpdated, firmwareVersion, backupDone
@Input() readOnly = false;
```

No hay Outputs — el `FormGroup` es reactivo, los cambios se propagan al form padre directamente.

---

## Template HTML

```
┌─────────────────────────────────────────┐  mf-cl-rpt
│  [nombre]                               │  header: background elevated
│  [ip]                                   │  separador inferior
├─────────────────────────────────────────┤
│  FIRMWARE ─────────────────────────     │  mf-section-lbl
│  ┌─────────────────────┐ [✓ Actualiz]  │  grid 1fr auto
│  │ Versión instalada   │               │
│  └─────────────────────┘               │
│  ┌─────────────────────────────────┐   │  condicional: *ngIf="firmwareUpdated"
│  │ Nueva versión aplicada          │   │
│  └─────────────────────────────────┘   │
│                                         │
│  CONFIGURACIÓN ─────────────────────   │  mf-section-lbl
│  [✓ Backup de configuración realizado] │
└─────────────────────────────────────────┘
```

El campo "Nueva versión aplicada" es condicional: aparece cuando `firmwareUpdated` está checkeado (mismo patrón que `qnap-device-card` con `firmwareNewVersion`).

---

## CSS

Clases base reutilizadas del sistema:
- `mf-cl-rpt` — card base (background, border, shadow)
- `mf-section-lbl` — label de sección con línea divisora
- `mf-cl-rpt-label` — nombre del dispositivo
- `mf-host-ip` — IP en monospace

Clases propias del componente:
- `rdc-header` — flex, justify-between, padding, border-bottom, background elevated
- `rdc-identity` — flex column, name + IP
- `rdc-body` — padding 12px 14px 14px
- `rdc-firmware-row` — grid 1fr auto, gap 10px, align-items center
- `rdc-new-version` — margin-top 8px

---

## `router-form.component.html` resultante

```html
<form [formGroup]="form">
  <div class="rf-devices-stack">
    <app-router-device-card
      *ngFor="let _ of routerControls.controls; let i = index"
      [device]="infrastructure.routers[i]"
      [group]="getRouterGroup(i)"
      [readOnly]="readOnly">
    </app-router-device-card>
  </div>

  <mat-form-field appearance="outline" subscriptSizing="dynamic" style="margin-top:12px">
    <mat-label>Notas</mat-label>
    <textarea matInput formControlName="notes" placeholder="Observaciones generales..."></textarea>
  </mat-form-field>
</form>
```

---

## Módulos Angular

`RouterDeviceCardComponent` no es standalone. Se declara en el módulo existente donde vive `RouterFormComponent`. Los módulos Material necesarios ya están importados en ese módulo: `MatFormFieldModule`, `MatInputModule`, `MatCheckboxModule`, `MatButtonModule`.

---

## Tests

`router-device-card.component.spec.ts` cubre:
- Renderiza nombre e IP del dispositivo
- `firmwareVersion` field condicional: oculto cuando `firmwareUpdated = false`, visible cuando `true`
- En `readOnly = true`: el grupo está deshabilitado (heredado del padre via `applyReadOnlyState`)
- Campos vacíos iniciales por defecto

`router-form.component.spec.ts` existente: agregar caso que verifica que `getRouterGroup(i)` devuelve el FormGroup correcto del array.

---

## Cambios en archivos existentes

| Archivo | Cambio |
|---|---|
| `router-form.component.ts` | Agregar `getRouterGroup(i: number)` |
| `router-form.component.html` | Reemplazar cards inline por `app-router-device-card` |
| `router-form.component.scss` | Simplificar: solo `.rf-devices-stack` |
| Módulo padre | Declarar `RouterDeviceCardComponent` |
