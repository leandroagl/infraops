import { Test, TestingModule } from '@nestjs/testing';
import { TaskType } from '../tasks/task-type.enum';
import { DeviationOperator } from './deviation-operator.enum';
import { DeviationRulesController } from './deviation-rules.controller';
import { DeviationRulesService } from './deviation-rules.service';

describe('DeviationRulesController', () => {
  let controller: DeviationRulesController;
  const service = {
    findAll: jest.fn(),
    getAvailableSignals: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviationRulesController],
      providers: [{ provide: DeviationRulesService, useValue: service }],
    }).compile();

    controller = module.get(DeviationRulesController);
    jest.clearAllMocks();
  });

  it('GET /deviation-rules delega en el service', async () => {
    service.findAll.mockResolvedValue([{ id: 'r1' }]);
    expect(await controller.findAll()).toEqual([{ id: 'r1' }]);
  });

  it('GET /deviation-rules/signals delega en el service', () => {
    service.getAvailableSignals.mockReturnValue([
      { taskType: TaskType.QNAP_MAINTENANCE, key: 'maxUsedSpacePct', label: '...', valueType: 'number' },
    ]);
    expect(controller.getAvailableSignals()).toHaveLength(1);
  });

  it('POST /deviation-rules delega en el service', async () => {
    const dto = {
      taskType: TaskType.QNAP_MAINTENANCE,
      signalKey: 'maxUsedSpacePct',
      operator: DeviationOperator.GT,
      thresholdNumber: 90,
    };
    service.create.mockResolvedValue({ id: 'r1', ...dto });
    expect(await controller.create(dto)).toEqual({ id: 'r1', ...dto });
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('PATCH /deviation-rules/:id delega en el service', async () => {
    service.update.mockResolvedValue({ id: 'r1', enabled: false });
    expect(await controller.update('r1', { enabled: false })).toEqual({
      id: 'r1',
      enabled: false,
    });
    expect(service.update).toHaveBeenCalledWith('r1', { enabled: false });
  });

  it('DELETE /deviation-rules/:id delega en el service', async () => {
    service.remove.mockResolvedValue(undefined);
    await controller.remove('r1');
    expect(service.remove).toHaveBeenCalledWith('r1');
  });
});
