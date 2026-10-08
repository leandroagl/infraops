import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CredentialVaultService } from './credential-vault.service';
import { CredentialVaultEntry } from './entities/credential-vault-entry.entity';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { encrypt, decrypt } from '../integration-config/crypto.util';

const TEST_KEY = 'a'.repeat(64);

const mockVaultRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};
const mockVeeamConfigRepo = {
  findOne: jest.fn(),
};
const mockConfigService = { get: jest.fn().mockReturnValue(TEST_KEY) };

describe('CredentialVaultService', () => {
  let svc: CredentialVaultService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CredentialVaultService,
        { provide: getRepositoryToken(CredentialVaultEntry), useValue: mockVaultRepo },
        { provide: getRepositoryToken(VeeamClientConfig), useValue: mockVeeamConfigRepo },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    svc = module.get(CredentialVaultService);
    jest.clearAllMocks();
  });

  it('list devuelve entradas sin contraseña', async () => {
    const entry = { id: 'u1', name: 'Veeam ACME', encryptedPassword: 'enc', createdAt: new Date('2026-01-01') };
    mockVaultRepo.find.mockResolvedValue([entry]);
    const result = await svc.list();
    expect(result).toEqual([{ id: 'u1', name: 'Veeam ACME', createdAt: entry.createdAt.toISOString() }]);
    expect(result[0]).not.toHaveProperty('password');
    expect(result[0]).not.toHaveProperty('encryptedPassword');
  });

  it('create cifra la contraseña y devuelve sin contraseña', async () => {
    const saved = { id: 'u2', name: 'Test', encryptedPassword: 'enc', createdAt: new Date() };
    mockVaultRepo.create.mockImplementation((d: any) => ({ ...d }));
    mockVaultRepo.save.mockResolvedValue(saved);
    const result = await svc.create({ name: 'Test', password: 'plain123' });
    const saveArg = mockVaultRepo.save.mock.calls[0][0];
    expect(saveArg.encryptedPassword).not.toBe('plain123');
    expect(decrypt(saveArg.encryptedPassword, TEST_KEY)).toBe('plain123');
    expect(result.id).toBe('u2');
    expect(result).not.toHaveProperty('encryptedPassword');
  });

  it('delete lanza ConflictException si hay configs Veeam usando la entrada', async () => {
    mockVeeamConfigRepo.findOne.mockResolvedValue({ id: 'cfg1', credentialVaultEntryId: 'u1' });
    await expect(svc.delete('u1')).rejects.toThrow(ConflictException);
    expect(mockVaultRepo.delete).not.toHaveBeenCalled();
  });

  it('delete procede si no hay configs usando la entrada', async () => {
    mockVeeamConfigRepo.findOne.mockResolvedValue(null);
    await svc.delete('u1');
    expect(mockVaultRepo.delete).toHaveBeenCalledWith('u1');
  });

  it('getDecryptedPassword descifra y devuelve la contraseña', async () => {
    const plain = 'secretpass';
    const enc = encrypt(plain, TEST_KEY);
    mockVaultRepo.findOne.mockResolvedValue({ id: 'u1', encryptedPassword: enc });
    const result = await svc.getDecryptedPassword('u1');
    expect(result).toBe(plain);
  });

  it('create lanza error si INTEGRATIONS_ENCRYPT_KEY no está configurada', async () => {
    mockConfigService.get.mockReturnValue('');
    await expect(svc.create({ name: 'Test', password: 'plain' })).rejects.toThrow('INTEGRATIONS_ENCRYPT_KEY');
  });

  it('getDecryptedPassword lanza NotFoundException si la entrada no existe', async () => {
    mockVaultRepo.findOne.mockResolvedValue(null);
    await expect(svc.getDecryptedPassword('no-existe')).rejects.toThrow(NotFoundException);
  });
});
