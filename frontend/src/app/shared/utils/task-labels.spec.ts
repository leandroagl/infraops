import { statusLabel, statusBadge, typeLabel, typeLabelLong, typeBadge } from './task-labels';
import { TaskStatus, TaskType } from '../../core/models/task.models';

describe('task-labels utils', () => {

  describe('statusLabel()', () => {
    const cases: [TaskStatus, string][] = [
      ['PENDING',     'Pendiente'],
      ['IN_PROGRESS', 'En curso'],
      ['DONE',        'Listo'],
      ['ESCALATED',   'Escalado'],
      ['NOT_DONE',    'No hecho'],
    ];
    cases.forEach(([status, expected]) => {
      it(`${status} → "${expected}"`, () => {
        expect(statusLabel(status)).toBe(expected);
      });
    });
  });

  describe('statusBadge()', () => {
    const cases: [TaskStatus, string][] = [
      ['PENDING',     'badge--neutral'],
      ['IN_PROGRESS', 'badge--accent'],
      ['DONE',        'badge--ok'],
      ['ESCALATED',   'badge--warn'],
      ['NOT_DONE',    'badge--crit'],
    ];
    cases.forEach(([status, expected]) => {
      it(`${status} → "${expected}"`, () => {
        expect(statusBadge(status)).toBe(expected);
      });
    });
  });

  describe('typeLabel() — labels cortas', () => {
    const cases: [TaskType, string][] = [
      ['ROUTER_MAINTENANCE',   'Router / FW'],
      ['TERMINAL_MAINTENANCE', 'Terminales'],
      ['SITE_VISIT',           'Visita'],
      ['AV_CONTROL',           'Antivirus'],
      ['UPS_CONTROL',          'UPS'],
      ['ENDPOINT_INVENTORY',   'Inventario'],
    ];
    cases.forEach(([type, expected]) => {
      it(`${type} → "${expected}"`, () => {
        expect(typeLabel(type)).toBe(expected);
      });
    });
  });

  describe('typeLabelLong() — labels largas', () => {
    const cases: [TaskType, string][] = [
      ['ROUTER_MAINTENANCE',   'Mantenimiento de router y firewall'],
      ['TERMINAL_MAINTENANCE', 'Visita de terminales'],
      ['SITE_VISIT',           'Visita presencial'],
      ['AV_CONTROL',           'Control antivirus'],
      ['UPS_CONTROL',          'Control UPS'],
      ['ENDPOINT_INVENTORY',   'Inventario'],
    ];
    cases.forEach(([type, expected]) => {
      it(`${type} → "${expected}"`, () => {
        expect(typeLabelLong(type)).toBe(expected);
      });
    });
  });

  describe('typeBadge()', () => {
    const cases: [TaskType, string][] = [
      ['SERVER_HOST_MAINTENANCE',    'badge--vmware'],
      ['WINDOWS_DOMAIN_MAINTENANCE', 'badge--win'],
      ['QNAP_MAINTENANCE',           'badge--nas'],
      ['VEEAM_BACKUP',               'badge--bkp'],
      ['ROUTER_MAINTENANCE',         'badge--net'],
      ['TERMINAL_MAINTENANCE',       'badge--purple'],
      ['SITE_VISIT',                 'badge--purple'],
      ['AV_CONTROL',                 'badge--neutral'],
      ['UPS_CONTROL',                'badge--neutral'],
      ['ENDPOINT_INVENTORY',         'badge--neutral'],
    ];
    cases.forEach(([type, expected]) => {
      it(`${type} → "${expected}"`, () => {
        expect(typeBadge(type)).toBe(expected);
      });
    });
  });

  it('typeLabel retorna "Veeam" para VEEAM_BACKUP', () => {
    expect(typeLabel('VEEAM_BACKUP')).toBe('Veeam');
  });

  it('typeLabelLong retorna "Mantenimiento de backups Veeam" para VEEAM_BACKUP', () => {
    expect(typeLabelLong('VEEAM_BACKUP')).toBe('Mantenimiento de backups Veeam');
  });

  it('typeLabel retorna "VMware / BMC" para SERVER_HOST_MAINTENANCE', () => {
    expect(typeLabel('SERVER_HOST_MAINTENANCE')).toBe('VMware / BMC');
  });

  it('typeLabel retorna "Windows / AD" para WINDOWS_DOMAIN_MAINTENANCE', () => {
    expect(typeLabel('WINDOWS_DOMAIN_MAINTENANCE')).toBe('Windows / AD');
  });

  it('typeLabelLong retorna "Mantenimiento de hosts VMware" para SERVER_HOST_MAINTENANCE', () => {
    expect(typeLabelLong('SERVER_HOST_MAINTENANCE')).toBe('Mantenimiento de hosts VMware');
  });

  it('typeLabelLong retorna "Mantenimiento Windows y dominios" para WINDOWS_DOMAIN_MAINTENANCE', () => {
    expect(typeLabelLong('WINDOWS_DOMAIN_MAINTENANCE')).toBe('Mantenimiento Windows y dominios');
  });

  it('typeLabel retorna "Router / FW" para ROUTER_MAINTENANCE', () => {
    expect(typeLabel('ROUTER_MAINTENANCE')).toBe('Router / FW');
  });

  it('typeLabelLong retorna "Mantenimiento de router y firewall" para ROUTER_MAINTENANCE', () => {
    expect(typeLabelLong('ROUTER_MAINTENANCE')).toBe('Mantenimiento de router y firewall');
  });

});
