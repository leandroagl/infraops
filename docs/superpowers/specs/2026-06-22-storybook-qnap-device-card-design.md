# Spec: Storybook Setup + QnapDeviceCardComponent

**Fecha:** 2026-06-22  
**Rama:** feature/domain-task-split  
**Contexto:** Paso previo al rediseño visual del formulario QNAP. El objetivo es establecer Storybook como herramienta de desarrollo de componentes y documentar el primer componente extraído (`QnapDeviceCardComponent`) con todos sus estados antes de implementar el Enfoque A del rediseño.

---

## Alcance

1. Instalar y configurar Storybook 8 para Angular 17
2. Extraer `QnapDeviceCardComponent` del `QnapFormComponent` existente
3. Escribir 5 stories que cubran todos los estados del card

**Fuera de scope:** documentar átomos del design system (`.badge`, `.kpi`, etc.) — se hace iterativamente después.

---

## Sección 1 — Setup de Storybook

### Instalación

Ejecutar dentro de `frontend/`:

```bash
npx storybook@latest init
```

Detecta Angular automáticamente. Instala:
- `@storybook/angular`
- `@storybook/addon-essentials`
- `storybook`

Eliminar los stories de ejemplo que genera el init (`src/stories/`).

Agregar script al `package.json`:
```json
"storybook": "storybook dev -p 6006"
```

### `.storybook/main.ts`

```typescript
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};

export default config;
```

### `.storybook/preview.ts`

```typescript
import { applicationConfig } from '@storybook/angular';
import { provideAnimations } from '@angular/platform-browser/animations';
import '../src/styles.scss';

export const decorators = [
  applicationConfig({
    providers: [provideAnimations()],
  }),
];
```

`styles.scss` importa en cascada: `tokens.scss` → `reset.scss` → `typography.scss` → `components.scss` → `ag-grid.scss`. Todos los tokens y clases del design system quedan disponibles en Storybook sin configuración adicional.

---

## Sección 2 — `QnapDeviceCardComponent`

### Ubicación

```
frontend/src/app/features/technician/task-drawer/qnap-form/
├── qnap-device-card/
│   ├── qnap-device-card.component.ts
│   ├── qnap-device-card.component.html
│   ├── qnap-device-card.component.scss
│   ├── qnap-device-card.component.spec.ts
│   └── qnap-device-card.component.stories.ts
└── qnap-form.component.ts  ← orquestador, no cambia su interfaz externa
```

No va a `shared/` — es específico del flujo `QNAP_MAINTENANCE`.

### Interfaz

```typescript
@Input() device!: InfraAsset;   // name, ip, model, assetId
@Input() group!: FormGroup;     // sub-grupo del FormArray de QnapFormComponent
@Input() readOnly = false;
```

Sin `@Output()` — el card solo muta su `FormGroup`. El padre lee el FormArray completo al hacer submit.

### Lógica movida del padre

Las siguientes funciones se mueven de `QnapFormComponent` a `QnapDeviceCardComponent` como métodos privados o getters. El card lee sus valores directamente desde `this.group`:

- `spaceRatio()` → `get spaceRatio(): number` (lee `group.get('totalSpaceGB')`, etc.)
- `qnapCardHealth()` → `get cardHealth(): 'ok' | 'warn' | 'crit'`
- `selectClass(value)` → `selectClass(value: string): string`
- `metricClass(value, warn, crit)` → `metricClass(...): string`
- `diskSlotOptions()` → `get diskSlotOptions(): string[]` (lee `group.get('diskCount')?.value`)
- `qnapFirmwareUpdated()` → `get firmwareUpdated(): boolean`

`QnapFormComponent` queda como orquestador: crea el FormArray, itera con `*ngFor` y pasa cada grupo al card.

### Layout del card

