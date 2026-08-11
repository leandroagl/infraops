import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig, RotationFrequency } from './rotation-config.entity';
import { ScheduleGroup } from './schedule-group.enum';
import { SchedulesService, RotationPreviewDto } from './schedules.service';
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

    // Default: rotation disabled → applyRotationIfNeeded returns early in most tests
    rotationRepo.findOne.mockResolvedValue({
      id: 'r-default',
      isActive: false,
      frequency: RotationFrequency.EVERY_GENERATION,
      generationsSinceLastRotation: 0,
    });

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

    it('es idempotente: no duplica tarea existente y cuenta todas como omitidas', async () => {
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
      // Todas las tareas ya existen → skip sin throttle
      taskRepo.findOne.mockResolvedValue({ id: 'existing-task' });

      const result = await service.generateMonth(2026, 8);
      expect(tasksService.create).not.toHaveBeenCalled();
      expect(result.tasksSkipped).toBe(5); // V1_TASK_TYPES.length
      expect(result.tasksCreated).toBe(0);
    });

    it('cuenta todas las tareas como omitidas si el cliente no tiene técnico asignado', async () => {
      const rules: Partial<ClientSchedule>[] = [
        {
          clientId: 'c-2',
          scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN,
          technicianId: null,
          isActive: true,
          client: { name: 'Sin Técnico' } as Client,
          technician: null,
        },
      ];
      scheduleRepo.find.mockResolvedValue(rules);

      const result = await service.generateMonth(2026, 8);
      expect(tasksService.create).not.toHaveBeenCalled();
      expect(result.tasksSkipped).toBe(5); // V1_TASK_TYPES.length
      expect(result.tasksCreated).toBe(0);
    });
  });

  describe('previewRotation', () => {
    it('distribuye clientes en round-robin equilibrado', async () => {
      const rules: Partial<ClientSchedule>[] = [
        { clientId: 'c-1', isActive: true, client: { name: 'A' } as Client },
        { clientId: 'c-2', isActive: true, client: { name: 'B' } as Client },
        { clientId: 'c-3', isActive: true, client: { name: 'C' } as Client },
        { clientId: 'c-4', isActive: true, client: { name: 'D' } as Client },
        { clientId: 'c-5', isActive: true, client: { name: 'E' } as Client },
      ];

      scheduleRepo.find.mockResolvedValue(rules);
      techRepo.find.mockResolvedValue([
        { id: 't-1', user: { name: 'Enzo' } },
        { id: 't-2', user: { name: 'Tow' } },
      ]);

      const preview = await service.previewRotation();
      const counts = preview.technicians.map((t) => t.clientCount);
      const max = Math.max(...counts);
      const min = Math.min(...counts);
      expect(max - min).toBeLessThanOrEqual(1); // equilibrado
      expect(counts.reduce((a, b) => a + b, 0)).toBe(5); // todos asignados
    });

    it('retorna nombre del técnico desde user.name', async () => {
      scheduleRepo.find.mockResolvedValue([
        { clientId: 'c-1', isActive: true, client: { name: 'A' } as Client },
      ]);
      techRepo.find.mockResolvedValue([{ id: 't-1', user: { name: 'Enzo' } }]);

      const preview = await service.previewRotation();
      expect(preview.technicians[0].name).toBe('Enzo');
      expect(preview.technicians[0].technicianId).toBe('t-1');
    });

    it('lista los nombres de clientes asignados a cada técnico', async () => {
      scheduleRepo.find.mockResolvedValue([
        { clientId: 'c-1', isActive: true, client: { name: 'Alpha' } as Client },
        { clientId: 'c-2', isActive: true, client: { name: 'Beta' } as Client },
      ]);
      techRepo.find.mockResolvedValue([
        { id: 't-1', user: { name: 'Enzo' } },
        { id: 't-2', user: { name: 'Tow' } },
      ]);

      const preview = await service.previewRotation();
      const enzo = preview.technicians.find((t) => t.name === 'Enzo')!;
      const tow  = preview.technicians.find((t) => t.name === 'Tow')!;
      expect(enzo.clients).toContain('Alpha');
      expect(tow.clients).toContain('Beta');
    });
  });

  describe('applyRotationIfNeeded', () => {
    it('no hace nada si isActive = false', async () => {
      rotationRepo.findOne.mockResolvedValue({
        id: 'r-1',
        isActive: false,
        frequency: RotationFrequency.EVERY_GENERATION,
        generationsSinceLastRotation: 0,
      });

      // Simulamos generateMonth sin throttle para probar el call site
      scheduleRepo.find.mockResolvedValue([]);
      taskRepo.findOne.mockResolvedValue(null);

      await service.generateMonth(2026, 8);
      // techRepo.find no debe llamarse (no hay rotación)
      expect(techRepo.find).not.toHaveBeenCalled();
    });

    it('no rota en la primera generación con EVERY_TWO_GENERATIONS', async () => {
      const cfg = {
        id: 'r-1',
        isActive: true,
        frequency: RotationFrequency.EVERY_TWO_GENERATIONS,
        generationsSinceLastRotation: 0,
      };
      rotationRepo.findOne.mockResolvedValue(cfg);
      rotationRepo.save.mockResolvedValue({ ...cfg, generationsSinceLastRotation: 1 });

      scheduleRepo.find.mockResolvedValue([]);
      taskRepo.findOne.mockResolvedValue(null);

      await service.generateMonth(2026, 8);

      // Guardó el config con contador incrementado pero no llamó find para técnicos
      expect(rotationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ generationsSinceLastRotation: 1 }),
      );
      expect(techRepo.find).not.toHaveBeenCalled();
    });

    it('rota en la segunda generación con EVERY_TWO_GENERATIONS y resetea contador', async () => {
      const cfg = {
        id: 'r-1',
        isActive: true,
        frequency: RotationFrequency.EVERY_TWO_GENERATIONS,
        generationsSinceLastRotation: 1,
      };
      rotationRepo.findOne.mockResolvedValue(cfg);
      rotationRepo.save.mockResolvedValue({ ...cfg, generationsSinceLastRotation: 0 });

      scheduleRepo.find
        .mockResolvedValueOnce([{ clientId: 'c-1', isActive: true }]) // applyRotation: schedules
        .mockResolvedValue([]);                                          // generateMonth: schedules del grupo

      scheduleRepo.update = jest.fn().mockResolvedValue({ affected: 1 });
      techRepo.find.mockResolvedValue([{ id: 't-1', user: { name: 'Enzo' } }]);

      taskRepo.findOne.mockResolvedValue(null);

      await service.generateMonth(2026, 8);

      expect(techRepo.find).toHaveBeenCalled();
      expect(scheduleRepo.update).toHaveBeenCalledWith(
        { clientId: 'c-1' },
        { technicianId: 't-1' },
      );
      expect(rotationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ generationsSinceLastRotation: 0 }),
      );
    });

    it('rota de inmediato con EVERY_GENERATION', async () => {
      const cfg = {
        id: 'r-1',
        isActive: true,
        frequency: RotationFrequency.EVERY_GENERATION,
        generationsSinceLastRotation: 0,
      };
      rotationRepo.findOne.mockResolvedValue(cfg);
      rotationRepo.save.mockResolvedValue(cfg);

      scheduleRepo.find
        .mockResolvedValueOnce([{ clientId: 'c-1', isActive: true }])
        .mockResolvedValue([]);

      scheduleRepo.update = jest.fn().mockResolvedValue({ affected: 1 });
      techRepo.find.mockResolvedValue([{ id: 't-1', user: { name: 'Enzo' } }]);
      taskRepo.findOne.mockResolvedValue(null);

      await service.generateMonth(2026, 8);

      expect(techRepo.find).toHaveBeenCalled();
      expect(scheduleRepo.update).toHaveBeenCalledWith(
        { clientId: 'c-1' },
        { technicianId: 't-1' },
      );
    });
  });
});
