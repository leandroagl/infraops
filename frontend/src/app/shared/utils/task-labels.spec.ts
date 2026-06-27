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
      ['SERVER_MAINTENANCE',   'Servidores'],
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
      ['SERVER_MAINTENANCE',   'Mantenimiento de servidores'],
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
    it('TERMINAL_MAINTENANCE → "badge--purple"', () => {
      expect(typeBadge('TERMINAL_MAINTENANCE')).toBe('badge--purple');
    });
    it('SITE_VISIT → "badge--purple"', () => {
      expect(typeBadge('SITE_VISIT')).toBe('badge--purple');
    });
    it('SERVER_MAINTENANCE → "badge--srv"', () => {
      expect(typeBadge('SERVER_MAINTENANCE')).toBe('badge--srv');
    });
    it('AV_CONTROL → "badge--srv"', () => {
      expect(typeBadge('AV_CONTROL')).toBe('badge--srv');
    });
    it('UPS_CONTROL → "badge--srv"', () => {
      expect(typeBadge('UPS_CONTROL')).toBe('badge--srv');
    });
    it('ENDPOINT_INVENTORY → "badge--srv"', () => {
      expect(typeBadge('ENDPOINT_INVENTORY')).toBe('badge--srv');
    });
  });

  it('typeLabel retorna "Veeam" para VEEAM_BACKUP', () => {
    expect(typeLabel('VEEAM_BACKUP')).toBe('Veeam');
  });

  it('typeLabelLong retorna "Mantenimiento de backups Veeam" para VEEAM_BACKUP', () => {
    expect(typeLabelLong('VEEAM_BACKUP')).toBe('Mantenimiento de backups Veeam');
  });

  it('typeBadge retorna "badge--srv" para VEEAM_BACKUP', () => {
    expect(typeBadge('VEEAM_BACKUP')).toBe('badge--srv');
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

  it('typeBadge retorna "badge--srv" para SERVER_HOST_MAINTENANCE', () => {
    expect(typeBadge('SERVER_HOST_MAINTENANCE')).toBe('badge--srv');
  });

  it('typeBadge retorna "badge--srv" para WINDOWS_DOMAIN_MAINTENANCE', () => {
    expect(typeBadge('WINDOWS_DOMAIN_MAINTENANCE')).toBe('badge--srv');
  });

});
