# InfraOps — Manual de usuario

> Versión de campo — agosto 2026. El sistema está en desarrollo activo; este documento se actualiza con cada módulo nuevo.

---

## ¿Qué es InfraOps?

InfraOps es el sistema interno de ONDRA para coordinar y registrar el trabajo técnico recurrente: mantenimientos de servidores, visitas a clientes, control de routers, QNAP, Veeam, antivirus y UPS.

Reemplaza las planillas Excel para hacer visible, trazable y medible el trabajo de cada técnico. Está integrado con Odoo (tickets y horas) e InfraDoc (inventario de infraestructura por cliente).

---

## Roles

| Rol | Quién | Qué puede hacer |
|---|---|---|
| **ADMIN** | Omar, Leandro | Acceso completo |
| **TL** | El Pana | Acceso completo + asignación de técnicos |
| **COORDINATOR** | Lau | Panel admin + gestión de tareas |
| **TECHNICIAN** | Valen, Enzo, Tow, Santi, Gian | Vista propia de tareas + ejecución |

---

## Primer acceso

### 1. Login

Ingresar con el email y contraseña provisto por el administrador.

### 2. Cambio de contraseña obligatorio

En el primer ingreso el sistema pide cambiar la contraseña. La nueva contraseña queda guardada y es la que se usa de ahí en adelante.

---

## Vista de Tareas (ciclo mensual)

Accesible para todos los roles. La vista es única para técnicos, coordinadores y administradores; el comportamiento varía según el rol.

Esta vista reemplaza las vistas separadas de "Panel Admin → Tareas" y "Vista Técnico" del modelo anterior. La ruta es `/tasks`.

### Navegación por ciclo

La vista muestra las tareas de un **mes calendario** (ciclo). El mes activo por defecto es el mes actual.

Las flechas `[< Agosto 2026 >]` en la barra superior permiten navegar a meses anteriores o futuros. Los meses pasados se muestran en modo **solo lectura** con un banner indicador.

### KPIs y filtros

Encima de la tabla hay una tira de indicadores con cuatro bloques:

| KPI | Qué muestra |
|---|---|
| **Asignadas** | Total de tareas en el ciclo (o del técnico filtrado) |
| **En curso** | Tareas con estado EN CURSO |
| **Pendientes** | Tareas con estado PENDIENTE |
| **Completadas** | Tareas con estado HECHO |

A la derecha: **barra de avance del ciclo** (completadas / total) y badge "Ciclo abierto / Ciclo cerrado".

Los filtros están integrados en la misma barra:

- **Cliente:** select con todos los clientes activos
- **Tipo de tarea:** select (Servidores, Dominio Windows, QNAP, Veeam, Routers, etc.)
- **Estado:** select (Pendiente, En progreso, Hecho, Escalado, No realizado)
- **Técnico:** select con todos los técnicos activos

Los filtros se combinan. El botón **"Limpiar"** (aparece cuando hay al menos un filtro activo) restablece todos a la vez.

### Tabla de tareas

Las tareas están **agrupadas por cliente**. Cada grupo muestra:

- **Header de grupo:** nombre del cliente · conteo de tareas · barra de progreso `completadas/total`
- **Filas de tarea** con columnas: Tipo · Técnico · Estado · Ticket Odoo · Notas

Hacer clic en una fila abre el **drawer de detalle** desde la derecha.

### Drawer de detalle — Ejecutar una tarea

**Flujo típico:**

1. Hacer clic en la fila de la tarea `PENDIENTE`
2. Presionar **"Iniciar"** → el estado pasa a `EN CURSO` y el ticket Odoo se marca en progreso
3. Completar el formulario de control
4. Presionar **"Guardar progreso"** (opcional, para no perder lo avanzado)
5. Presionar **"Completar tarea"** → ingresar tiempo dedicado → confirmar
6. El estado pasa a `COMPLETADO`, se cierra el ticket en Odoo y se registra el timesheet

**Si no se puede completar (solo ADMIN y TL):**
- Presionar **"No realizado"** → se abre un diálogo donde se debe ingresar un motivo (obligatorio)
- Al confirmar: se imputan **0:00 hs en Odoo** con el motivo como descripción y el ticket pasa al stage "No realizadas"
- El estado de la tarea queda como `NO REALIZADO` con el motivo registrado

### Permisos por rol

| Acción | TECHNICIAN | TL | COORDINATOR | ADMIN |
|---|---|---|---|---|
| Ver todas las tareas del ciclo | Sí (quitando filtro) | Sí | Sí | Sí |
| Filtro técnico por defecto | Propio | Todos | Todos | Todos |
| Ejecutar / completar tareas | Sí (propias) | Sí | No | Sí |
| Botón "Nueva tarea" | No | No | No | Sí |
| Marcar como "No realizado" con motivo | No | Sí | No | Sí |
| Ciclos cerrados | Solo lectura | Solo lectura | Solo lectura | Solo lectura |

