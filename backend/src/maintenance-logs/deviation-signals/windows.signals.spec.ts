import { WindowsDomainPayload } from '../log-item.interface';
import {
  anyDcWithDnsIssue,
  anyDcWithReplIssue,
  anyDcWithSysvolIssue,
  anyServerWithPendingUpdates,
  anyServerWithRestartScriptError,
} from './windows.signals';

const basePayload: WindowsDomainPayload = {
  type: 'WINDOWS_DOMAIN_MAINTENANCE',
  windows: {
    servers: [],
    domainControllers: [],
  },
};

const okServer = { serverId: 1, serverName: 'SRV-01', updates: 'ok' as const, restartScript: 'ok' as const };
const pendingServer = { serverId: 2, serverName: 'SRV-02', updates: 'pending' as const, restartScript: 'ok' as const };
const failedServer = { serverId: 3, serverName: 'SRV-03', updates: 'failed' as const, restartScript: 'ok' as const };
const scriptErrorServer = { serverId: 4, serverName: 'SRV-04', updates: 'ok' as const, restartScript: 'error' as const };

const okDc = {
  is_dc: true, dc_name: 'DC-01', domain: 'corp.local', collected_at: '2024-01-01',
  repl_healthy: true, repl_failures: 0, repl_partners: 1, repl_max_age_hours: 1,
  dns_test_pass: true, dns_service_ok: true, dns_srv_ok: true, dns_zone_count: 2,
  sysvol_state_ok: true, sysvol_backlog: 0, sysvol_replication: 'DFS-R', warnings: [],
};

describe('windows.signals', () => {
  describe('anyServerWithPendingUpdates', () => {
    it('retorna false cuando no hay servidores', () => {
      expect(anyServerWithPendingUpdates(basePayload)).toBe(false);
    });

    it('retorna false cuando todos los servidores tienen updates ok', () => {
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, servers: [okServer] } };
      expect(anyServerWithPendingUpdates(payload)).toBe(false);
    });

    it('retorna true cuando algún servidor tiene updates pending', () => {
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, servers: [okServer, pendingServer] } };
      expect(anyServerWithPendingUpdates(payload)).toBe(true);
    });

    it('retorna true cuando algún servidor tiene updates failed', () => {
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, servers: [okServer, failedServer] } };
      expect(anyServerWithPendingUpdates(payload)).toBe(true);
    });
  });

  describe('anyServerWithRestartScriptError', () => {
    it('retorna false cuando no hay servidores', () => {
      expect(anyServerWithRestartScriptError(basePayload)).toBe(false);
    });

    it('retorna false cuando todos los servidores tienen restartScript ok o no_task', () => {
      const noTaskServer = { ...okServer, restartScript: 'no_task' as const };
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, servers: [okServer, noTaskServer] } };
      expect(anyServerWithRestartScriptError(payload)).toBe(false);
    });

    it('retorna true cuando algún servidor tiene restartScript error', () => {
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, servers: [okServer, scriptErrorServer] } };
      expect(anyServerWithRestartScriptError(payload)).toBe(true);
    });
  });

  describe('anyDcWithReplIssue', () => {
    it('retorna false cuando no hay DCs', () => {
      expect(anyDcWithReplIssue(basePayload)).toBe(false);
    });

    it('retorna false cuando todos los DCs tienen replicación saludable', () => {
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [okDc] } };
      expect(anyDcWithReplIssue(payload)).toBe(false);
    });

    it('retorna true cuando algún DC tiene repl_healthy false', () => {
      const badDc = { ...okDc, repl_healthy: false };
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [okDc, badDc] } };
      expect(anyDcWithReplIssue(payload)).toBe(true);
    });

    it('retorna true cuando algún DC tiene repl_healthy null', () => {
      const nullDc = { ...okDc, repl_healthy: null };
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [nullDc] } };
      expect(anyDcWithReplIssue(payload)).toBe(true);
    });
  });

  describe('anyDcWithDnsIssue', () => {
    it('retorna false cuando no hay DCs', () => {
      expect(anyDcWithDnsIssue(basePayload)).toBe(false);
    });

    it('retorna false cuando todos los DCs tienen DNS ok', () => {
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [okDc] } };
      expect(anyDcWithDnsIssue(payload)).toBe(false);
    });

    it('retorna true cuando algún DC tiene dns_test_pass false', () => {
      const badDc = { ...okDc, dns_test_pass: false };
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [badDc] } };
      expect(anyDcWithDnsIssue(payload)).toBe(true);
    });

    it('retorna true cuando algún DC tiene dns_test_pass null', () => {
      const nullDc = { ...okDc, dns_test_pass: null };
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [nullDc] } };
      expect(anyDcWithDnsIssue(payload)).toBe(true);
    });
  });

  describe('anyDcWithSysvolIssue', () => {
    it('retorna false cuando no hay DCs', () => {
      expect(anyDcWithSysvolIssue(basePayload)).toBe(false);
    });

    it('retorna false cuando todos los DCs tienen SYSVOL ok', () => {
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [okDc] } };
      expect(anyDcWithSysvolIssue(payload)).toBe(false);
    });

    it('retorna true cuando algún DC tiene sysvol_state_ok false', () => {
      const badDc = { ...okDc, sysvol_state_ok: false };
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [badDc] } };
      expect(anyDcWithSysvolIssue(payload)).toBe(true);
    });

    it('retorna true cuando algún DC tiene sysvol_state_ok null', () => {
      const nullDc = { ...okDc, sysvol_state_ok: null };
      const payload: WindowsDomainPayload = { ...basePayload, windows: { ...basePayload.windows, domainControllers: [nullDc] } };
      expect(anyDcWithSysvolIssue(payload)).toBe(true);
    });
  });
});
