import { VeeamBackupPayload } from '../log-item.interface';

export function anyVmWithoutBackup(payload: VeeamBackupPayload): boolean {
  return payload.vms.some((vm) => vm.coverage === 'no_backup');
}