COORDINATOR accede en modo solo lectura: puede ver el estado de todas las tareas y el detalle de cada una, pero no puede ejecutar ni modificar nada.

---

## Tipos de tarea y formularios

### Mantenimiento ESXi (Server Host)

Muestra los hosts ESXi del cliente obtenidos de InfraDoc. Para cada host se registra:
- Estado general del host
- VMs activas / pausadas / con snapshots
- Alertas de datastore
- Observaciones

### Dominio Windows

Muestra los controladores de dominio (DC) del cliente. Para cada DC se registra:
- Estado de replicación
- Estado de servicios (NTDS, NETLOGON, DNS, SYSVOL)
- Espacio en disco del sistema
- Observaciones generales

### QNAP

Muestra los dispositivos QNAP del cliente. Para cada QNAP se registra:
- Estado de discos y RAID
- Espacio disponible
- Estado de los volúmenes
- Observaciones

### Veeam Backup

Formulario de control de backups Veeam. Se registra:
- Estado de los jobs de backup (OK / con errores / en warning)
- VMs respaldadas y última fecha exitosa
- Observaciones

### Router

Muestra los routers del cliente. Para cada router se registra:
- Conectividad / estado de interfaces
- Firmware version
- Observaciones

---

## Panel Admin

Accesible para roles **ADMIN**, **TL** y **COORDINATOR**.

El Panel Admin agrupa las secciones de gestión interna: Usuarios, Técnicos, Alertas de vencimiento, Programación y Sync. La gestión de tareas se hace desde la vista `/tasks` (ver sección anterior), accesible desde la barra de navegación principal.

### Usuarios

Gestión de los usuarios del sistema (solo **ADMIN**).

- **Ver lista:** todos los usuarios activos con su rol
- **Nuevo usuario:** genera el usuario con contraseña temporal automática (se muestra una sola vez)
- **Editar:** cambiar nombre, rol, estado activo

### Técnicos

Gestión de los perfiles de técnico (solo **ADMIN** y **TL**).

Cada técnico tiene un perfil separado del usuario que incluye sus datos de Odoo (employee ID, user ID) para poder asignarle tareas y registrar horas correctamente.

- **Ver lista:** técnicos activos con usuario asociado
- **Asignar técnico:** vincular un usuario existente con un perfil de técnico

### Alertas de vencimiento

Lista de todos los ítems con fecha de vencimiento próxima o ya vencida en toda la cartera de clientes.

**Tipos de alerta:**
- Licencias de software
- Garantías de hardware
- Dominios web
- Baterías UPS

**Semáforo visual:**
- 🔴 **Vencido:** ya pasó la fecha
- 🟡 **Esta semana:** vence en los próximos 7 días
- 🟠 **Próximo:** vence entre 8 y 20 días
- ⚪ **Atención:** vence entre 21 y 45 días

**Filtros:** por tipo de alerta y por urgencia. A la derecha de los filtros se muestran chips con el conteo de ítems por categoría de urgencia (Vencidos · Esta semana · Próximo · Mostrando).

Por defecto muestra los próximos 90 días. El checkbox **"Ver todos los futuros"** quita ese límite.

**Columnas de la tabla:**

| Columna | Descripción |
|---|---|
| Cliente | Cliente al que pertenece el ítem |
| Ítem | Nombre del activo, licencia o dominio |
| Marca | Solo para garantías de hardware (campo de InfraDoc) |
| Modelo | Solo para garantías de hardware |
| Serie | Número de serie del hardware (tipografía monoespaciada) |
| Tipo | Categoría de la alerta |
| Vencimiento | Fecha de vencimiento |
| Estado | Badge de urgencia según el semáforo |

### Programación de mantenimientos

Accesible para roles **ADMIN** y **TL**. Permite configurar y generar las tareas de mantenimiento mensual de toda la cartera de clientes de forma centralizada.

El módulo se organiza en tres pestañas:

---

#### Pestaña Configuración

Tabla con todos los clientes activos. Para cada cliente se define:

- **Grupo bimestral:** determina en qué meses se le genera tarea de mantenimiento.
  - **Grupo A (Par):** Feb · Abr · Jun · Ago · Oct · Dic
  - **Grupo B (Impar):** Ene · Mar · May · Jul · Sep · Nov
- **Técnico asignado:** técnico por defecto para ese cliente en las generaciones automáticas.

Los cambios se guardan automáticamente al seleccionar. Una confirmación verde (`✓ Guardado`) aparece brevemente al guardar cada línea.

