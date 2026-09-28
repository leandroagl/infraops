import { QnapPayload } from '../log-item.interface';
import { anyDiskWithError, maxUsedSpacePct } from './qnap.signals';

function device(overrides: Partial<QnapPayload['qnap'][number]> = {}): QnapPayload['qnap'][number] {
  return {
    deviceId: 1,
    deviceName: 'NAS-1',
    diskCount: 4,
    totalSpaceGB: 100,
    usedSpaceGB: 50,
    disksWithError: [],
    raidStatus: 'ok',
    firmwareVersion: '5.0',
    firmwareUpdated: true,
    ...overrides,
  };
}

describe('qnap deviation signals', () => {
  describe('anyDiskWithError', () => {
    it('es true si algún dispositivo tiene discos con error', () => {
      const payload: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [device(), device({ deviceId: 2, disksWithError: ['Disk 3'] })],
      };
      expect(anyDiskWithError(payload)).toBe(true);
    });

    it('es false si ningún dispositivo tiene discos con error', () => {
      const payload: QnapPayload = { type: 'QNAP_MAINTENANCE', qnap: [device()] };
      expect(anyDiskWithError(payload)).toBe(false);
    });

    it('es false si no hay dispositivos QNAP registrados', () => {
      const payload: QnapPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };
      expect(anyDiskWithError(payload)).toBe(false);
    });
  });

  describe('maxUsedSpacePct', () => {
    it('calcula el % usado cuando todo está en GB', () => {
      const payload: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [device({ totalSpaceGB: 100, usedSpaceGB: 90 })],
      };
      expect(maxUsedSpacePct(payload)).toBe(90);
    });

    it('normaliza TB a GB (1 TB = 1024 GB) antes de calcular el %, igual que la card de QNAP en el drawer', () => {
      const payload: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [
          device({
            totalSpaceGB: 4,
            totalSpaceUnit: 'TB',
            usedSpaceGB: 3,
            usedSpaceUnit: 'TB',
          }),
        ],
      };
      expect(maxUsedSpacePct(payload)).toBe(75);
    });

    it('devuelve el máximo entre varios dispositivos', () => {
      const payload: QnapPayload = {
        type: 'QNAP_MAINTENANCE',
        qnap: [
          device({ deviceId: 1, totalSpaceGB: 100, usedSpaceGB: 50 }),
          device({ deviceId: 2, totalSpaceGB: 100, usedSpaceGB: 92 }),
        ],
      };
      expect(maxUsedSpacePct(payload)).toBe(92);
    });

    it('devuelve null si no hay dispositivos QNAP registrados', () => {
      const payload: QnapPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };
      expect(maxUsedSpacePct(payload)).toBeNull();
    });
  });
});
