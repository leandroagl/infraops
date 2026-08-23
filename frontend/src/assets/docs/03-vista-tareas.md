# Vista de Tareas

Accesible para todos los roles desde la barra lateral. Ruta: `/tasks`.

## Navegación por ciclo

La vista muestra las tareas de un **mes calendario** (ciclo). El mes activo por defecto es el mes actual.

Las flechas `[< Agosto 2026 >]` en la barra superior permiten navegar a meses anteriores o futuros. Los meses pasados se muestran en modo **solo lectura** con un banner indicador.

## KPIs

| Indicador | Qué muestra |
|---|---|
| **Asignadas** | Total de tareas en el ciclo |
| **En curso** | Tareas con estado EN CURSO |
| **Pendientes** | Tareas con estado PENDIENTE |
| **Completadas** | Tareas con estado HECHO |

A la derecha: barra de avance del ciclo y badge "Ciclo abierto / Ciclo cerrado".

## Filtros

- **Cliente:** select con todos los clientes activos
- **Tipo de tarea:** select (Servidores, Dominio Windows, QNAP, Veeam, Routers, etc.)
- **Estado:** select (Pendiente, En progreso, Hecho, Escalado, No realizado)
- **Técnico:** select con todos los técnicos activos

Los filtros se combinan. El botón **"Limpiar"** restablece todos.

## Tabla de tareas

Las tareas están **agrupadas por cliente**. Cada grupo muestra:
- Header: nombre del cliente · conteo · barra de progreso
- Filas: Tipo · Técnico · Estado · Ticket Odoo · Notas

Hacer clic en una fila abre el **drawer de detalle** desde la derecha.
