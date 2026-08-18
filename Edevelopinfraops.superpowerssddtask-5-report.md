# Task 5: Frontend — task-labels.ts

## Estado: ✅ Completada

### Resumen
Se actualizó `frontend/src/app/shared/utils/task-labels.ts` para incorporar el nuevo TaskType `QNAP_MAINTENANCE`:

- **typeLabel('QNAP_MAINTENANCE')** → `'QNAP/NAS'`
- **typeLabelLong('QNAP_MAINTENANCE')** → `'Mantenimiento QNAP/NAS'`
- **typeBadge('QNAP_MAINTENANCE')** → `'badge--srv'` (mapped según la lógica: no es TERMINAL_MAINTENANCE ni SITE_VISIT)

### Cambios realizados
1. Agregado entry `QNAP_MAINTENANCE: 'QNAP/NAS'` en `typeLabel()` Record
2. Agregado entry `QNAP_MAINTENANCE: 'Mantenimiento QNAP/NAS'` en `typeLabelLong()` Record
3. Verificación: archivo compila sin errores TS

### Verificación
- ✅ TypeScript compila sin errores (task-labels.ts)
- ✅ Commit realizado: `80b3a0e`

### Notas
Los errores de compilación general del proyecto (`task-drawer.component.ts`) son previos y no relacionados con este cambio. La tarea se enfoca en actualizar los Records de labels, que se ha completado correctamente.

---

**Commit:** `80b3a0e`
