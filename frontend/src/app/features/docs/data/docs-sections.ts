import { UserRole } from '../../../core/models/auth.models';

export type DocRole = UserRole | '*';

export interface DocSection {
  id: string;
  title: string;
  file: string;
  group: string;
  roles: DocRole[];
}

export const DOCS_SECTIONS: DocSection[] = [
  { id: 'que-es',              title: '¿Qué es InfraOps?',      file: '01-que-es-infraops.md',        group: 'General',        roles: ['*'] },
  { id: 'acceso',              title: 'Primer acceso',           file: '02-primer-acceso.md',           group: 'General',        roles: ['*'] },
  { id: 'perfil',              title: 'Perfil de usuario',       file: '12-perfil.md',                  group: 'General',        roles: ['*'] },
  { id: 'notif-app',           title: 'Notificaciones',          file: '13-notificaciones-app.md',      group: 'General',        roles: ['*'] },
  { id: 'tareas',              title: 'Vista de tareas',         file: '03-vista-tareas.md',            group: 'Tareas',         roles: ['*'] },
  { id: 'ejecucion',           title: 'Ejecutar mantenimiento',  file: '04-ejecutar-mantenimiento.md',  group: 'Tareas',         roles: ['*'] },
  { id: 'estados',             title: 'Estados de tarea',        file: '05-estados-tarea.md',           group: 'Tareas',         roles: ['*'] },
  { id: 'vencimientos',        title: 'Vencimientos',            file: '09-vencimientos.md',            group: 'Módulos',        roles: ['*'] },
  { id: 'backups',             title: 'Backups',                 file: '10-backups.md',                 group: 'Módulos',        roles: ['*'] },
  { id: 'clientes',            title: 'Clientes',                file: '11-clientes.md',                group: 'Módulos',        roles: ['*'] },
  { id: 'asignacion',          title: 'Asignación de técnicos',  file: '06-asignacion-tecnicos.md',     group: 'Coordinación',   roles: ['TL', 'ADMIN'] },
  { id: 'visitas',             title: 'Coordinación de visitas', file: '07-coordinacion-visitas.md',    group: 'Coordinación',   roles: ['TL', 'ADMIN', 'COORDINATOR'] },
  { id: 'usuarios',            title: 'Gestión de usuarios',     file: '08-gestion-usuarios.md',        group: 'Administración', roles: ['ADMIN'] },
  { id: 'admin',               title: 'Panel Admin',             file: '14-panel-admin.md',             group: 'Administración', roles: ['ADMIN'] },
];
