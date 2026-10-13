import { TaskType } from '../../tasks/task-type.enum';
import { QnapPayload } from '../log-item.interface';
import { getDeviationSignals } from './deviation-signals.registry';

describe('deviation signals registry', () => {
  it('devuelve las señales de QNAP con sus keys esperadas', () => {
    const keys = getDeviationSignals(TaskType.QNAP_MAINTENANCE).map((s) => s.key);
    expect(keys).toEqual(['anyDiskWithError', 'maxUsedSpacePct']);
  });

  it('devuelve la señal de Veeam esperada', () => {
    const keys = getDeviationSignals(TaskType.VEEAM_BACKUP).map((s) => s.key);
    expect(keys).toEqual(['anyVmWithoutBackup']);
  });

  it('devuelve las señales de Windows Domain con sus keys esperadas', () => {
    const keys = getDeviationSignals(TaskType.WINDOWS_DOMAIN_MAINTENANCE).map((s) => s.key);
    expect(keys).toEqual([
      'anyServerWithPendingUpdates',
      'anyServerWithRestartScriptError',
      'anyDcWithReplIssue',
      'anyDcWithDnsIssue',
      'anyDcWithSysvolIssue',
    ]);
  });

  it('devuelve array vacío para un TaskType sin señales configuradas todavía', () => {
    expect(getDeviationSignals(TaskType.TERMINAL_MAINTENANCE)).toEqual([]);
  });

  it('el compute de cada señal registrada da el mismo resultado que la función standalone', () => {
    const payload: QnapPayload = {
      type: 'QNAP_MAINTENANCE',
      qnap: [
        {
          deviceId: 1,
          deviceName: 'NAS-1',
          diskCount: 4,
          totalSpaceGB: 100,
          usedSpaceGB: 90,
          disksWithError: [],
          raidStatus: 'ok',
          firmwareVersion: '5.0',
          firmwareUpdated: true,
        },
      ],
    };
    const signals = getDeviationSignals(TaskType.QNAP_MAINTENANCE);
    const maxUsed = signals.find((s) => s.key === 'maxUsedSpacePct')!;
    expect(maxUsed.compute(payload)).toBe(90);
    expect(maxUsed.valueType).toBe('number');

    const anyError = signals.find((s) => s.key === 'anyDiskWithError')!;
    expect(anyError.compute(payload)).toBe(false);
    expect(anyError.valueType).toBe('boolean');
  });
});
