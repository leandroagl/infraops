import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceDeviationStatus } from './maintenance-deviation-status.enum';
import { MaintenanceDeviationsController } from './maintenance-deviations.controller';
import { MaintenanceDeviationsService } from './maintenance-deviations.service';

describe('MaintenanceDeviationsController', () => {
  let controller: MaintenanceDeviationsController;
  const service = {
    findByTaskId: jest.fn(),
    findByTaskIds: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MaintenanceDeviationsController],
      providers: [{ provide: MaintenanceDeviationsService, useValue: service }],
    }).compile();

    controller = module.get(MaintenanceDeviationsController);
    jest.clearAllMocks();
  });

  it('GET by-task/:taskId delega en el service', async () => {
    service.findByTaskId.mockResolvedValue([{ id: 'dev-1' }]);
    expect(await controller.findByTaskId('task-1')).toEqual([{ id: 'dev-1' }]);
    expect(service.findByTaskId).toHaveBeenCalledWith('task-1');
  });

  it('GET ?taskIds= delega en el service con la lista parseada', async () => {
    service.findByTaskIds.mockResolvedValue([{ id: 'dev-1' }, { id: 'dev-2' }]);

    const result = await controller.findByTaskIds('task-1, task-2');

    expect(result).toEqual([{ id: 'dev-1' }, { id: 'dev-2' }]);
    expect(service.findByTaskIds).toHaveBeenCalledWith(['task-1', 'task-2']);
  });

  it('GET ?taskIds= lanza BadRequestException si no se pasa el parámetro', async () => {
    await expect(controller.findByTaskIds(undefined)).rejects.toThrow(BadRequestException);
  });

  it('PATCH :id/status delega en el service con el userId del token', async () => {
    service.updateStatus.mockResolvedValue({ id: 'dev-1', status: MaintenanceDeviationStatus.CONFIRMED });

    const result = await controller.updateStatus(
      'dev-1',
      { status: MaintenanceDeviationStatus.CONFIRMED },
      { sub: 'user-1', email: 'a@a.com', role: 'TECHNICIAN' } as any,
    );

    expect(result).toEqual({ id: 'dev-1', status: MaintenanceDeviationStatus.CONFIRMED });
    expect(service.updateStatus).toHaveBeenCalledWith(
      'dev-1',
      MaintenanceDeviationStatus.CONFIRMED,
      'user-1',
    );
  });
});