```
┌─────────────────────────────────────────────────────────┐
│ ● QNAP – TS-219P+   192.168.0.132   [RAID: OK] [45%]  │  ← header
├─────────────────────────────────────────────────────────┤
│  ALMACENAMIENTO                                          │  ← mf-section-lbl
│  [Cant. discos ___]  [Total ___ GB▾]  [Usado ___ GB▾]  │
│  [Discos con error ▾]                                   │
│  ████████████░░░░░░░  45%                               │  ← barra de progreso
├─────────────────────────────────────────────────────────┤
│  FIRMWARE                                                │  ← mf-section-lbl
│  [Versión instalada ___________]   ☐ Se actualizó       │
│  [Nueva versión ___________]  ← condicional             │
└─────────────────────────────────────────────────────────┘
```

**Header:** health dot reemplazado por dos badges inline — badge RAID (usa `selectClass()` para el color semántico) y badge de espacio (`45%` con `metricClass()`). Nombre del device en `--tx-hi`, IP en `--font-mono --tx-lo`.

**Barra de progreso:** `<div class="qnap-progress-bar">` con un `<div class="qnap-progress-fill">` cuyo `width` se bindea al `spaceRatio`. Color via clases semánticas del token system. Sin librería externa.

**Sección firmware:** campos en una fila (`display: grid; grid-template-columns: 1fr auto`). El campo "Nueva versión" aparece con `*ngIf="firmwareUpdated"`.

### Módulos requeridos en la declaración del card

El card se declara en el módulo existente (`TechnicianModule` o equivalente). Imports que necesita:
`ReactiveFormsModule`, `CommonModule`, `MatFormFieldModule`, `MatInputModule`, `MatSelectModule`, `MatCheckboxModule`.

---

## Sección 3 — Stories

**Archivo:** `qnap-device-card.component.stories.ts`

Cada story usa `moduleMetadata` para declarar el componente y sus dependencias Material. Se crea un `FormBuilder` inline para construir el `FormGroup` de cada estado.

### Stories definidas

| Nombre | Estado representado | Valores del FormGroup |
|---|---|---|
| `Healthy` | Todo OK | RAID ok, total 4TB, usado 1.8TB (~45%), 0 errores |
| `StorageWarning` | Espacio en alerta | RAID ok, total 4TB, usado 3TB (~75%), 0 errores |
| `DiskError` | Disco con error | RAID degraded, Disk 2 en error |
| `Critical` | Estado crítico | RAID failed, 90% espacio, Disk 1 + Disk 3 en error |
| `ReadOnly` | Tarea completada | Form deshabilitado, todos los campos con datos |

### Estructura base de una story

```typescript
export const Healthy: Story = {
  args: { readOnly: false },
  render: (args) => ({
    props: {
      device: { assetId: 1, name: 'QNAP – TS-219P+', ip: '192.168.0.132', ... },
      group: new FormBuilder().group({ ... }),
      readOnly: args['readOnly'],
    },
    moduleMetadata: {
      declarations: [QnapDeviceCardComponent],
      imports: [
        ReactiveFormsModule, CommonModule,
        MatFormFieldModule, MatInputModule,
        MatSelectModule, MatCheckboxModule,
      ],
    },
  }),
};
```

**`argTypes`:** `readOnly` expuesto como control boolean en el panel de Storybook para toggling en tiempo real. Los demás campos son datos fijos por story.

---

## Criterio propagable a futuros formularios

El patrón establecido por `QnapDeviceCardComponent` define la convención para cualquier card de dispositivo en el sistema:

1. **Header con badges semánticos** — nunca solo un dot de 6px; siempre badges legibles con label + color
2. **Secciones con `mf-section-lbl`** — agrupar campos relacionados con separador de sección
3. **Métricas numéricas con barra de progreso** — para cualquier relación usado/total
4. **Componente presentacional con FormGroup como input** — el orquestador crea el form, el card solo lo muta
5. **Story por estado** — al crear un nuevo card de dispositivo, crear stories de los estados antes de integrar al formulario padre

---

## Orden de implementación

1. Instalar y configurar Storybook (sin stories aún)
2. Extraer `QnapDeviceCardComponent` desde `QnapFormComponent`
3. Verificar que `QnapFormComponent` sigue funcionando igual externamente
4. Escribir stories
5. Correr `npm run storybook` y validar los 5 estados visualmente
