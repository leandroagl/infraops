import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '../clients/client.entity';
import { Technician } from '../technicians/technician.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskStatus } from './task-status.enum';
import { TaskType } from './task-type.enum';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

describe('TasksController', () => {
  let controller: TasksController;
  let tasksService: {
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    remove: jest.Mock;
  };

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
    tasksService = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      remove: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: tasksService }],
    }).compile();

    controller = module.get(TasksController);
  });

  describe('findAll', () => {
    it('llama a tasksService.findAll con los filtros del query y devuelve el resultado', async () => {
      tasksService.findAll.mockResolvedValue([mockTask]);
      const filters = { status: TaskStatus.PENDING } as FilterTasksDto;

      const result = await controller.findAll(filters);

      expect(tasksService.findAll).toHaveBeenCalledWith(filters);
      expect(result).toEqual([mockTask]);
    });

    it('llama a tasksService.findAll con objeto vacío si no hay filtros', async () => {
      tasksService.findAll.mockResolvedValue([]);

      await controller.findAll({} as FilterTasksDto);

      expect(tasksService.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('create', () => {
    const dto: CreateTaskDto = {
      clientId: 'client-1',
      technicianId: 'tech-1',
      type: TaskType.SERVER_MAINTENANCE,
      scheduledDate: '2026-06-01',
    };

    it('llama a tasksService.create con el DTO y devuelve la tarea creada', async () => {
      tasksService.create.mockResolvedValue(mockTask);

      const result = await controller.create(dto);

      expect(tasksService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTask);
    });

    it('propaga NotFoundException si el servicio lanza una', async () => {
      tasksService.create.mockRejectedValue(new NotFoundException());

      await expect(controller.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateTaskDto = { technicianId: 'tech-2' };

    it('llama a tasksService.update con id y DTO, devuelve la tarea actualizada', async () => {
      const updated = { ...mockTask, technicianId: 'tech-2' };
      tasksService.update.mockResolvedValue(updated);

      const result = await controller.update('task-1', dto);

      expect(tasksService.update).toHaveBeenCalledWith('task-1', dto);
      expect(result).toEqual(updated);
    });

    it('propaga NotFoundException si la tarea no existe', async () => {
      tasksService.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update('nonexistent', dto)).rejects.toThrow(NotFoundException);
    });

    it('propaga BadRequestException si el body está vacío', async () => {
      tasksService.update.mockRejectedValue(new BadRequestException());

      await expect(controller.update('task-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    const dto: UpdateTaskStatusDto = { status: TaskStatus.IN_PROGRESS };

    it('llama a tasksService.updateStatus con id y nuevo status, devuelve la tarea actualizada', async () => {
      const updated = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      tasksService.updateStatus.mockResolvedValue(updated);

      const result = await controller.updateStatus('task-1', dto);

      expect(tasksService.updateStatus).toHaveBeenCalledWith('task-1', TaskStatus.IN_PROGRESS);
      expect(result).toEqual(updated);
    });

    it('propaga NotFoundException si la tarea no existe', async () => {
      tasksService.updateStatus.mockRejectedValue(new NotFoundException());

      await expect(controller.updateStatus('nonexistent', dto)).rejects.toThrow(NotFoundException);
    });

    it('propaga BadRequestException en transición inválida', async () => {
      tasksService.updateStatus.mockRejectedValue(new BadRequestException());

      await expect(controller.updateStatus('task-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('llama a tasksService.remove con el id y devuelve undefined', async () => {
      tasksService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('task-1');

      expect(tasksService.remove).toHaveBeenCalledWith('task-1');
      expect(result).toBeUndefined();
    });

    it('propaga NotFoundException si la tarea no existe', async () => {
      tasksService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