**Filtros disponibles:**
- Por grupo (A / B / Todos)
- Por técnico
- Búsqueda por nombre de cliente

**Rotación automática** (botón "Configurar rotación"):

Abre un modal para activar la rotación automática de técnicos entre clientes. Cuando está activa, cada generación redistribuye los clientes en round-robin equilibrado entre los técnicos disponibles.

El modal muestra una barra de distribución actual (cuántos clientes tiene asignado cada técnico) para verificar el balance antes de guardar.

---

#### Pestaña Generación

Permite generar las tareas de mantenimiento para un mes concreto.

**Flujo:**

1. Seleccionar el mes y año con las flechas de navegación.
2. El sistema carga el **preview**: qué clientes corresponden ese mes según su grupo, con el técnico asignado a cada uno.
3. Revisar que no haya clientes sin técnico asignado (el botón de generar se deshabilita si los hay).
4. Presionar **"Generar tareas"**.
5. El sistema crea una tarea por cliente correspondiente y muestra cuántas fueron creadas y cuántas omitidas (porque ya existían).

> Los clientes sin grupo asignado no aparecen en el preview y no reciben tarea.

> **Cierre automático del mes anterior:** al generar un mes nuevo, el sistema cierra automáticamente todas las tareas `PENDIENTE` o `EN CURSO` del mes anterior con estado `NO REALIZADO` y motivo "Cierre automático de fin de mes". Esto garantiza que ningún ciclo quede con tareas abiertas indefinidamente.

---

#### Pestaña Historial / Calendario

Vista anual navegable con una card por cada mes del año.

Cada card muestra:
- El grupo que corresponde ese mes (A · Par o B · Impar)
- Si el mes ya fue generado o es futuro

Al hacer clic en una card se expande para ver el listado de clientes y técnicos que correspondían a ese mes. Los meses futuros aparecen diferenciados visualmente.

Las flechas de año permiten navegar al historial de años anteriores.

---

### Sincronización InfraDoc

Permite forzar una sincronización manual del listado de clientes desde InfraDoc.

La sincronización automática ocurre cada 4 horas. Usar este botón si se acaba de agregar un cliente en InfraDoc y es necesario que aparezca en InfraOps de inmediato.

---

## Clientes

Accesible para todos los roles.

### Lista de clientes

Vista de todos los clientes activos sincronizados desde InfraDoc. Incluye una barra de búsqueda por nombre y dos KPI cards junto al buscador:

- **Horas del mes:** anillo de progreso con el total de horas contratadas, usadas y disponibles de toda la cartera (respeta el filtro de búsqueda por nombre).
- **Clientes por consumo:** conteo de clientes agrupados por zona de consumo. Cada tile es clickeable y filtra la tabla a esa zona; hacer clic de nuevo sobre la misma tile quita el filtro.

La tabla muestra dos columnas:

| Columna | Descripción |
|---|---|
| **Cliente** | Nombre del cliente. Hacer clic navega al detalle. |
| **Horas del mes** | Horas del contrato de soporte Odoo para el mes en curso: contratadas · usadas · disponibles, con barra de progreso. |

**Semáforo de horas (% usado sobre contratado):**
- **Rojo — 0%:** sin actividad, todavía no se usó ninguna hora contratada.
- **Celeste — 1% a 59%:** uso bajo.
- **Verde — 60% a 100%:** uso normal.
- **Amarillo — más de 100%:** excedente, superó las horas contratadas.

Los clientes sin contrato de horas en Odoo muestran `—` en esa columna y quedan excluidos tanto de las KPI cards como del filtro por zona. Los datos se cargan al abrir la vista; mientras se obtienen aparece un skeleton loader.

### Detalle de cliente

Al hacer clic en un cliente se ve:
- **Datos generales** del cliente
- **Infraestructura** (servidores, routers, QNAP, etc.) obtenida en tiempo real de InfraDoc
- **Historial de mantenimientos:** todas las tareas ejecutadas para ese cliente con sus logs

---

## Mi perfil

Accesible para todos los usuarios desde el menú de navegación.

Muestra los datos del usuario logueado: email y rol en el sistema.

---

## Preguntas frecuentes

**¿Puedo ver tareas de otro técnico?**
Sí. En la vista de Tareas, todos los roles pueden ver el ciclo completo. Los técnicos arrancan con el filtro aplicado a sus propias tareas, pero pueden quitarlo para ver todas.

**¿Qué significa "Escalado"?**
Una tarea escalada es aquella que el técnico no pudo resolver y fue derivada a un técnico senior. El ticket original en Odoo se reasigna; no se crea uno nuevo.

**¿Cada cuánto se actualiza el inventario de InfraDoc?**
Automáticamente cada 4 horas. Los administradores pueden forzar una sincronización manual desde Panel Admin → Sincronización.
