import { ServerMaintenancePayload, TerminalPayload } from './maintenance-log.models';

describe('maintenance-log.models', () => {
  describe('ServerMaintenancePayload', () => {
    it('should narrow ServerMaintenancePayload by type field', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
      };
      expect(p.type).toBe('SERVER_MAINTENANCE');
    });

    it('should accept windows section with server entries', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: {
          servers: [
            { serverId: 1, serverName: '47DC', rebootScript: 'ok', updates: 'ok' },
          ],
          dcdiag: 'OK',
        },
      };
      expect(p.windows.servers.length).toBe(1);
      expect(p.windows.servers[0].rebootScript).toBe('ok');
    });

    it('should accept all rebootScript values', () => {
      const values: Array<'ok' | 'error' | 'falta_configurar'> = ['ok', 'error', 'falta_configurar'];
      values.forEach(rebootScript => {
        const p: ServerMaintenancePayload = {
          type: 'SERVER_MAINTENANCE',
          windows: {
            servers: [{ serverId: 1, serverName: '47DC', rebootScript, updates: 'ok' }],
            dcdiag: 'OK',
          },
        };
        expect(p.windows.servers[0].rebootScript).toBe(rebootScript);
      });
    });

    it('should accept optional dcdiagDetail when dcdiag starts with ERROR', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: {
          servers: [],
          dcdiag: 'ERROR: DNS lookup failed',
          dcdiagDetail: 'DNS server unreachable',
        },
      };
      expect(p.windows.dcdiagDetail).toBe('DNS server unreachable');
    });

    it('should accept vmware as array of host entries', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        vmware: [
          { hostId: 2, hostName: 'host1.kemini', cpuUsage: 45, memUsage: 60, storageUsage: 55, snapshotsOk: true },
          { hostId: 22, hostName: 'host2.kemini', cpuUsage: 30, memUsage: 50, storageUsage: 40, snapshotsOk: false },
        ],
      };
      expect(p.vmware?.length).toBe(2);
      expect(p.vmware?.[0].hostName).toBe('host1.kemini');
      expect(p.vmware?.[1].snapshotsOk).toBe(false);
    });

    it('should accept optional qnap section as array with degraded status', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        qnap: [{ deviceId: 10, deviceName: 'QNAP TS-453D', spaceUsed: 65, raidStatus: 'degraded', firmwareUpdated: false }],
      };
      expect(p.qnap?.[0].raidStatus).toBe('degraded');
    });

    it('should accept optional veeam section with missingVMs as string array', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        veeam: { status: 'missing', missingVMs: ['VM-WEB01', 'VM-SQL01'] },
      };
      expect(p.veeam?.status).toBe('missing');
      expect(p.veeam?.missingVMs).toEqual(['VM-WEB01', 'VM-SQL01']);
    });

    it('should accept optional router section', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        router: { firmwareUpdated: true, firmwareVersion: '7.14.2', backupDone: true },
      };
      expect(p.router?.firmwareUpdated).toBe(true);
    });

    it('should accept optional bmc section as array of BmcEntry', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        bmc: [
          { hostId: 2, hostName: 'host1.kemini', firmwareVersion: '2.82', biosVersion: 'U30 v2.86', alertStatus: 'ok' },
          { hostId: 3, hostName: 'host2.kemini', alertStatus: 'alerta', alertNote: 'Fan sensor warning' },
        ],
      };
      expect(p.bmc?.length).toBe(2);
      expect(p.bmc?.[0].alertStatus).toBe('ok');
      expect(p.bmc?.[1].alertNote).toBe('Fan sensor warning');
    });

    it('should accept BmcEntry without optional fields', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        bmc: [{ hostId: 1, hostName: 'host1', alertStatus: 'ok' }],
      };
      expect(p.bmc?.[0].firmwareVersion).toBeUndefined();
      expect(p.bmc?.[0].biosVersion).toBeUndefined();
      expect(p.bmc?.[0].alertNote).toBeUndefined();
    });
  });

  describe('TerminalPayload', () => {
    it('should narrow TerminalPayload by type field', () => {
      const p: TerminalPayload = {
        type: 'TERMINAL_MAINTENANCE',
        checks: { cleanedTemp: false, windowsUpdates: false, antivirusOk: false, diskSpace: false, licenses: false },
        network: { connectivity: false, switches: false },
      };
      expect(p.type).toBe('TERMINAL_MAINTENANCE');
    });

    it('should accept all checklist booleans', () => {
      const p: TerminalPayload = {
        type: 'TERMINAL_MAINTENANCE',
        checks: { cleanedTemp: true, windowsUpdates: true, antivirusOk: true, diskSpace: true, licenses: true },
        network: { connectivity: true, switches: true },
      };
      expect(p.checks.cleanedTemp).toBe(true);
      expect(p.checks.licenses).toBe(true);
    });

    it('should accept optional observations field', () => {
      const p: TerminalPayload = {
        type: 'TERMINAL_MAINTENANCE',
        checks: { cleanedTemp: true, windowsUpdates: false, antivirusOk: true, diskSpace: true, licenses: true },
        network: { connectivity: true, switches: false },
        observations: 'Se reemplazó teclado en terminal 3',
      };
      expect(p.observations).toBe('Se reemplazó teclado en terminal 3');
    });

    it('should accept optional notes field', () => {
      const p: TerminalPayload = {
        type: 'TERMINAL_MAINTENANCE',
        checks: { cleanedTemp: true, windowsUpdates: true, antivirusOk: true, diskSpace: true, licenses: true },
        network: { connectivity: true, switches: true },
        notes: 'Visita realizada con normalidad',
      };
      expect(p.notes).toBe('Visita realizada con normalidad');
    });
  });
});
