import { QNAPSection, QnapPayload } from '../log-item.interface';

const GB_PER_TB = 1024;

function toGB(value: number, unit: 'GB' | 'TB' | undefined): number {
  return unit === 'TB' ? value * GB_PER_TB : value;
}

function usedSpacePct(device: QNAPSection): number {
  const total = toGB(device.totalSpaceGB, device.totalSpaceUnit);
  const used = toGB(device.usedSpaceGB, device.usedSpaceUnit);
  return total ? (used / total) * 100 : 0;
}

export function anyDiskWithError(payload: QnapPayload): boolean {
  return payload.qnap.some((device) => device.disksWithError.length > 0);
}

export function maxUsedSpacePct(payload: QnapPayload): number | null {
  if (payload.qnap.length === 0) return null;
  return Math.max(...payload.qnap.map(usedSpacePct));
}
