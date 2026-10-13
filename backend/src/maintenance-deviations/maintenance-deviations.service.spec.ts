import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
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
    ticketTitle: null,
    ticketDescription: null,
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

  describe('findByTaskIds', () => {
    it('devuelve las detecciones de todas las tareas pedidas', async () => {
      deviationRepo.find.mockResolvedValue([deviation(), deviation({ id: 'dev-2', taskId: 'task-2' })]);

      const result = await service.findByTaskIds(['task-1', 'task-2']);

      expect(result).toHaveLength(2);
      expect(deviationRepo.find).toHaveBeenCalledWith({
        where: { taskId: In(['task-1', 'task-2']) },
      });
    });

    it('devuelve [] sin consultar el repo si no se pasan taskIds', async () => {
      const result = await service.findByTaskIds([]);
      expect(result).toEqual([]);
      expect(deviationRepo.find).not.toHaveBeenCalled();
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

    it('usa ticketTitle personalizado si está configurado', async () => {
      deviationRepo.findOne.mockResolvedValue(
        deviation({ ticketTitle: 'Espacio QNAP crítico' }),
      );
      taskRepo.findOne.mockResolvedValue(task());
      odooService.createDeviationTicket.mockResolvedValue(556);

      await service.updateStatus('dev-1', MaintenanceDeviationStatus.CONFIRMED, 'user-1');

      expect(odooService.createDeviationTicket).toHaveBeenCalledWith(
        'client-1', 7, [3], 'Espacio QNAP crítico', expect.any(String),
      );
    });

    it('usa título por defecto si ticketTitle es null', async () => {
      deviationRepo.findOne.mockResolvedValue(deviation({ ticketTitle: null }));
      taskRepo.findOne.mockResolvedValue(task());
      odooService.createDeviationTicket.mockResolvedValue(557);

      await service.updateStatus('dev-1', MaintenanceDeviationStatus.CONFIRMED, 'user-1');

      const [, , , title] = odooService.createDeviationTicket.mock.calls[0];
      expect(title).toContain('Desvío detectado');
    });

    it('usa ticketDescription personalizada si está configurada', async () => {
      deviationRepo.findOne.mockResolvedValue(
        deviation({ ticketDescription: 'El NAS superó el umbral de uso.' }),
      );
      taskRepo.findOne.mockResolvedValue(task());
      odooService.createDeviationTicket.mockResolvedValue(558);

      await service.updateStatus('dev-1', MaintenanceDeviationStatus.CONFIRMED, 'user-1');

      const [, , , , description] = odooService.createDeviationTicket.mock.calls[0];
      expect(description).toContain('El NAS superó el umbral de uso.');
    });

    it('usa descripción por defecto si ticketDescription es null', async () => {
      deviationRepo.findOne.mockResolvedValue(deviation({ ticketDescription: null }));
      taskRepo.findOne.mockResolvedValue(task());
      odooService.createDeviationTicket.mockResolvedValue(559);

      await service.updateStatus('dev-1', MaintenanceDeviationStatus.CONFIRMED, 'user-1');

      const [, , , , description] = odooService.createDeviationTicket.mock.calls[0];
      expect(description).toContain('Desvío detectado');
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
