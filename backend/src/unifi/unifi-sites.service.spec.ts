import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnifiSitesService } from './unifi-sites.service';
import { UnifiSiteConfig } from './entities/unifi-site-config.entity';

describe('UnifiSitesService', () => {
  let service: UnifiSitesService;
  let repo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock; delete: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        UnifiSitesService,
        { provide: getRepositoryToken(UnifiSiteConfig), useValue: repo },
      ],
    }).compile();
    service = module.get(UnifiSitesService);
  });

  it('findAll returns all rows', async () => {
    repo.find.mockResolvedValue([{ id: 'uuid-1', siteId: 'site-a' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0].siteId).toBe('site-a');
  });

  it('create saves new site config', async () => {
    const dto = { clientId: 'c1', clientName: 'ACME', siteId: 'site-b', siteName: 'Oficina', isEnabled: true };
    repo.create.mockReturnValue(dto);
    repo.save.mockImplementation(async (e) => ({ ...e, id: 'new-uuid', createdAt: new Date() }));
    const result = await service.create(dto);
    expect(result.siteId).toBe('site-b');
    expect(repo.save).toHaveBeenCalled();
  });

  it('remove throws NotFoundException when not found', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.remove('non-existent')).rejects.toThrow('Site config no encontrado');
  });

  it('findEnabled returns only enabled rows', async () => {
    repo.find.mockResolvedValue([{ id: 'uuid-2', siteId: 'site-c', isEnabled: true }]);
    const result = await service.findEnabled();
    expect(result).toHaveLength(1);
    expect(result[0].isEnabled).toBe(true);
    expect(repo.find).toHaveBeenCalledWith({ where: { isEnabled: true } });
  });

  it('update throws NotFoundException when not found', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.update('non-existent', { siteName: 'X' })).rejects.toThrow('Site config no encontrado');
  });

  it('update patches fields and saves', async () => {
    const existing = { id: 'uuid-3', siteName: 'Old', isEnabled: true };
    repo.findOne.mockResolvedValue(existing);
    repo.save.mockImplementation(async (e) => e);
    const result = await service.update('uuid-3', { siteName: 'New', isEnabled: false });
    expect(result.siteName).toBe('New');
    expect(result.isEnabled).toBe(false);
  });
});
