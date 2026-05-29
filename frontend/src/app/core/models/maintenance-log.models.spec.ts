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
            { serverId: 1, serverName: 'SRV-DC01', reboot: 'no', updates: 'ok' },
          ],
          dcdiag: 'OK',
        },
      };
      expect(p.windows.servers.length).toBe(1);
      expect(p.windows.servers[0].reboot).toBe('no');
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

    it('should accept optional vmware section', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        vmware: {
          cpuUsage: 45,
          memUsage: 60,
          storageUsage: 55,
          snapshotsOk: true,
        },
      };
      expect(p.vmware?.cpuUsage).toBe(45);
      expect(p.vmware?.snapshotsOk).toBe(true);
    });

    it('should accept optional qnap section', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        qnap: { spaceUsed: 65, raidStatus: 'ok', firmwareUpdated: false },
      };
      expect(p.qnap?.raidStatus).toBe('ok');
    });

    it('should accept optional veeam section', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        veeam: { status: 'partial', affectedVMs: 'VM-WEB01' },
      };
      expect(p.veeam?.status).toBe('partial');
    });

    it('should accept optional router section', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], dcdiag: 'OK' },
        router: { firmwareUpdated: true, firmwareVersion: '1.2.3', backupDone: true },
      };
      expect(p.router?.firmwareUpdated).toBe(true);
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
