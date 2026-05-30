# Sección BMC en el formulario de mantenimiento

**Fecha:** 2026-05-30  
**Scope:** Drawer del técnico → formulario de mantenimiento de servidores (`SERVER_MAINTENANCE`)

---

## Contexto

El formulario de mantenimiento ya cubre Windows VMs, VMware ESXi, QNAP, Veeam y Router. Los servidores físicos (`esxiHosts`) tienen una interfaz de gestión remota (BMC: iLO en HPE, iDRAC en Dell, xClarity en Lenovo) cuya IP está registrada en InfraDoc con el nombre de interfaz correspondiente ("iLO", "iDRAC", "xClarity"), distinta a la IP VMware ("VMware"). El mantenimiento mensual requiere registrar versión de firmware, versión de BIOS y alertas activas detectadas en la consola BMC.

---

## Decisiones de diseño

- **Enfoque de fetching:** llamada extra por servidor físico (`getAssetInterfaces(assetId)` → `GET /api/v1/assets/read.php?asset_id={id}`). Se asume que ITFlow devuelve una fila por interfaz al filtrar por `asset_id`. Si devuelve solo la primaria, `bmcIp` queda `null` y la sección aparece igual pero sin IP.
- **Paralelismo:** las N llamadas extra se resuelven con `Promise.all` para no serializar la latencia.
- **Compatibilidad:** el campo `bmc` en `ServerMaintenancePayload` es opcional (`?`) para no romper logs existentes.
- **Condición de visibilidad:** la sección BMC se muestra cuando `hasVMware` (misma condición que la sección VMware ESXi, ya que corresponde a los mismos hosts físicos).

---

## Cambios por capa

### 1. Backend — InfraDoc fetching

**`infradoc-assets.service.ts`**

Nuevo método:
```typescript
async getAssetInterfaces(assetId: number): Promise<RawInfradocAsset[]>
// GET /api/v1/assets/read.php?asset_id={assetId}
// Devuelve todas las filas (una por interfaz de red del asset)
```

`RawInfradocAsset` recibe campo nuevo:
```typescript
interface_name: string | null;
```

---

**`infrastructure.service.ts`**

`getClientInfrastructure()` actualizado:
1. `getAssets(infradocId)` — igual que hoy
2. Identificar asset_ids únicos de `asset_type === 'Server'`
3. `Promise.all(serverIds.map(id => getAssetInterfaces(id)))` — una llamada por servidor
4. Por cada servidor, buscar en sus filas la interfaz BMC:
   - Primera fila con `interface_name` ≈ `"ilo"` | `"xclarity"` | `"idrac"` (case-insensitive)
   - Si hay múltiples coincidencias, tomar la primera
5. Mapear a `InfraAssetDto` con los campos nuevos `bmcIp` y `bmcType`

> **Nota:** el campo `ip` (interfaz VMware) sigue tomándose de `interface_ip` del `getAssets` original — no cambia el comportamiento actual. La llamada extra por asset solo resuelve `bmcIp`/`bmcType`.

Normalización de `bmcType`: el valor es el nombre de la interfaz tal como lo reporta InfraDoc (ej. "iLO", "iDRAC", "xClarity"), sin transformación adicional.

---

### 2. Contratos de datos

**`dto/client-infrastructure.dto.ts`** (backend) y `infradoc.models.ts` (frontend):

```typescript
// Campos nuevos en InfraAssetDto / InfraAsset
bmcIp:   string | null;
bmcType: string | null;
```

---

**`log-item.interface.ts`** (backend) y `maintenance-log.models.ts` (frontend):

```typescript
export interface BmcEntry {
  hostId:           number;
  hostName:         string;
  firmwareVersion?: string;
  biosVersion?:     string;
  alertStatus:      'ok' | 'alerta';
  alertNote?:       string; // solo presente cuando alertStatus === 'alerta'
}

// En ServerMaintenancePayload:
bmc?: BmcEntry[];
```

---

### 3. Frontend — formulario

**`maintenance-form.component.ts`**

FormArray nuevo en `buildForm()`:
```typescript
bmcHosts: this.fb.array(
  this.infrastructure.esxiHosts.map(() => this.fb.group({
    firmwareVersion: [''],
    biosVersion:     [''],
    alertStatus:     ['ok'],
    alertNote:       [''],
  }))
)
```

Métodos nuevos:
- `get bmcHostControls(): FormArray`
- `getBmcGroup(i: number): FormGroup`
- `bmcHasAlert(i: number): boolean` — `alertStatus === 'alerta'`

`buildPayload()` — cuando `hasVMware`:
```typescript
payload.bmc = this.infrastructure.esxiHosts.map((host, i) => {
  const ctrl = this.bmcHostControls.at(i).value;
  return {
    hostId:          host.assetId,
    hostName:        host.name,
    firmwareVersion: ctrl.firmwareVersion || undefined,
    biosVersion:     ctrl.biosVersion     || undefined,
    alertStatus:     ctrl.alertStatus,
    alertNote:       ctrl.alertStatus === 'alerta' ? (ctrl.alertNote || undefined) : undefined,
  };
});
```

---

**`maintenance-form.component.html`**

Nueva sección después de "VMware ESXi", visible cuando `hasVMware`:

```
Sección label: "BMC / Gestión remota"

Por cada esxiHost[i] (card mf-cl-rpt):
  Header:
    - Nombre del servidor (mf-cl-rpt-label)
    - IP BMC como badge mono (bmcIp ?? '—')
    - Tipo BMC como chip badge--srv si bmcType != null (ej. "iLO", "iDRAC")
  Campos:
    - Versión firmware (mat-input text, formControlName="firmwareVersion")
    - Versión BIOS     (mat-input text, formControlName="biosVersion")
    - Alertas detectadas (mat-select):
        ok     → "OK"      → clase mf-sel--ok
        alerta → "ALERTA"  → clase mf-sel--crit
    - Nota de alerta (mat-input, visible solo cuando bmcHasAlert(i))
```

---

## Tests a actualizar / agregar

| Archivo | Cambio |
|---|---|
| `infradoc-assets.service.spec.ts` | Test para `getAssetInterfaces`: llamada correcta al endpoint, retorna array de filas |
| `infrastructure.service.spec.ts` | Tests para identificación de VMware IP y BMC IP desde interfaces; `bmcIp`/`bmcType` en el DTO resultante; caso sin interfaz BMC → `null` |
| `maintenance-form.component.spec.ts` | Test: FormArray `bmcHosts` se construye con un grupo por esxiHost; `bmcHasAlert()` correcto; `buildPayload()` incluye sección `bmc`; nota de alerta omitida cuando `alertStatus === 'ok'` |

---

## Lo que NO cambia

- La sección VMware ESXi existente no se modifica.
- El campo `ip` en `InfraAsset` sigue siendo la IP VMware (no cambia el mapeo actual).
- Logs de tipo `TERMINAL_MAINTENANCE` no se ven afectados.
