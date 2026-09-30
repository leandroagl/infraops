import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskStatus } from '../tasks/task-status.enum';
import { TaskType } from '../tasks/task-type.enum';
import { Task } from '../tasks/task.entity';
import { OdooService } from '../integrations/odoo/odoo.service';
import { DeviationOperator } from '../deviation-rules/deviation-operator.enum';
import { MaintenanceDeviation } from './maintenance-deviation.entity';
import { MaintenanceDeviationStatus } from './maintenance-deviation-status.enum';
import { MaintenanceDeviationsService } from './maintenance-deviations.service';

function deviation(overrides: Partial<MaintenanceDeviation> = {}): MaintenanceDeviation {
  return {
    id: 'dev-1',
    logId: 'log-1',
    taskId: 'task-1',
    ruleId: 'rule-1',
    taskType: TaskType.QNAP_MAINTENANCE,
    signalKey: 'maxUsedSpacePct',
    operator: DeviationOperator.GT,
    thresholdNumber: 90,
    thresholdBoolean: null,
    detectedValueNumber: 95,
    detectedValueBoolean: null,
    helpdeskTeamId: 7,
    tagIds: [3],
    status: MaintenanceDeviationStatus.PENDING,
    detectedAt: new Date('2026-06-01'),
    resolvedAt: null,
    resolvedByUserId: null,
    odooTicketId: null,
    ...overrides,
  } as MaintenanceDeviation;
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    clientId: 'client-1',
    client: null as any,
    technicianId: 'tech-1',
    technician: null as any,
    type: TaskType.QNAP_MAINTENANCE,
    status: TaskStatus.IN_PROGRESS,
    scheduledDate: '2026-06-01',
    completedDate: null,
    expirationType: null,
    odooTicketId: null,
    createdAt: new Date('2026-05-01'),
    ...overrides,
  };
}

describe('MaintenanceDeviationsService', () => {
  let service: MaintenanceDeviationsService;
  let deviationRepo: any;
  let taskRepo: any;
  let odooService: { createDeviationTicket: jest.Mock };

  beforeEach(async () => {
    deviationRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (e) => e),
    };
    taskRepo = { findOne: jest.fn() };
    odooService = { createDeviationTicket: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceDeviationsService,
        { provide: getRepositoryToken(MaintenanceDeviation), useValue: deviationRepo },
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: OdooService, useValue: odooService },
      ],
    }).compile();

    service = module.get(MaintenanceDeviationsService);
  });

  describe('findByTaskId', () => {
    it('devuelve las detecciones de la tarea', async () => {
      deviationRepo.find.mockResolvedValue([deviation()]);
      const result = await service.findByTaskId('task-1');
      expect(result).toHaveLength(1);
      expect(deviationRepo.find).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        order: { detectedAt: 'DESC' },
      });
    });
  });

  describe('updateStatus — confirmar', () => {
    it('crea el ticket en Odoo y pasa a CONFIRMED', async () => {
      deviationRepo.findOne.mockResolvedValue(deviation());
      taskRepo.findOne.mockResolvedValue(task());
      odooService.createDeviationTicket.mockResolvedValue(555);

      const result = await service.updateStatus(
        'dev-1',
        MaintenanceDeviationStatus.CONFIRMED,
        'user-1',
      );

      expect(odooService.createDeviationTicket).toHaveBeenCalledWith(
        'client-1', 7, [3], expect.any(String), expect.any(String),
      );
      expect(result.status).toBe(MaintenanceDeviationStatus.CONFIRMED);
      expect(result.odooTicketId).toBe(555);
      expect(result.resolvedByUserId).toBe('user-1');
      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it('no cambia el estado si Odoo falla', async () => {
      deviationRepo.findOne.mockResolvedValue(deviation());
      taskRepo.findOne.mockResolvedValue(task());
      odooService.createDeviationTicket.mockRejectedValue(new BadRequestException('Odoo error'));

      await expect(
        service.updateStatus('dev-1', MaintenanceDeviationStatus.CONFIRMED, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(deviationRepo.save).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la tarea asociada no existe', async () => {
      deviationRepo.findOne.mockResolvedValue(deviation());
      taskRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('dev-1', MaintenanceDeviationStatus.CONFIRMED, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus — descartar', () => {
    it('pasa a DISMISSED sin crear ticket', async () => {
      deviationRepo.findOne.mockResolvedValue(deviation());

      const result = await service.updateStatus(
        'dev-1',
        MaintenanceDeviationStatus.DISMISSED,
        'user-1',
      );

      expect(odooService.createDeviationTicket).not.toHaveBeenCalled();
      expect(result.status).toBe(MaintenanceDeviationStatus.DISMISSED);
      expect(result.resolvedByUserId).toBe('user-1');
    });
  });

  describe('updateStatus — validaciones', () => {
    it('lanza NotFoundException si el desvío no existe', async () => {
      deviationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('nope', MaintenanceDeviationStatus.DISMISSED, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException si el desvío ya fue resuelto', async () => {
      deviationRepo.findOne.mockResolvedValue(
        deviation({ status: MaintenanceDeviationStatus.CONFIRMED }),
      );
      await expect(
        service.updateStatus('dev-1', MaintenanceDeviationStatus.DISMISSED, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('lanza BadRequestException si el status pedido es PENDING', async () => {
      deviationRepo.findOne.mockResolvedValue(deviation());
      await expect(
        service.updateStatus('dev-1', MaintenanceDeviationStatus.PENDING, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
