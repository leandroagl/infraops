import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../tasks/task.entity';
import { TaskStatus } from '../tasks/task-status.enum';
import { TaskType } from '../tasks/task-type.enum';
import { Technician } from '../technicians/technician.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { MaintenanceLog } from './maintenance-log.entity';
import { ServerMaintenancePayload } from './log-item.interface';
import { MaintenanceLogsService } from './maintenance-logs.service';

describe('MaintenanceLogsService', () => {
  let service: MaintenanceLogsService;
  let logRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let taskRepository: { findOne: jest.Mock };
  let userRepository: { findOne: jest.Mock };

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

  const mockUser: User = {
    id: 'user-1',
    name: 'Valen',
    email: 'valen@ondra.com.ar',
    passwordHash: 'hash',
    role: UserRole.TECHNICIAN,
    mustChangePassword: false,
    lastLogoutAt: null,
    isActive: true,
    technicianId: 'tech-1',
    technician: mockTechnician,
    createdAt: new Date('2026-01-01'),
  };

  const mockPayload: ServerMaintenancePayload = {
    type: 'SERVER_MAINTENANCE',
    windows: {
      servers: [{ serverId: 1, serverName: '47DC', rebootScript: 'ok', updates: 'ok' }],
      dcdiag: 'OK',
    },
  };

  const mockLog: MaintenanceLog = {
    id: 'log-1',
    taskId: 'task-1',
    task: mockTask,
    technicianId: 'tech-1',
    technician: mockTechnician,
    payload: mockPayload,
    notes: null,
    registeredAt: new Date('2026-06-01'),
  };

  const createDto: CreateLogDto = {
    payload: mockPayload,
  };

  beforeEach(async () => {
    logRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    taskRepository = { findOne: jest.fn() };
    userRepository = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        MaintenanceLogsService,
        { provide: getRepositoryToken(MaintenanceLog), useValue: logRepository },
        { provide: getRepositoryToken(Task), useValue: taskRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    service = module.get(MaintenanceLogsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crea y devuelve el log con relaciones cargadas', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne
        .mockResolvedValueOnce(null)     // comprueba duplicado
        .mockResolvedValueOnce(mockLog); // loadLog
      userRepository.findOne.mockResolvedValue(mockUser);
      logRepository.create.mockReturnValue(mockLog);
      logRepository.save.mockResolvedValue(mockLog);

      const result = await service.create('task-1', createDto, 'user-1');

      expect(taskRepository.findOne).toHaveBeenCalledWith({ where: { id: 'task-1' } });
      expect(logRepository.findOne).toHaveBeenCalledWith({ where: { taskId: 'task-1' } });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(logRepository.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        technicianId: 'tech-1',
        payload: createDto.payload,
        notes: null,
      });
      expect(result.id).toBe('log-1');
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.create('nonexistent', createDto, 'user-1')).rejects.toThrow(
        'Tarea no encontrada',
      );
    });

    it('lanza ConflictException si ya existe un log para la tarea', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(mockLog);

      await expect(service.create('task-1', createDto, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lanza ForbiddenException si el usuario no tiene perfil técnico', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue({ ...mockUser, technicianId: null });

      await expect(service.create('task-1', createDto, 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.create('task-1', createDto, 'user-1')).rejects.toThrow(
        'Usuario no encontrado',
      );
    });
  });

  describe('findByTaskId', () => {
    it('devuelve el log de la tarea', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(mockLog);

      const result = await service.findByTaskId('task-1');

      expect(taskRepository.findOne).toHaveBeenCalledWith({ where: { id: 'task-1' } });
      expect(logRepository.findOne).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        relations: ['task', 'technician'],
      });
      expect(result.id).toBe('log-1');
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.findByTaskId('nonexistent')).rejects.toThrow('Tarea no encontrada');
    });

    it('lanza NotFoundException si la tarea no tiene log', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(null);

      await expect(service.findByTaskId('task-1')).rejects.toThrow(
        'Esta tarea no tiene log registrado',
      );
    });
  });

  describe('update', () => {
    it('actualiza payload y devuelve el log actualizado', async () => {
      const updatedPayload: ServerMaintenancePayload = {
        type: 'SERVER_MAINTENANCE',
        windows: {
          servers: [{ serverId: 1, serverName: '47DC', rebootScript: 'error', updates: 'pending' }],
          dcdiag: 'OK',
        },
      };
      const updatedLog = { ...mockLog, payload: updatedPayload };
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne
        .mockResolvedValueOnce(mockLog)     // buscar por taskId
        .mockResolvedValueOnce(updatedLog); // loadLog
      logRepository.update.mockResolvedValue({ affected: 1 });

      const dto: UpdateLogDto = { payload: updatedPayload };
      const result = await service.update('task-1', dto);

      expect(logRepository.update).toHaveBeenCalledWith('log-1', { payload: dto.payload });
      expect((result.payload as ServerMaintenancePayload).windows.servers[0].rebootScript).toBe('error');
    });

    it('lanza BadRequestException si el body está vacío', async () => {
      await expect(service.update('task-1', {})).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la tarea no tiene log', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.findOne.mockResolvedValue(null);

      await expect(service.update('task-1', { notes: 'test' })).rejects.toThrow(
        'Esta tarea no tiene log registrado',
      );
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', { notes: 'test' })).rejects.toThrow(
        'Tarea no encontrada',
      );
    });
  });
});