import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { QnapDeviceCardComponent } from './qnap-device-card.component';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

const fb = new FormBuilder();

function makeGroup(overrides: {
  diskCount?: number | null;
  totalSpaceGB?: number | null;
  totalSpaceUnit?: 'GB' | 'TB';
  usedSpaceGB?: number | null;
  usedSpaceUnit?: 'GB' | 'TB';
  disksWithError?: string[];
  raidStatus?: string;
  firmwareVersion?: string;
  firmwareUpdated?: boolean;
  firmwareNewVersion?: string;
} = {}) {
  return fb.group({
    diskCount:          [overrides.diskCount          ?? null],
    totalSpaceGB:       [overrides.totalSpaceGB       ?? null],
    totalSpaceUnit:     [overrides.totalSpaceUnit      ?? 'TB'],
    usedSpaceGB:        [overrides.usedSpaceGB        ?? null],
    usedSpaceUnit:      [overrides.usedSpaceUnit       ?? 'TB'],
    disksWithError:     [overrides.disksWithError      ?? []],
    raidStatus:         [overrides.raidStatus          ?? 'ok'],
    firmwareVersion:    [overrides.firmwareVersion     ?? ''],
    firmwareUpdated:    [overrides.firmwareUpdated     ?? false],
    firmwareNewVersion: [overrides.firmwareNewVersion  ?? ''],
  });
}

const mockDevice: InfraAsset = {
  assetId: 1, name: 'QNAP – TS-219P+', ip: '192.168.0.132',
  bmcIp: null, bmcType: null, os: null, model: 'TS-219P+',
  uri1: null, uri2: null,
};

const meta: Meta<QnapDeviceCardComponent> = {
  title: 'QNAP/QnapDeviceCard',
  component: QnapDeviceCardComponent,
  decorators: [
    moduleMetadata({
      declarations: [QnapDeviceCardComponent],
      imports: [
        ReactiveFormsModule, CommonModule,
        MatFormFieldModule, MatInputModule,
        MatSelectModule, MatCheckboxModule,
      ],
    }),
  ],
  argTypes: {
    readOnly: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<QnapDeviceCardComponent>;

// ── Healthy ────────────────────────────────────────────────────
// RAID ok, 45% espacio usado — todo verde
export const Healthy: Story = {
  render: (args) => ({
    props: {
      device: mockDevice,
      group: makeGroup({
        diskCount: 4, totalSpaceGB: 4, totalSpaceUnit: 'TB',
        usedSpaceGB: 1.8, usedSpaceUnit: 'TB',
        raidStatus: 'ok', firmwareVersion: '5.1.0.2566',
      }),
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── StorageWarning ─────────────────────────────────────────────
// RAID ok, 75% espacio — badge de espacio en warn, barra amarilla
export const StorageWarning: Story = {
  render: (args) => ({
    props: {
      device: mockDevice,
      group: makeGroup({
        diskCount: 4, totalSpaceGB: 4, totalSpaceUnit: 'TB',
        usedSpaceGB: 3, usedSpaceUnit: 'TB',
        raidStatus: 'ok', firmwareVersion: '5.1.0.2566',
      }),
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── DiskError ──────────────────────────────────────────────────
// RAID degraded, Disk 2 con error — badge RAID en warn, chip visible
export const DiskError: Story = {
  render: (args) => ({
    props: {
      device: { ...mockDevice, name: 'QNAP – VS-8148UPro+', ip: '192.168.0.199' },
      group: makeGroup({
        diskCount: 8, totalSpaceGB: 48, totalSpaceUnit: 'TB',
        usedSpaceGB: 20, usedSpaceUnit: 'TB',
        raidStatus: 'degraded', disksWithError: ['Disk 2'],
        firmwareVersion: '5.0.0.1932',
      }),
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── Critical ───────────────────────────────────────────────────
// RAID failed, 90% espacio, Disk 1 + Disk 3 con error — todo rojo
export const Critical: Story = {
  render: (args) => ({
    props: {
      device: { ...mockDevice, name: 'NAS – QNAP Cramer', ip: '192.168.10.15' },
      group: makeGroup({
        diskCount: 4, totalSpaceGB: 8, totalSpaceUnit: 'TB',
        usedSpaceGB: 7.5, usedSpaceUnit: 'TB',
        raidStatus: 'failed', disksWithError: ['Disk 1', 'Disk 3'],
        firmwareVersion: '5.0.0.1932',
      }),
      readOnly: args['readOnly'] ?? false,
    },
  }),
};

// ── ReadOnly ───────────────────────────────────────────────────
// Form deshabilitado con firmware actualizado — estado post-mantenimiento
export const ReadOnly: Story = {
  render: () => {
    const group = makeGroup({
      diskCount: 4, totalSpaceGB: 4, totalSpaceUnit: 'TB',
      usedSpaceGB: 1.8, usedSpaceUnit: 'TB',
      raidStatus: 'ok', firmwareVersion: '5.1.0.2566',
      firmwareUpdated: true, firmwareNewVersion: '5.2.0.2800',
    });
    group.disable();
    return {
      props: { device: mockDevice, group, readOnly: true },
    };
  },
};
