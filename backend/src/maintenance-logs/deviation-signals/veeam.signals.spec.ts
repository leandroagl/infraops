import { VeeamBackupPayload } from '../log-item.interface';
import { anyVmWithoutBackup } from './veeam.signals';

describe('veeam deviation signals', () => {
  describe('anyVmWithoutBackup', () => {
    it('es true si alguna VM tiene coverage no_backup', () => {
      const payload: VeeamBackupPayload = {
        type: 'VEEAM_BACKUP',
        notes: null,
        vms: [
          { vmName: 'VM1', coverage: 'job', fullsInMonth: 2 },
          { vmName: 'VM2', coverage: 'no_backup', fullsInMonth: null },
        ],
      };
      expect(anyVmWithoutBackup(payload)).toBe(true);
    });

    it('es false si todas las VMs tienen alguna cobertura', () => {
      const payload: VeeamBackupPayload = {
        type: 'VEEAM_BACKUP',
        notes: null,
        vms: [
          { vmName: 'VM1', coverage: 'job', fullsInMonth: 2 },
          { vmName: 'VM2', coverage: 'agent', fullsInMonth: 1 },
          { vmName: 'VM3', coverage: 'excluded', fullsInMonth: null },
        ],
      };
      expect(anyVmWithoutBackup(payload)).toBe(false);
    });

    it('es false si no hay VMs registradas', () => {
      const payload: VeeamBackupPayload = { type: 'VEEAM_BACKUP', notes: null, vms: [] };
      expect(anyVmWithoutBackup(payload)).toBe(false);
    });
  });
});
