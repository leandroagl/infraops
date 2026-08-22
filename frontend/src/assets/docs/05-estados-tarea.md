# Estados de tarea

## Estados posibles

| Estado | Significado |
|---|---|
| **PENDIENTE** | Tarea creada, aún no iniciada |
| **EN CURSO** | Técnico empezó el mantenimiento |
| **HECHO** | Mantenimiento completado y registrado |
| **ESCALADO** | Problema escalonado al técnico senior (en el mismo ticket Odoo) |
| **NO REALIZADO** | No se pudo concretar — requiere motivo registrado |

## Permisos por rol

| Acción | TECHNICIAN | TL | COORDINATOR | ADMIN |
|---|---|---|---|---|
| Ver todas las tareas | Sí (quitando filtro) | Sí | Sí | Sí |
| Filtro técnico por defecto | Propio | Todos | Todos | Todos |
| Ejecutar / completar tareas | Sí (propias) | Sí | No | Sí |
| Botón "Nueva tarea" | No | No | No | Sí |
| Marcar como "No realizado" | No | Sí | No | Sí |
| Ciclos cerrados | Solo lectura | Solo lectura | Solo lectura | Solo lectura |

> **COORDINATOR** accede en modo solo lectura: puede ver el estado de todas las tareas pero no puede ejecutar ni modificar ninguna.
