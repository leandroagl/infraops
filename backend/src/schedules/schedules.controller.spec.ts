import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

const mockService = {
  findAll: jest.fn().mockResolvedValue([]),
  upsert: jest.fn().mockResolvedValue({}),
  getRotationConfig: jest.fn().mockResolvedValue({}),
  saveRotationConfig: jest.fn().mockResolvedValue({}),
  previewRotation: jest.fn().mockResolvedValue({ technicians: [] }),
  getMonthlyPreview: jest.fn().mockResolvedValue({}),
  generateMonth: jest.fn().mockResolvedValue({ tasksCreated: 0, tasksSkipped: 0, errors: [] }),
};

describe('SchedulesController', () => {
  let controller: SchedulesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulesController],
      providers: [{ provide: SchedulesService, useValue: mockService }],
    }).compile();
    controller = module.get<SchedulesController>(SchedulesController);
    jest.clearAllMocks();
  });

  it('findAll calls service.findAll', async () => {
    await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalledTimes(1);
  });

  it('upsert calls service.upsert with clientId and dto', async () => {
    const dto = { scheduleGroup: null, technicianId: null };
    await controller.upsert('abc-uuid', dto as any);
    expect(mockService.upsert).toHaveBeenCalledWith('abc-uuid', dto);
  });

  it('getRotationConfig calls service.getRotationConfig', async () => {
    await controller.getRotationConfig();
    expect(mockService.getRotationConfig).toHaveBeenCalledTimes(1);
  });

  it('saveRotationConfig calls service.saveRotationConfig', async () => {
    const dto = { isActive: true, frequency: 'EVERY_GENERATION' as any };
    await controller.saveRotationConfig(dto);
    expect(mockService.saveRotationConfig).toHaveBeenCalledWith(dto);
  });

  it('generateMonth calls service.generateMonth with year and month', async () => {
    await controller.generateMonth({ year: 2026, month: 8 });
    expect(mockService.generateMonth).toHaveBeenCalledWith(2026, 8);
  });

  it('getMonthlyPreview calls service.getMonthlyPreview with parsed ints', async () => {
    await controller.getMonthlyPreview('2026', '8');
    expect(mockService.getMonthlyPreview).toHaveBeenCalledWith(2026, 8);
  });
});
