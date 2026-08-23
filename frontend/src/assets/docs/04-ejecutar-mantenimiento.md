# Ejecutar un mantenimiento

## Flujo típico

1. Hacer clic en la fila de la tarea **PENDIENTE**
2. Presionar **"Iniciar"** → el estado pasa a EN CURSO y el ticket Odoo se marca en progreso
3. Completar el formulario de control según el tipo de tarea
4. Presionar **"Guardar progreso"** (opcional, para no perder lo avanzado)
5. Presionar **"Completar tarea"** → ingresar tiempo dedicado → confirmar
6. El estado pasa a HECHO, se cierra el ticket en Odoo y se registra el timesheet

## Si no se puede completar (solo ADMIN y TL)

- Presionar **"No realizado"** → ingresar motivo obligatorio en el diálogo
- Al confirmar: se imputan **0:00 hs en Odoo** con el motivo como descripción
- El ticket Odoo pasa al stage "No realizadas"
- El estado de la tarea queda como NO REALIZADO con el motivo registrado

## Tipos de formulario

| Tipo de tarea | Datos que se registran |
|---|---|
| **ESXi (Server Host)** | Estado del host, VMs, snapshots, alertas de datastore |
| **Dominio Windows** | Estado de replicación, servicios (NTDS, DNS, SYSVOL), espacio en disco |
| **QNAP** | Estado de discos y RAID, espacio disponible, volúmenes |
| **Veeam Backup** | Estado de jobs, VMs respaldadas, última fecha exitosa |
| **Router** | Conectividad, interfaces, versión de firmware |
