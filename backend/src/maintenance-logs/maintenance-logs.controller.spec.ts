import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtPayload } from '../auth/auth.types';
import { Task } from '../tasks/task.entity';
import { TaskStatus } from '../tasks/task-status.enum';
import { TaskType } from '../tasks/task-type.enum';
import { Technician } from '../technicians/technician.entity';
import { UserRole } from '../users/user-role.enum';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { MaintenanceLog } from './maintenance-log.entity';
import { MaintenanceLogsController } from './maintenance-logs.controller';
import { MaintenanceLogsService } from './maintenance-logs.service';

describe('MaintenanceLogsController', () => {
  let controller: MaintenanceLogsController;
  let maintenanceLogsService: {
    create: jest.Mock;
    findByTaskId: jest.Mock;
    update: jest.Mock;
  };

  const mockTechnician: Technician = {
    id: 'tech-1',
    createdAt: new Date('2026-01-01'),
  };

  const mockTask: Task = {
    id: 'task-1',
    clientId: 'client-1',
    client: null as any,
    technicianId: 'tech-1',
    technician: mockTechnician,
    type: TaskType.SERVER_MAINTENANCE,
    status: TaskStatus.IN_PROGRESS,
    scheduledDate: '2026-06-01',
    completedDate: null,
    odooTicketId: null,
    createdAt: new Date('2026-05-01'),
  };

  const mockLog: MaintenanceLog = {
    id: 'log-1',
    taskId: 'task-1',
    task: mockTask,
    technicianId: 'tech-1',
    technician: mockTechnician,
    payload: [{ item: 'WinServer', result: 'ok' }],
    notes: null,
    registeredAt: new Date('2026-06-01'),
  };

  const mockUser: JwtPayload = {
    sub: 'user-1',
    email: 'valen@ondra.com.ar',
    role: UserRole.TECHNICIAN,
    mustChangePassword: false,
  };

  beforeEach(async () => {
    maintenanceLogsService = {
      create: jest.fn(),
      findByTaskId: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [MaintenanceLogsController],
      providers: [{ provide: MaintenanceLogsService, useValue: maintenanceLogsService }],
    }).compile();

    controller = module.get(MaintenanceLogsController);
  });

  describe('create', () => {
    const dto: CreateLogDto = {
      payload: [{ item: 'WinServer', result: 'ok' }],
    };

    it('llama a maintenanceLogsService.create con taskId, dto y userId, devuelve el log', async () => {
      maintenanceLogsService.create.mockResolvedValue(mockLog);

      const result = await controller.create('task-1', dto, mockUser);

      expect(maintenanceLogsService.create).toHaveBeenCalledWith('task-1', dto, 'user-1');
      expect(result).toEqual(mockLog);
    });

    it('propaga NotFoundException si la tarea no existe', async () => {
      maintenanceLogsService.create.mockRejectedValue(new NotFoundException());

      await expect(controller.create('nonexistent', dto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propaga ConflictException si ya existe un log', async () => {
      maintenanceLogsService.create.mockRejectedValue(new ConflictException());

      await expect(controller.create('task-1', dto, mockUser)).rejects.toThrow(ConflictException);
    });

    it('propaga ForbiddenException si el usuario no tiene perfil técnico', async () => {
      maintenanceLogsService.create.mockRejectedValue(new ForbiddenException());

      await expect(controller.create('task-1', dto, mockUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByTaskId', () => {
    it('llama a maintenanceLogsService.findByTaskId y devuelve el log', async () => {
      maintenanceLogsService.findByTaskId.mockResolvedValue(mockLog);

      const result = await controller.findByTaskId('task-1');

      expect(maintenanceLogsService.findByTaskId).toHaveBeenCalledWith('task-1');
      expect(result).toEqual(mockLog);
    });

    it('propaga NotFoundException si la tarea no existe o no tiene log', async () => {
      maintenanceLogsService.findByTaskId.mockRejectedValue(new NotFoundException());

      await expect(controller.findByTaskId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateLogDto = { notes: 'notas actualizadas' };

    it('llama a maintenanceLogsService.update con taskId y dto, devuelve el log actualizado', async () => {
      const updated = { ...mockLog, notes: 'notas actualizadas' };
      maintenanceLogsService.update.mockResolvedValue(updated);

      const result = await controller.update('task-1', dto);

      expect(maintenanceLogsService.update).toHaveBeenCalledWith('task-1', dto);
      expect(result.notes).toBe('notas actualizadas');
    });

    it('propaga NotFoundException si la tarea no tiene log', async () => {
      maintenanceLogsService.update.mockRejectedValue(new NotFoundException());

      await expect(controller.update('task-1', dto)).rejects.toThrow(NotFoundException);
    });
  });
});