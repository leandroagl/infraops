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

### 3. Configuración de credenciales Odoo (técnicos y TL)

Inmediatamente después del primer login, técnicos y TL deben conectar su cuenta de Odoo. El sistema no permite acceder a los módulos de tarea sin completar este paso.

**Qué ingresar:**
- **Email de Odoo:** generalmente el mismo email que el usuario de InfraOps
- **API Key de Odoo:** se genera en Odoo en `Configuración → Mi cuenta → API Keys`

Una vez validada, la conexión queda guardada y no es necesario repetirla. Si la API key se vence o cambia, se puede actualizar desde el perfil.

> **Por qué es necesario:** InfraOps registra las horas en Odoo bajo el nombre de cada técnico. Sin las credenciales propias, el tiempo queda sin atribuir correctamente.

---

## Vista Técnico

Accesible para roles **TECHNICIAN** y **TL**.

### Panel principal — Mis tareas

Al ingresar, el técnico ve su panel personal con:

**KPIs en la parte superior:**
- **Vencidas:** tareas cuya fecha programada ya pasó y no están completadas
- **Esta semana:** tareas con vencimiento en los próximos 7 días
- **Al día:** tareas con fecha más lejana

**Kanban de tareas** organizado por estado:
- `Pendiente` → `En curso` → `Completado / Escalado / No realizado`

Cada card muestra: cliente, tipo de tarea, fecha programada y urgencia visual (rojo = vencida, amarillo = esta semana, verde = al día).

### Ejecutar una tarea

Al hacer clic en una card se abre el **panel de detalle** (drawer) desde la derecha.

**El drawer muestra:**
- Datos generales: cliente, tipo, estado, fecha, ticket Odoo asociado
- Formulario de control según el tipo de tarea (ver abajo)
- Botones de acción según el estado actual

**Flujo típico:**

1. Hacer clic en la tarea `PENDIENTE`
2. Presionar **"Iniciar"** → el estado pasa a `EN CURSO` y el ticket Odoo se marca en progreso
3. Completar el formulario de control
4. Presionar **"Guardar progreso"** (opcional, para no perder lo avanzado)
5. Presionar **"Completar tarea"** → ingresar tiempo dedicado → confirmar
6. El estado pasa a `COMPLETADO`, se cierra el ticket en Odoo y se registra el timesheet

**Si no se puede completar:**
- Presionar **"No realizado"** para cerrar la tarea con ese estado y el motivo

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

### Tareas

Vista central de gestión con **kanban global** de todas las tareas del sistema.

**Filtros disponibles:**
- Por estado (Pendiente / En curso / Completado / Escalado / No realizado)
- Por cliente
- Por técnico

**Acciones disponibles:**
- **Nueva tarea:** abre un dialog para crear una tarea asignando cliente, tipo, técnico y fecha
- **Ver detalle:** clic en cualquier tarea abre el drawer de detalle (solo lectura para admin)
- **Eliminar tarea:** desde el detalle de una tarea en estado Pendiente

**Al crear una tarea** el sistema:
1. Valida que el cliente tenga la infraestructura necesaria en InfraDoc para ese tipo de tarea
2. Abre automáticamente un ticket en Odoo bajo el cliente correspondiente
3. La tarea queda en estado `Pendiente` lista para ser ejecutada por el técnico asignado

### Usuarios

Gestión de los usuarios del sistema (solo **ADMIN**).

- **Ver lista:** todos los usuarios activos con su rol
- **Nuevo usuario:** genera el usuario con contraseña temporal automática (se muestra una sola vez)
- **Editar:** cambiar nombre, rol, estado activo
- **Eximir de Odoo:** marcar un usuario como exento de la configuración de credenciales Odoo (para roles que no ejecutan tareas, como COORDINATOR)

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

**Filtros:** por tipo de alerta y por urgencia.

Por defecto muestra los próximos 90 días. El botón "Ver todos" quita ese límite.

### Sincronización InfraDoc

Permite forzar una sincronización manual del listado de clientes desde InfraDoc.

La sincronización automática ocurre cada 4 horas. Usar este botón si se acaba de agregar un cliente en InfraDoc y es necesario que aparezca en InfraOps de inmediato.

---

## Clientes

Accesible para todos los roles.

### Lista de clientes

Vista de todos los clientes activos sincronizados desde InfraDoc.

### Detalle de cliente

Al hacer clic en un cliente se ve:
- **Datos generales** del cliente
- **Infraestructura** (servidores, routers, QNAP, etc.) obtenida en tiempo real de InfraDoc
- **Historial de mantenimientos:** todas las tareas ejecutadas para ese cliente con sus logs

---

## Mi perfil

Accesible para todos los usuarios desde el menú de navegación.

Muestra los datos del usuario logueado y el estado de la conexión con Odoo:
- Email de Odoo configurado
- Estado de validación de la API key
- Fecha de última validación

**Actualizar credenciales Odoo:** si la API key cambió o expiró, desde aquí se pueden actualizar sin necesidad de cerrar sesión.

---

## Preguntas frecuentes

**¿Por qué el sistema me pide configurar Odoo antes de entrar?**
InfraOps registra el tiempo y el avance de los tickets directamente en Odoo bajo el nombre de cada técnico. Sin las credenciales propias no puede hacer eso.

**¿Dónde genero mi API Key de Odoo?**
En Odoo: menú superior derecho → tu nombre → `Mi perfil` → sección `API Keys` → `Nueva API Key`.

**¿Qué pasa si pongo mal la API Key?**
El sistema la valida en el momento. Si es incorrecta muestra un error y no la guarda. Podés intentar de nuevo.

**¿Puedo ver tareas de otro técnico?**
Los técnicos solo ven sus tareas asignadas. Los roles ADMIN, TL y COORDINATOR ven todas las tareas en el Panel Admin.

**¿Qué significa "Escalado"?**
Una tarea escalada es aquella que el técnico no pudo resolver y fue derivada a un técnico senior. El ticket original en Odoo se reasigna; no se crea uno nuevo.

**¿Cada cuánto se actualiza el inventario de InfraDoc?**
Automáticamente cada 4 horas. Los administradores pueden forzar una sincronización manual desde Panel Admin → Sincronización.
