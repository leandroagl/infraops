import { Test } from '@nestjs/testing';
import { UnifiSitesController } from './unifi-sites.controller';
import { UnifiSitesService } from './unifi-sites.service';

describe('UnifiSitesController', () => {
  let controller: UnifiSitesController;
  const svc = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [UnifiSitesController],
      providers: [{ provide: UnifiSitesService, useValue: svc }],
    }).compile();
    controller = module.get(UnifiSitesController);
  });

  it('findAll delegates to service', async () => {
    svc.findAll.mockResolvedValue([]);
    expect(await controller.findAll()).toEqual([]);
    expect(svc.findAll).toHaveBeenCalledTimes(1);
  });

  it('create delegates to service', async () => {
    const dto = { clientId: 'c1', clientName: 'ACME', siteId: 'site-b', siteName: 'Oficina' };
    svc.create.mockResolvedValue({ ...dto, id: 'new-uuid', isEnabled: true, createdAt: new Date() });
    const result = await controller.create(dto as never);
    expect(result.siteId).toBe('site-b');
    expect(svc.create).toHaveBeenCalledWith(dto);
  });

  it('update delegates to service', async () => {
    const updated = { id: 'uuid-3', siteName: 'New', isEnabled: false };
    svc.update.mockResolvedValue(updated);
    const result = await controller.update('uuid-3', { siteName: 'New', isEnabled: false });
    expect(result.siteName).toBe('New');
    expect(svc.update).toHaveBeenCalledWith('uuid-3', { siteName: 'New', isEnabled: false });
  });

  it('remove delegates to service', async () => {
    svc.remove.mockResolvedValue(undefined);
    await expect(controller.remove('some-id')).resolves.toBeUndefined();
    expect(svc.remove).toHaveBeenCalledWith('some-id');
  });
});
