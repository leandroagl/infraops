import { BmcAlertCategory, QNAPSection, ServerMaintenancePayload, TerminalPayload } from './maintenance-log.models';

describe('maintenance-log.models', () => {
  describe('ServerMaintenancePayload', () => {
    it('should narrow ServerMaintenancePayload by type field', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
      };
      expect(p.type).toBe('SERVER_MAINTENANCE');
    });

    it('should accept windows section with server entries', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: {
          servers: [
            { serverId: 1, serverName: '47DC', updates: 'ok' },
          ],
          domainControllers: [],
        },
      };
      expect(p.windows.servers.length).toBe(1);
      expect(p.windows.servers[0].serverName).toBe('47DC');
    });

    it('should accept all updates values', () => {
      const values: Array<'ok' | 'pending' | 'failed'> = ['ok', 'pending', 'failed'];
      values.forEach(updates => {
        const p: ServerMaintenancePayload = {
          type: 'SERVER_MAINTENANCE',
          windows: {
            servers: [{ serverId: 1, serverName: '47DC', updates }],
            domainControllers: [],
          },
        };
        expect(p.windows.servers[0].updates).toBe(updates);
      });
    });

    it('should accept domainControllers as array of DcHealthSnapshot', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: {
          servers: [],
          domainControllers: [{
            is_dc: true, dc_name: 'DC01', domain: 'contoso.local', collected_at: '2026-06-17T10:00:00Z',
            repl_healthy: true, repl_failures: 0, repl_partners: 1, repl_max_age_hours: 1,
            dns_test_pass: true, dns_service_ok: true, dns_srv_ok: true, dns_zone_count: 3,
            sysvol_state_ok: true, sysvol_backlog: 0, sysvol_replication: 'DFSR',
            warnings: [],
          }],
        },
      };
      expect(p.windows.domainControllers.length).toBe(1);
      expect(p.windows.domainControllers[0].dc_name).toBe('DC01');
    });

    it('should accept vmware as array of host entries', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        vmware: [
          { hostId: 2, hostName: 'host1.kemini', cpuUsage: 45, memUsage: 60, storageUsage: 55, snapshotsOk: true },
          { hostId: 22, hostName: 'host2.kemini', cpuUsage: 30, memUsage: 50, storageUsage: 40, snapshotsOk: false },
        ],
      };
      expect(p.vmware?.length).toBe(2);
      expect(p.vmware?.[0].hostName).toBe('host1.kemini');
      expect(p.vmware?.[1].snapshotsOk).toBe(false);
    });

    it('should accept qnap section with diskCount, totalSpaceGB, usedSpaceGB and disksWithError', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        qnap: [{
          deviceId: 10,
          deviceName: 'QNAP TS-453D',
          diskCount: 4,
          totalSpaceGB: 16000,
          usedSpaceGB: 11200,
          disksWithError: [],
          raidStatus: 'ok',
          firmwareVersion: '5.1.0.2566',
          firmwareUpdated: false,
        }],
      };
      expect(p.qnap?.[0].diskCount).toBe(4);
      expect(p.qnap?.[0].totalSpaceGB).toBe(16000);
      expect(p.qnap?.[0].usedSpaceGB).toBe(11200);
      expect(p.qnap?.[0].disksWithError).toEqual([]);
      expect(p.qnap?.[0].firmwareVersion).toBe('5.1.0.2566');
    });

    it('should accept qnap entry with raidStatus degraded and disksWithError list', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        qnap: [{
          deviceId: 10,
          deviceName: 'QNAP TS-453D',
          diskCount: 4,
          totalSpaceGB: 16000,
          usedSpaceGB: 11200,
          disksWithError: ['Disk 2'],
          raidStatus: 'degraded',
          firmwareVersion: '5.1.0.2566',
          firmwareUpdated: false,
        }],
      };
      expect(p.qnap?.[0].raidStatus).toBe('degraded');
      expect(p.qnap?.[0].disksWithError).toEqual(['Disk 2']);
    });

    it('should accept qnap entry with firmwareUpdated true and firmwareNewVersion', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        qnap: [{
          deviceId: 10,
          deviceName: 'QNAP TS-453D',
          diskCount: 4,
          totalSpaceGB: 16000,
          usedSpaceGB: 11200,
          disksWithError: [],
          raidStatus: 'ok',
          firmwareVersion: '5.1.0.2400',
          firmwareUpdated: true,
          firmwareNewVersion: '5.1.0.2566',
        }],
      };
      expect(p.qnap?.[0].firmwareUpdated).toBeTrue();
      expect(p.qnap?.[0].firmwareNewVersion).toBe('5.1.0.2566');
    });

    it('should accept qnap entry without firmwareNewVersion when not updated', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        qnap: [{
          deviceId: 10,
          deviceName: 'QNAP TS-453D',
          diskCount: 2,
          totalSpaceGB: 8000,
          usedSpaceGB: 3200,
          disksWithError: [],
          raidStatus: 'ok',
          firmwareVersion: '4.5.4.2117',
          firmwareUpdated: false,
        }],
      };
      expect(p.qnap?.[0].firmwareNewVersion).toBeUndefined();
    });

    it('should accept multiple qnap entries', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        qnap: [
          {
            deviceId: 10, deviceName: 'QNAP-A',
            diskCount: 4, totalSpaceGB: 16000, usedSpaceGB: 8000,
            disksWithError: [], raidStatus: 'ok',
            firmwareVersion: '5.1.0.2566', firmwareUpdated: false,
          },
          {
            deviceId: 11, deviceName: 'QNAP-B',
            diskCount: 2, totalSpaceGB: 4000, usedSpaceGB: 3900,
            disksWithError: ['Disk 1', 'Disk 2'], raidStatus: 'failed',
            firmwareVersion: '4.5.4.2117', firmwareUpdated: false,
          },
        ],
      };
      expect(p.qnap?.length).toBe(2);
      expect(p.qnap?.[1].disksWithError.length).toBe(2);
      expect(p.qnap?.[1].raidStatus).toBe('failed');
    });

    it('should accept optional veeam section with missingVMs as string array', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        veeam: { status: 'missing', missingVMs: ['VM-WEB01', 'VM-SQL01'] },
      };
      expect(p.veeam?.status).toBe('missing');
      expect(p.veeam?.missingVMs).toEqual(['VM-WEB01', 'VM-SQL01']);
    });

    it('should accept optional router section as array of RouterEntry', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        router: [{ routerId: 1, routerName: 'MikroTik', firmwareUpdated: true, firmwareVersion: '7.14.2', backupDone: true }],
      };
      expect(p.router![0].firmwareUpdated).toBe(true);
      expect(p.router![0].routerName).toBe('MikroTik');
    });

    it('should accept optional bmc section as array of BmcEntry', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        bmc: [
          { hostId: 2, hostName: 'host1.kemini', firmwareVersion: '2.82', biosVersion: 'U30 v2.86', alertStatus: 'ok' },
          { hostId: 3, hostName: 'host2.kemini', alertStatus: 'alerta', alertCategories: ['fan', 'psu'], alertLogs: 'Fan1 speed: critical' },
        ],
      };
      expect(p.bmc?.length).toBe(2);
      expect(p.bmc?.[0].alertStatus).toBe('ok');
      expect(p.bmc?.[1].alertCategories).toEqual(['fan', 'psu']);
      expect(p.bmc?.[1].alertLogs).toBe('Fan1 speed: critical');
    });

    it('should accept BmcEntry without optional fields', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        bmc: [{ hostId: 1, hostName: 'host1', alertStatus: 'ok' }],
      };
      expect(p.bmc?.[0].firmwareVersion).toBeUndefined();
      expect(p.bmc?.[0].biosVersion).toBeUndefined();
      expect(p.bmc?.[0].alertCategories).toBeUndefined();
      expect(p.bmc?.[0].alertLogs).toBeUndefined();
    });

    it('should accept alertLogs as optional string on any alertStatus', () => {
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        bmc: [{ hostId: 1, hostName: 'host1', alertStatus: 'ok', alertLogs: 'No events in last 7 days' }],
      };
      expect(p.bmc?.[0].alertLogs).toBe('No events in last 7 days');
    });

    it('should accept all BmcAlertCategory values', () => {
      const categories: BmcAlertCategory[] = ['fan', 'psu', 'temperatura', 'cpu', 'memoria', 'storage', 'nic', 'sistema'];
      const p: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: { servers: [], domainControllers: [] },
        bmc: [{ hostId: 1, hostName: 'host1', alertStatus: 'alerta', alertCategories: categories }],
      };
      expect(p.bmc?.[0].alertCategories?.length).toBe(8);
    });

    it('should accept QNAPSection with totalSpaceUnit and usedSpaceUnit', () => {
      const section: QNAPSection = {
        deviceId: 10,
        deviceName: 'QNAP',
        diskCount: 4,
        totalSpaceGB: 8,
        totalSpaceUnit: 'TB',
        usedSpaceGB: 5,
        usedSpaceUnit: 'TB',
        disksWithError: [],
        raidStatus: 'ok',
        firmwareVersion: '5.1.0.2566',
        firmwareUpdated: false,
      };
      expect(section.totalSpaceUnit).toBe('TB');
      expect(section.usedSpaceUnit).toBe('TB');
    });

    it('should accept QNAPSection without unit fields (backward compat)', () => {
      const section: QNAPSection = {
        deviceId: 10,
        deviceName: 'QNAP',
        diskCount: 4,
        totalSpaceGB: 16000,
        usedSpaceGB: 11200,
        disksWithError: [],
        raidStatus: 'ok',
        firmwareVersion: '5.1.0.2566',
        firmwareUpdated: false,
      };
      expect(section.totalSpaceUnit).toBeUndefined();
      expect(section.usedSpaceUnit).toBeUndefined();
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
