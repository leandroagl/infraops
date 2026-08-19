import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskConfigController } from './task-config.controller';
import { TaskConfigService } from './task-config.service';
import { TaskTypeConfig } from './task-type-config.entity';
import { TaskType } from '../tasks/task-type.enum';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
};

describe('TaskConfigController', () => {
  let controller: TaskConfigController;
  let service: TaskConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskConfigController],
      providers: [
        TaskConfigService,
        { provide: getRepositoryToken(TaskTypeConfig), useValue: mockRepo },
      ],
    }).compile();

    controller = module.get(TaskConfigController);
    service = module.get(TaskConfigService);
    jest.clearAllMocks();
  });

  describe('GET /task-config', () => {
    it('devuelve los 10 tipos de tarea con defaults para los que no tienen fila', async () => {
      mockRepo.find.mockResolvedValue([]);
      const result = await controller.findAll();
      expect(result).toHaveLength(10);
      expect(result[0].defaultTimeMinutes).toBeNull();
      expect(result[0].odooTagIds).toEqual([]);
    });

    it('combina filas de DB con defaults para tipos faltantes', async () => {
      const existing: Partial<TaskTypeConfig> = {
        taskType: TaskType.SERVER_HOST_MAINTENANCE,
        defaultTimeMinutes: 90,
        odooTagIds: [1, 2],
        odooTagNames: ['Tag A', 'Tag B'],
        updatedAt: new Date(),
      };
      mockRepo.find.mockResolvedValue([existing]);
      const result = await controller.findAll();
      expect(result).toHaveLength(10);
      const srv = result.find(r => r.taskType === TaskType.SERVER_HOST_MAINTENANCE)!;
      expect(srv.defaultTimeMinutes).toBe(90);
      expect(srv.odooTagIds).toEqual([1, 2]);
    });
  });

  describe('PATCH /task-config/:taskType', () => {
    it('hace upsert y devuelve la config actualizada', async () => {
      const updated: Partial<TaskTypeConfig> = {
        taskType: TaskType.QNAP_MAINTENANCE,
        defaultTimeMinutes: 45,
        odooTagIds: [5],
        odooTagNames: ['Backups (NAS)'],
        updatedAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.save.mockResolvedValue(updated);
      const result = await controller.update(TaskType.QNAP_MAINTENANCE, {
        defaultTimeMinutes: 45,
        odooTagIds: [5],
        odooTagNames: ['Backups (NAS)'],
      });
      expect(result.defaultTimeMinutes).toBe(45);
    });

    it('retorna 400 con taskType inválido', async () => {
      await expect(
        controller.update('INVALID_TYPE' as any, { defaultTimeMinutes: 30 })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
