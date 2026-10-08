import { WindowsDomainPayload } from '../log-item.interface';

export function anyServerWithPendingUpdates(payload: WindowsDomainPayload): boolean {
  return payload.windows.servers.some((s) => s.updates !== 'ok');
}

export function anyServerWithRestartScriptError(payload: WindowsDomainPayload): boolean {
  return payload.windows.servers.some((s) => s.restartScript === 'error');
}

export function anyDcWithReplIssue(payload: WindowsDomainPayload): boolean {
  return payload.windows.domainControllers.some((dc) => dc.repl_healthy !== true);
}

export function anyDcWithDnsIssue(payload: WindowsDomainPayload): boolean {
  return payload.windows.domainControllers.some((dc) => dc.dns_test_pass !== true);
}

export function anyDcWithSysvolIssue(payload: WindowsDomainPayload): boolean {
  return payload.windows.domainControllers.some((dc) => dc.sysvol_state_ok !== true);
}
