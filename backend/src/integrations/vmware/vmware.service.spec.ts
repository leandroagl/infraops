import { BadGatewayException, GatewayTimeoutException } from '@nestjs/common';
import * as cp from 'child_process';
import { EventEmitter } from 'events';
import { VmwareService } from './vmware.service';

jest.mock('child_process');

const mockSpawn = cp.spawn as jest.MockedFunction<typeof cp.spawn>;

const MOCK_RESULT = {
  host: {
    name: 'esxi01', esxiVersion: 'VMware ESXi 7.0.3 build-21930508',
    uptimeHours: 100, cpuUsagePct: 20, memUsagePct: 50,
    memOvercommitRatio: 1.2, overallStatus: 'green', hardwareAlerts: [],
  },
  datastores: [], vms: { poweredOn: 3, poweredOff: 1, suspended: 0, snapshots: [], toolsNotOk: 0 },
  network: { vswitchErrors: [], nicsFailed: [] },
  collectedAt: '2026-06-29T00:00:00.000Z',
};

function makeProc(opts: { stdout?: string; stderr?: string; exitCode?: number; hang?: boolean }) {
  const stdoutEm = new EventEmitter();
  const stderrEm = new EventEmitter();
  const procEm   = new EventEmitter();
  const proc = {
    stdout: stdoutEm,
    stderr: stderrEm,
    on: (ev: string, fn: (...args: any[]) => void) => procEm.on(ev, fn),
    kill: jest.fn(),
  };
  mockSpawn.mockReturnValue(proc as any);
  if (!opts.hang) {
    setImmediate(() => {
      if (opts.stdout) stdoutEm.emit('data', Buffer.from(opts.stdout));
      if (opts.stderr) stderrEm.emit('data', Buffer.from(opts.stderr ?? ''));
      procEm.emit('close', opts.exitCode ?? 0);
    });
  }
  return proc;
}

describe('VmwareService', () => {
  let service: VmwareService;

  beforeEach(() => {
    service = new VmwareService();
    jest.clearAllMocks();
  });

  it('retorna VmwareHealthResult cuando el script finaliza con exit code 0', async () => {
    makeProc({ stdout: JSON.stringify(MOCK_RESULT), exitCode: 0 });
    const result = await service.runHealthCheck('192.168.1.10:344');
    expect(result.host.name).toBe('esxi01');
    expect(result.datastores).toEqual([]);
  });

  it('parsea host y puerto de hostUri correctamente', async () => {
    makeProc({ stdout: JSON.stringify(MOCK_RESULT), exitCode: 0 });
    await service.runHealthCheck('esxi.cliente.com:346');
    expect(mockSpawn).toHaveBeenCalledWith(
      'python3',
      expect.arrayContaining(['--host', 'esxi.cliente.com', '--port', '346']),
    );
  });

  it('lanza BadGatewayException cuando exit code es 1', async () => {
    makeProc({ stderr: 'Error de conexión al host', exitCode: 1 });
    await expect(service.runHealthCheck('192.168.1.10:344'))
      .rejects.toThrow(BadGatewayException);
  });

  it('incluye el mensaje de stderr en BadGatewayException', async () => {
    makeProc({ stderr: 'Authentication failed', exitCode: 1 });
    await expect(service.runHealthCheck('192.168.1.10:344'))
      .rejects.toThrow('Authentication failed');
  });

  it('lanza BadGatewayException cuando stdout no es JSON válido', async () => {
    makeProc({ stdout: 'no es json', exitCode: 0 });
    await expect(service.runHealthCheck('192.168.1.10:344'))
      .rejects.toThrow(BadGatewayException);
  });

  it('lanza GatewayTimeoutException y mata el proceso después de 30 segundos', async () => {
    jest.useFakeTimers();
    const proc = makeProc({ hang: true });
    const promise = service.runHealthCheck('192.168.1.10:344');
    jest.advanceTimersByTime(30_001);
    await expect(promise).rejects.toThrow(GatewayTimeoutException);
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    jest.useRealTimers();
  });
});
