import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskType } from '../tasks/task-type.enum';
import { DeviationOperator } from './deviation-operator.enum';
import { DeviationRule } from './deviation-rule.entity';
import { DeviationRulesService } from './deviation-rules.service';

describe('DeviationRulesService', () => {
  let service: DeviationRulesService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(async (e) => e),
      remove: jest.fn(async (e) => e),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviationRulesService,
        { provide: getRepositoryToken(DeviationRule), useValue: repo },
      ],
    }).compile();
    service = module.get(DeviationRulesService);
  });

  describe('findAll', () => {
    it('devuelve todas las reglas', async () => {
      repo.find.mockResolvedValue([{ id: 'r1' }]);
      const result = await service.findAll();
      expect(result).toEqual([{ id: 'r1' }]);
    });
  });

  describe('getAvailableSignals', () => {
    it('incluye las señales de QNAP_MAINTENANCE con su taskType', () => {
      const signals = service.getAvailableSignals();
      const qnap = signals.filter((s) => s.taskType === TaskType.QNAP_MAINTENANCE);
      expect(qnap.map((s) => s.key)).toEqual(['anyDiskWithError', 'maxUsedSpacePct']);
      expect(qnap[0].valueType).toBe('boolean');
    });

    it('incluye la señal de VEEAM_BACKUP', () => {
      const signals = service.getAvailableSignals();
      const veeam = signals.filter((s) => s.taskType === TaskType.VEEAM_BACKUP);
      expect(veeam.map((s) => s.key)).toEqual(['anyVmWithoutBackup']);
    });

    it('no incluye tipos sin señales configuradas', () => {
      const signals = service.getAvailableSignals();
      expect(signals.some((s) => s.taskType === TaskType.TERMINAL_MAINTENANCE)).toBe(false);
    });
  });

  describe('create', () => {
    it('crea una regla numérica válida con defaults', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.create({
        taskType: TaskType.QNAP_MAINTENANCE,
        signalKey: 'maxUsedSpacePct',
        operator: DeviationOperator.GT,
        thresholdNumber: 90,
      });

      expect(result.enabled).toBe(true);
      expect(result.tagIds).toEqual([]);
      expect(repo.save).toHaveBeenCalled();
    });

    it('crea una regla booleana válida', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.create({
        taskType: TaskType.VEEAM_BACKUP,
        signalKey: 'anyVmWithoutBackup',
        operator: DeviationOperator.EQ,
        thresholdBoolean: true,
      });

      expect(result.thresholdBoolean).toBe(true);
    });

    it('rechaza un signalKey que no existe para ese taskType', async () => {
      await expect(
        service.create({
          taskType: TaskType.QNAP_MAINTENANCE,
          signalKey: 'noExiste',
          operator: DeviationOperator.GT,
          thresholdNumber: 90,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una señal numérica sin thresholdNumber', async () => {
      await expect(
        service.create({
          taskType: TaskType.QNAP_MAINTENANCE,
          signalKey: 'maxUsedSpacePct',
          operator: DeviationOperator.GT,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una señal booleana con un operador que no sea EQ', async () => {
      await expect(
        service.create({
          taskType: TaskType.VEEAM_BACKUP,
          signalKey: 'anyVmWithoutBackup',
          operator: DeviationOperator.GT,
          thresholdBoolean: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una señal booleana sin thresholdBoolean', async () => {
      await expect(
        service.create({
          taskType: TaskType.VEEAM_BACKUP,
          signalKey: 'anyVmWithoutBackup',
          operator: DeviationOperator.EQ,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza si ya existe una regla para ese taskType + signalKey', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create({
          taskType: TaskType.QNAP_MAINTENANCE,
          signalKey: 'maxUsedSpacePct',
          operator: DeviationOperator.GT,
          thresholdNumber: 90,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('actualiza los campos provistos', async () => {
      repo.findOne.mockResolvedValue({
        id: 'r1',
        taskType: TaskType.QNAP_MAINTENANCE,
        signalKey: 'maxUsedSpacePct',
        operator: DeviationOperator.GT,
        thresholdNumber: 90,
        thresholdBoolean: null,
        enabled: true,
        helpdeskTeamId: null,
        tagIds: [],
      });

      const result = await service.update('r1', { thresholdNumber: 95, enabled: false });

      expect(result.thresholdNumber).toBe(95);
      expect(result.enabled).toBe(false);
    });

    it('lanza NotFoundException si la regla no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('nope', { enabled: false })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('elimina la regla existente', async () => {
      const existing = { id: 'r1' };
      repo.findOne.mockResolvedValue(existing);
      await service.remove('r1');
      expect(repo.remove).toHaveBeenCalledWith(existing);
    });

    it('lanza NotFoundException si la regla no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
