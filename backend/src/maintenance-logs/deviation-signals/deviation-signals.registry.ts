import { TaskType } from '../../tasks/task-type.enum';
import { QnapPayload, VeeamBackupPayload } from '../log-item.interface';
import { DeviationSignal } from './deviation-signal.interface';
import { anyDiskWithError, maxUsedSpacePct } from './qnap.signals';
import { anyVmWithoutBackup } from './veeam.signals';

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
};

export function getDeviationSignals(taskType: TaskType): DeviationSignal<unknown>[] {
  return DEVIATION_SIGNALS[taskType] ?? [];
}
