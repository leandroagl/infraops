import { Test } from '@nestjs/testing';
import { CredentialVaultController } from './credential-vault.controller';
import { CredentialVaultService } from './credential-vault.service';

const mockSvc = { list: jest.fn(), create: jest.fn(), delete: jest.fn() };

describe('CredentialVaultController', () => {
  let ctrl: CredentialVaultController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CredentialVaultController],
      providers: [{ provide: CredentialVaultService, useValue: mockSvc }],
    }).compile();
    ctrl = module.get(CredentialVaultController);
    jest.clearAllMocks();
  });

  it('GET /credential-vault → llama list', async () => {
    mockSvc.list.mockResolvedValue([]);
    const result = await ctrl.list();
    expect(mockSvc.list).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('POST /credential-vault → llama create con dto', async () => {
    const dto = { name: 'Test', password: 'pass' };
    mockSvc.create.mockResolvedValue({ id: 'u1', name: 'Test', createdAt: '2026-01-01' });
    const result = await ctrl.create(dto as any);
    expect(mockSvc.create).toHaveBeenCalledWith(dto);
    expect(result.id).toBe('u1');
  });

  it('DELETE /credential-vault/:id → llama delete', async () => {
    mockSvc.delete.mockResolvedValue(undefined);
    await ctrl.delete('u1');
    expect(mockSvc.delete).toHaveBeenCalledWith('u1');
  });
});
