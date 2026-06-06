import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { Technician } from '../technicians/technician.entity';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { TaskStatus } from './task-status.enum';
import { TaskType } from './task-type.enum';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let clientRepository: { findOne: jest.Mock };
  let technicianRepository: { findOne: jest.Mock };
  let logRepository: { delete: jest.Mock };

  const mockClient: Client = {
    id: 'client-1',
    infradocId: 10,
    name: 'ACME SA',
    abbreviation: null,
    type: null,
    website: null,
    referral: null,
    rate: null,
    currencyCode: null,
    netTerms: null,
    taxIdNumber: null,
    isLead: false,
    primaryAddress: null,
    notes: null,
    isActive: true,
    lastSyncedAt: null,
    createdAt: new Date('2026-01-01'),
  };

  const mockTechnician: Technician = {
    id: 'tech-1',
    createdAt: new Date('2026-01-01'),
  };

  const mockTask: Task = {
    id: 'task-1',
    clientId: 'client-1',
    client: mockClient,
    technicianId: 'tech-1',
    technician: mockTechnician,
    type: TaskType.SERVER_MAINTENANCE,
    status: TaskStatus.PENDING,
    scheduledDate: '2026-06-01',
    completedDate: null,
    odooTicketId: null,
    createdAt: new Date('2026-05-01'),
  };

  beforeEach(async () => {
    taskRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    clientRepository = { findOne: jest.fn() };
    technicianRepository = { findOne: jest.fn() };
    logRepository = { delete: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task), useValue: taskRepository },
        { provide: getRepositoryToken(Client), useValue: clientRepository },
        { provide: getRepositoryToken(Technician), useValue: technicianRepository },
        { provide: getRepositoryToken(MaintenanceLog), useValue: logRepository },
      ],
    }).compile();

    service = module.get(TasksService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('retorna todas las tareas sin filtros', async () => {
      taskRepository.find.mockResolvedValue([mockTask]);

      const result = await service.findAll({} as FilterTasksDto);

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: {},
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
    });

    it('aplica filtro por status cuando se provee', async () => {
      taskRepository.find.mockResolvedValue([]);

      await service.findAll({ status: TaskStatus.PENDING } as FilterTasksDto);

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { status: TaskStatus.PENDING },
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
    });

    it('aplica filtro por clientId cuando se provee', async () => {
      taskRepository.find.mockResolvedValue([]);

      await service.findAll({ clientId: 'client-1' } as FilterTasksDto);

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
    });

    it('aplica filtro por technicianId cuando se provee', async () => {
      taskRepository.find.mockResolvedValue([]);

      await service.findAll({ technicianId: 'tech-1' } as FilterTasksDto);

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { technicianId: 'tech-1' },
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
    });

    it('aplica filtro por type cuando se provee', async () => {
      taskRepository.find.mockResolvedValue([mockTask]);

      await service.findAll({ type: TaskType.SERVER_MAINTENANCE } as FilterTasksDto);

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { type: TaskType.SERVER_MAINTENANCE },
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
    });
  });

  describe('create', () => {
    const createDto = {
      clientId: 'client-1',
      technicianId: 'tech-1',
      type: TaskType.SERVER_MAINTENANCE,
      scheduledDate: '2026-06-01',
    };

    it('crea y devuelve la tarea con cliente y técnico cargados', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      taskRepository.create.mockReturnValue(mockTask);
      taskRepository.save.mockResolvedValue(mockTask);
      taskRepository.findOne.mockResolvedValue(mockTask);

      const result = await service.create(createDto);

      expect(clientRepository.findOne).toHaveBeenCalledWith({ where: { id: 'client-1' } });
      expect(technicianRepository.findOne).toHaveBeenCalledWith({ where: { id: 'tech-1' } });
      expect(taskRepository.create).toHaveBeenCalledWith({
        clientId: 'client-1',
        technicianId: 'tech-1',
        type: TaskType.SERVER_MAINTENANCE,
        scheduledDate: '2026-06-01',
      });
      expect(taskRepository.save).toHaveBeenCalledWith(mockTask);
      expect(result.id).toBe('task-1');
    });

    it('lanza NotFoundException con mensaje si el cliente no existe', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow('Cliente no encontrado');
    });

    it('lanza NotFoundException con mensaje si el técnico no existe', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow('Técnico no encontrado');
    });
  });

  describe('update', () => {
    it('actualiza campos editables y devuelve la tarea actualizada', async () => {
      const updatedTask = { ...mockTask, technicianId: 'tech-2' };
      taskRepository.findOne
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(updatedTask);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('task-1', { technicianId: 'tech-2' });

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', { technicianId: 'tech-2' });
      expect(result.technicianId).toBe('tech-2');
    });

    it('lanza BadRequestException si el body está vacío', async () => {
      await expect(service.update('task-1', {})).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', { scheduledDate: '2026-07-01' })).rejects.toThrow(
        'Tarea no encontrada',
      );
    });

    it('lanza NotFoundException si el technicianId nuevo no existe', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      technicianRepository.findOne.mockResolvedValue(null);

      await expect(service.update('task-1', { technicianId: 'nonexistent' })).rejects.toThrow(
        'Técnico no encontrado',
      );
    });
  });

  describe('updateStatus', () => {
    it('transiciona PENDING → IN_PROGRESS correctamente', async () => {
      taskRepository.findOne
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce({ ...mockTask, status: TaskStatus.IN_PROGRESS });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus('task-1', TaskStatus.IN_PROGRESS);

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.IN_PROGRESS,
        completedDate: null,
      });
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('transiciona PENDING → NOT_DONE y setea completedDate', async () => {
      const now = new Date();
      jest.useFakeTimers().setSystemTime(now);
      taskRepository.findOne
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce({ ...mockTask, status: TaskStatus.NOT_DONE, completedDate: now });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus('task-1', TaskStatus.NOT_DONE);

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.NOT_DONE,
        completedDate: now,
      });
      expect(result.completedDate).toEqual(now);

      jest.useRealTimers();
    });

    it('transiciona IN_PROGRESS → DONE y setea completedDate', async () => {
      const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      const now = new Date();
      jest.useFakeTimers().setSystemTime(now);
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE, completedDate: now });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus('task-1', TaskStatus.DONE);

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.DONE,
        completedDate: now,
      });
      expect(result.completedDate).toEqual(now);

      jest.useRealTimers();
    });

    it('transiciona IN_PROGRESS → ESCALATED y setea completedDate', async () => {
      const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      const now = new Date();
      jest.useFakeTimers().setSystemTime(now);
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.ESCALATED, completedDate: now });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.ESCALATED);

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.ESCALATED,
        completedDate: now,
      });

      jest.useRealTimers();
    });

    it('lanza BadRequestException en transición inválida PENDING → DONE', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);

      await expect(service.updateStatus('task-1', TaskStatus.DONE)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException en transición inválida PENDING → ESCALATED', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);

      await expect(service.updateStatus('task-1', TaskStatus.ESCALATED)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza BadRequestException si la tarea ya está en estado terminal', async () => {
      const doneTask = { ...mockTask, status: TaskStatus.DONE };
      taskRepository.findOne.mockResolvedValue(doneTask);

      await expect(service.updateStatus('task-1', TaskStatus.PENDING)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.updateStatus('nonexistent', TaskStatus.IN_PROGRESS)).rejects.toThrow(
        'Tarea no encontrada',
      );
    });
  });

  describe('remove', () => {
    it('elimina el log asociado y la tarea cuando la tarea existe', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.delete.mockResolvedValue({ affected: 1 });
      taskRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('task-1');

      expect(taskRepository.findOne).toHaveBeenCalledWith({ where: { id: 'task-1' } });
      expect(logRepository.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(taskRepository.delete).toHaveBeenCalledWith('task-1');
    });

    it('elimina la tarea aunque no haya log asociado (delete es no-op)', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.delete.mockResolvedValue({ affected: 0 });
      taskRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('task-1');

      expect(logRepository.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(taskRepository.delete).toHaveBeenCalledWith('task-1');
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow('Tarea no encontrada');

      expect(logRepository.delete).not.toHaveBeenCalled();
      expect(taskRepository.delete).not.toHaveBeenCalled();
    });
  });
});