import { TaskType } from '../../tasks/task-type.enum';
import { QnapPayload, VeeamBackupPayload, WindowsDomainPayload } from '../log-item.interface';
import { DeviationSignal } from './deviation-signal.interface';
import { anyDiskWithError, maxUsedSpacePct } from './qnap.signals';
import { anyVmWithoutBackup } from './veeam.signals';
import {
  anyDcWithDnsIssue,
  anyDcWithReplIssue,
  anyDcWithSysvolIssue,
  anyServerWithPendingUpdates,
  anyServerWithRestartScriptError,
} from './windows.signals';

const DEVIATION_SIGNALS: Partial<Record<TaskType, DeviationSignal<any>[]>> = {
  [TaskType.QNAP_MAINTENANCE]: [
    {
      key: 'anyDiskWithError',
      label: 'Algún disco con error',
      valueType: 'boolean',
      compute: (payload: QnapPayload) => anyDiskWithError(payload),
    },
    {
      key: 'maxUsedSpacePct',
      label: '% de espacio usado (máximo entre dispositivos)',
      valueType: 'number',
      compute: (payload: QnapPayload) => maxUsedSpacePct(payload),
    },
  ],
  [TaskType.VEEAM_BACKUP]: [
    {
      key: 'anyVmWithoutBackup',
      label: 'Alguna VM sin backup',
      valueType: 'boolean',
      compute: (payload: VeeamBackupPayload) => anyVmWithoutBackup(payload),
    },
  ],
  [TaskType.WINDOWS_DOMAIN_MAINTENANCE]: [
    {
      key: 'anyServerWithPendingUpdates',
      label: 'Algún servidor con updates pendientes o fallidas',
      valueType: 'boolean',
      compute: (payload: WindowsDomainPayload) => anyServerWithPendingUpdates(payload),
    },
    {
      key: 'anyServerWithRestartScriptError',
      label: 'Algún servidor con error en script de reinicio',
      valueType: 'boolean',
      compute: (payload: WindowsDomainPayload) => anyServerWithRestartScriptError(payload),
    },
    {
      key: 'anyDcWithReplIssue',
      label: 'Algún DC con replicación con problemas',
      valueType: 'boolean',
      compute: (payload: WindowsDomainPayload) => anyDcWithReplIssue(payload),
    },
    {
      key: 'anyDcWithDnsIssue',
      label: 'Algún DC con DNS con problemas',
      valueType: 'boolean',
      compute: (payload: WindowsDomainPayload) => anyDcWithDnsIssue(payload),
    },
    {
      key: 'anyDcWithSysvolIssue',
      label: 'Algún DC con SYSVOL con problemas',
      valueType: 'boolean',
      compute: (payload: WindowsDomainPayload) => anyDcWithSysvolIssue(payload),
    },
  ],
};

export function getDeviationSignals(taskType: TaskType): DeviationSignal<unknown>[] {
  return DEVIATION_SIGNALS[taskType] ?? [];
}
