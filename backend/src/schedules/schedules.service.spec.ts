import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig, RotationFrequency } from './rotation-config.entity';
import { ScheduleGroup } from './schedule-group.enum';
import { SchedulesService } from './schedules.service';
import { Technician } from '../technicians/technician.entity';
import { Client } from '../clients/client.entity';
import { Task } from '../tasks/task.entity';
import { TasksService } from '../tasks/tasks.service';

describe('SchedulesService', () => {
  let service: SchedulesService;
  let scheduleRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let rotationRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let techRepo: { find: jest.Mock };
  let tasksService: { create: jest.Mock };
  let taskRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    scheduleRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    rotationRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    techRepo = { find: jest.fn() };
    tasksService = { create: jest.fn() };
    taskRepo = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: getRepositoryToken(ClientSchedule), useValue: scheduleRepo },
        { provide: getRepositoryToken(RotationConfig),  useValue: rotationRepo },
        { provide: getRepositoryToken(Task), useValue: taskRepo },
        { provide: getRepositoryToken(Technician), useValue: techRepo },
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();

    service = module.get(SchedulesService);
  });

  describe('findAll', () => {
    it('devuelve todas las reglas con relaciones', async () => {
      const rules = [{ id: 'uuid-1', clientId: 'c-1' }];
      scheduleRepo.find.mockResolvedValue(rules);
      const result = await service.findAll();
      expect(result).toBe(rules);
      expect(scheduleRepo.find).toHaveBeenCalledWith({
        relations: ['client', 'technician'],
        order: { client: { name: 'ASC' } },
      });
    });
  });

  describe('upsert', () => {
    it('crea la regla si no existe', async () => {
      const created = { id: 'new', clientId: 'c-1', scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN };
      scheduleRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(created);
      scheduleRepo.create.mockReturnValue(created);
      scheduleRepo.save.mockResolvedValue(created);

      const dto = { scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN, technicianId: null };
      const result = await service.upsert('c-1', dto);
      expect(scheduleRepo.create).toHaveBeenCalledWith({ clientId: 'c-1', ...dto });
      expect(result).toBe(created);
    });

    it('actualiza la regla si ya existe', async () => {
      const existing = { id: 'ex-1', clientId: 'c-1', scheduleGroup: ScheduleGroup.BIMONTHLY_ODD };
      const updated = { ...existing, scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN };
      scheduleRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(updated);
      scheduleRepo.save.mockResolvedValue(updated);

      const dto = { scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN, technicianId: null };
      await service.upsert('c-1', dto);
      expect(scheduleRepo.save).toHaveBeenCalledWith({ ...existing, ...dto });
    });
  });

  describe('getRotationConfig', () => {
    it('devuelve config existente', async () => {
      const cfg = { id: 'r-1', isActive: false };
      rotationRepo.findOne.mockResolvedValue(cfg);
      expect(await service.getRotationConfig()).toBe(cfg);
    });

    it('crea config por defecto si no existe', async () => {
      rotationRepo.findOne.mockResolvedValue(null);
      const def = { isActive: false, frequency: RotationFrequency.EVERY_GENERATION, generationsSinceLastRotation: 0 };
      rotationRepo.create.mockReturnValue(def);
      rotationRepo.save.mockResolvedValue(def);
      await service.getRotationConfig();
      expect(rotationRepo.create).toHaveBeenCalled();
    });
  });

  describe('getMonthlyPreview', () => {
    it('devuelve clientes del grupo par para mes par', async () => {
      const rules: Partial<ClientSchedule>[] = [
        {
          clientId: 'c-1',
          scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN,
          technicianId: 't-1',
          client: { name: 'Cliente A' } as Client,
          technician: { user: { name: 'Enzo' } } as Technician,
          isActive: true,
        },
      ];
      scheduleRepo.find.mockResolvedValue(rules);

      const result = await service.getMonthlyPreview(2026, 8); // agosto = par
      expect(result.group).toBe(ScheduleGroup.BIMONTHLY_EVEN);
      expect(result.clients).toHaveLength(1);
      expect(result.clientsWithoutTechnician).toBe(0);
    });

    it('filtra clientes del grupo impar en mes par', async () => {
      const rules: Partial<ClientSchedule>[] = [
        {
          clientId: 'c-2',
          scheduleGroup: ScheduleGroup.BIMONTHLY_ODD, // no aplica en mes par
          isActive: true,
          client: { name: 'B' } as Client,
          technician: null,
        },
      ];
      scheduleRepo.find.mockResolvedValue(rules);
      const result = await service.getMonthlyPreview(2026, 8);
      expect(result.clients).toHaveLength(0);
    });
  });

  describe('generateMonth', () => {
    it('crea tareas y respeta throttle', async () => {
      jest.useFakeTimers();
      const rules: Partial<ClientSchedule>[] = [
        {
          clientId: 'c-1',
          scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN,
          technicianId: 't-1',
          isActive: true,
          client: { name: 'A' } as Client,
          technician: {} as Technician,
        },
      ];
      scheduleRepo.find.mockResolvedValue(rules);
      taskRepo.findOne.mockResolvedValue(null); // no existe tarea previa
      tasksService.create.mockResolvedValue({ id: 'task-1' });

      const promise = service.generateMonth(2026, 8);
      jest.runAllTimersAsync();
      const result = await promise;

      expect(result.tasksCreated).toBeGreaterThanOrEqual(0);
      expect(result.errors).toBeDefined();
      jest.useRealTimers();
    });

    it('es idempotente: no duplica tarea existente', async () => {
      const rules: Partial<ClientSchedule>[] = [
        {
          clientId: 'c-1',
          scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN,
          technicianId: 't-1',
          isActive: true,
          client: { name: 'A' } as Client,
          technician: {} as Technician,
        },
      ];
      scheduleRepo.find.mockResolvedValue(rules);
      // Tarea ya existe → skip
      taskRepo.findOne.mockResolvedValue({ id: 'existing-task' });

      const result = await service.generateMonth(2026, 8);
      expect(tasksService.create).not.toHaveBeenCalled();
      expect(result.tasksSkipped).toBeGreaterThan(0);
    });
  });
});
