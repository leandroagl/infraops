# Spec: Selector de unidad (GB/TB) en formulario QNAP/NAS

**Fecha:** 2026-06-21
**Branch:** feature/qnap-form-mejoras

## Contexto

El formulario de mantenimiento de servidores tiene una sección QNAP/NAS con campos `totalSpaceGB` y `usedSpaceGB`. Ambos muestran un sufijo "GB" hardcodeado. Se necesita permitir seleccionar la unidad entre GB y TB por campo de forma independiente.

## Decisiones de diseño

- Selector de unidad **independiente por campo** (total y utilizado pueden tener unidades distintas).
- Los valores se guardan en el payload tal como el usuario los ingresa (valor crudo + unidad). No se convierte a GB al persistir.
- El campo `totalSpaceGB` / `usedSpaceGB` almacena el valor crudo en la unidad seleccionada (el nombre es histórico).
- Compatibilidad con logs existentes: `totalSpaceUnit` y `usedSpaceUnit` son opcionales en `QNAPSection`; defaultean a `'GB'` al cargar.
- El cálculo de porcentaje en pantalla normaliza ambos valores a GB antes de dividir.

## Cambios requeridos

### 1. Modelo — `maintenance-log.models.ts`

```typescript
export interface QNAPSection {
  deviceId: number;
  deviceName: string;
  diskCount: number;
  totalSpaceGB: number;        // valor crudo en la unidad seleccionada
  totalSpaceUnit?: 'GB' | 'TB'; // opcional, default 'GB'
  usedSpaceGB: number;
  usedSpaceUnit?: 'GB' | 'TB';
  disksWithError: string[];
  raidStatus: 'ok' | 'degraded' | 'failed';
  firmwareVersion: string;
  firmwareUpdated: boolean;
  firmwareNewVersion?: string;
}
```

### 2. Componente TS — `maintenance-form.component.ts`

**Form group** (cada dispositivo QNAP):
```typescript
totalSpaceGB:   [null as number | null],
totalSpaceUnit: ['GB' as 'GB' | 'TB'],
usedSpaceGB:    [null as number | null],
usedSpaceUnit:  ['GB' as 'GB' | 'TB'],
```

**Helper `spaceRatio(i)`** — normaliza a GB para el porcentaje:
```typescript
spaceRatio(i: number): number {
  const g = this.getQnapGroup(i).value;
  const total = Number(g.totalSpaceGB) * (g.totalSpaceUnit === 'TB' ? 1024 : 1);
  const used  = Number(g.usedSpaceGB)  * (g.usedSpaceUnit  === 'TB' ? 1024 : 1);
  return total ? (used / total) * 100 : 0;
}
```

**`buildPayload`:**
```typescript
totalSpaceGB:   Number(ctrl.totalSpaceGB),
totalSpaceUnit: ctrl.totalSpaceUnit ?? 'GB',
usedSpaceGB:    Number(ctrl.usedSpaceGB),
usedSpaceUnit:  ctrl.usedSpaceUnit ?? 'GB',
```

**`patchSavedValues`:**
```typescript
totalSpaceUnit: saved.totalSpaceUnit ?? 'GB',
usedSpaceUnit:  saved.usedSpaceUnit ?? 'GB',
```

### 3. Template — `maintenance-form.component.html`

Reemplazar `<span matTextSuffix>GB</span>` por `mat-select` como suffix interactivo:

```html
<!-- Espacio total -->
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff">
  <mat-label>Espacio total</mat-label>
  <input matInput formControlName="totalSpaceGB" type="number" min="0" placeholder="0" />
  <mat-select matSuffix formControlName="totalSpaceUnit" style="width:55px">
    <mat-option value="GB">GB</mat-option>
    <mat-option value="TB">TB</mat-option>
  </mat-select>
</mat-form-field>

<!-- Espacio utilizado -->
<mat-form-field appearance="outline" subscriptSizing="dynamic" class="mf-metric-ff"
                [ngClass]="metricClass(spaceRatio(i), 70, 85)">
  <mat-label>Espacio utilizado</mat-label>
  <input matInput formControlName="usedSpaceGB" type="number" min="0" placeholder="0" />
  <mat-select matSuffix formControlName="usedSpaceUnit" style="width:55px">
    <mat-option value="GB">GB</mat-option>
    <mat-option value="TB">TB</mat-option>
  </mat-select>
</mat-form-field>
```

### 4. Tests — `maintenance-form.component.spec.ts`

- Verificar que los controles `totalSpaceUnit` y `usedSpaceUnit` existen y defaultean a `'GB'`.
- Verificar que `buildPayload` incluye `totalSpaceUnit` y `usedSpaceUnit` en la sección `qnap`.
- Verificar que `spaceRatio` normaliza correctamente (ej: 1 TB used / 2 TB total = 50%, 512 GB used / 1 TB total = 50%).
- Verificar que `patchSavedValues` restaura las unidades (y defaultea a `'GB'` si ausentes).

## Out of scope

- Conversión automática de valores al cambiar de unidad (si el usuario pone 8 TB y cambia a GB, el número no se transforma).
- Mostrar el espacio en unidades mixtas en el historial de logs.
