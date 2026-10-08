import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { BackupsService } from './backups.service';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { VeeamDailySnapshot } from './entities/veeam-daily-snapshot.entity';
import { VeeamService } from '../integrations/veeam/veeam.service';
import { CredentialVaultService } from './credential-vault.service';
import { encrypt } from '../integration-config/crypto.util';

const TEST_KEY = 'a'.repeat(64);
const mockConfigRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), delete: jest.fn(), create: jest.fn() };
const mockSnapshotRepo = { upsert: jest.fn() };
const mockVeeamService = { getJobStatuses: jest.fn(), testConnection: jest.fn() };
const mockConfigService = { get: jest.fn().mockReturnValue(TEST_KEY) };
const mockVaultSvc = { getDecryptedPassword: jest.fn() };

describe('BackupsService', () => {
  let svc: BackupsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BackupsService,
        { provide: getRepositoryToken(VeeamClientConfig), useValue: mockConfigRepo },
        { provide: getRepositoryToken(VeeamDailySnapshot), useValue: mockSnapshotRepo },
        { provide: VeeamService, useValue: mockVeeamService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CredentialVaultService, useValue: mockVaultSvc },
      ],
    }).compile();
    svc = module.get(BackupsService);
    jest.clearAllMocks();
  });

  it('debería calcular estado del cliente como el peor estado de sus jobs', () => {
    const jobs = [
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
      { lastResult: 'Warning', isRunning: false, isStale: false } as any,
    ];
    const status = (svc as any).deriveClientStatus(jobs);
    expect(status).toBe('warn');
  });

  it('debería devolver crit si hay al menos un job Failed', () => {
    const jobs = [
      { lastResult: 'Success', isRunning: false, isStale: false } as any,
      { lastResult: 'Failed', isRunning: false, isStale: false } as any,
      { lastResult: 'Warning', isRunning: false, isStale: false } as any,
    ];
    expect((svc as any).deriveClientStatus(jobs)).toBe('crit');
  });

  it('debería devolver no_data si no hay jobs', () => {
    expect((svc as any).deriveClientStatus([])).toBe('no_data');
  });

  it('debería cifrar password al crear config', async () => {
    mockConfigRepo.create.mockImplementation((d: any) => ({ ...d }));
    mockConfigRepo.save.mockResolvedValue({
      id: 'uuid', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419,
      username: 'u', encryptedPassword: 'enc', credentialVaultEntryId: null,
      isEnabled: true, lastConnectedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    await svc.createConfig({ clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419, username: 'u', password: 'plain', isEnabled: true });
    const saveArg = mockConfigRepo.save.mock.calls[0][0];
    expect(saveArg.encryptedPassword).not.toBe('plain');
    expect(saveArg.encryptedPassword).toBeDefined();
  });

  it('testConnection debería devolver success false sin lanzar error', async () => {
    const encryptedPassword = encrypt('plain', TEST_KEY);
    mockConfigRepo.findOne.mockResolvedValue({
      host: 'h', port: 9419, username: 'u', encryptedPassword,
      credentialVaultEntryId: null, isEnabled: true,
    });
    mockVeeamService.testConnection.mockResolvedValue({ success: false, message: 'Authentication failed' });
    const result = await svc.testConnection('config-id');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Authentication failed');
  });

  it('createConfig con credentialVaultId guarda la FK y no llama encrypt', async () => {
    mockConfigRepo.create.mockImplementation((d: any) => ({ ...d }));
    mockConfigRepo.save.mockResolvedValue({
      id: 'uuid', clientId: 'c1', clientName: 'Client 1',
      host: 'h', port: 9419, username: 'u',
      encryptedPassword: '', credentialVaultEntryId: 'vault-id',
      isEnabled: true, lastConnectedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    await svc.createConfig({
      clientId: 'c1', clientName: 'Client 1', host: 'h',
      port: 9419, username: 'u', credentialVaultId: 'vault-id', isEnabled: true,
    });
    const saveArg = mockConfigRepo.save.mock.calls[0][0];
    expect(saveArg.credentialVaultEntryId).toBe('vault-id');
    expect(saveArg.encryptedPassword).toBe('');
  });

  it('createConfig sin password ni credentialVaultId lanza BadRequestException', async () => {
    await expect(
      svc.createConfig({ clientId: 'c1', clientName: 'C', host: 'h', port: 9419, username: 'u', isEnabled: true }),
    ).rejects.toThrow(BadRequestException);
  });

  it('createConfig retorna credentialVaultEntryId en el DTO de respuesta', async () => {
    mockConfigRepo.create.mockImplementation((d: any) => ({ ...d }));
    mockConfigRepo.save.mockResolvedValue({
      id: 'uuid', clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419,
      username: 'u', encryptedPassword: '', credentialVaultEntryId: 'v1',
      isEnabled: true, lastConnectedAt: null, createdAt: new Date(), updatedAt: new Date(),
    });
    const result = await svc.createConfig({
      clientId: 'c1', clientName: 'Client 1', host: 'h', port: 9419,
      username: 'u', credentialVaultId: 'v1', isEnabled: true,
    });
    expect((result as any).credentialVaultEntryId).toBe('v1');
  });

  it('updateConfig con password y credentialVaultId simultáneos da prioridad a password y limpia vault FK', async () => {
    const existing = {
      id: 'cfg1', clientId: 'c1', clientName: 'C', host: 'h', port: 9419,
      username: 'u', encryptedPassword: 'enc', credentialVaultEntryId: 'v1',
      isEnabled: true, lastConnectedAt: null, updatedAt: new Date(),
    };
    mockConfigRepo.findOne.mockResolvedValue({ ...existing });
    mockConfigRepo.save.mockImplementation((d: any) => Promise.resolve({ ...d, lastConnectedAt: null }));
    await svc.updateConfig('cfg1', { password: 'newpass', credentialVaultId: 'v2' });
    const saveArg = mockConfigRepo.save.mock.calls[0][0];
    expect(saveArg.credentialVaultEntryId).toBeNull();
    expect(saveArg.encryptedPassword).not.toBe('enc');
  });

  it('updateConfig con credentialVaultId actualiza la FK', async () => {
    const existing = {
      id: 'cfg1', clientId: 'c1', clientName: 'C', host: 'h', port: 9419,
      username: 'u', encryptedPassword: 'enc', credentialVaultEntryId: null,
      isEnabled: true, lastConnectedAt: null, updatedAt: new Date(),
    };
    mockConfigRepo.findOne.mockResolvedValue({ ...existing });
    mockConfigRepo.save.mockImplementation((d: any) => Promise.resolve({ ...d, lastConnectedAt: null }));
    await svc.updateConfig('cfg1', { credentialVaultId: 'new-vault-id' });
    const saveArg = mockConfigRepo.save.mock.calls[0][0];
    expect(saveArg.credentialVaultEntryId).toBe('new-vault-id');
  });
});
