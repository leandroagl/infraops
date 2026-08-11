import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig, RotationFrequency } from './rotation-config.entity';
import { ScheduleGroup } from './schedule-group.enum';
import { SchedulesService } from './schedules.service';
import { Technician } from '../technicians/technician.entity';

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

  beforeEach(async () => {
    scheduleRepo = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    rotationRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
    techRepo = { find: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: getRepositoryToken(ClientSchedule), useValue: scheduleRepo },
        { provide: getRepositoryToken(RotationConfig),  useValue: rotationRepo },
        // TasksService y TechnicianRepository inyectados después en Task 3/4
        { provide: getRepositoryToken(Technician), useValue: techRepo },
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
      scheduleRepo.findOne.mockResolvedValue(null);
      const created = { id: 'new', clientId: 'c-1', scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN };
      scheduleRepo.create.mockReturnValue(created);
      scheduleRepo.save.mockResolvedValue(created);
      scheduleRepo.find.mockResolvedValue([created]);

      const dto = { scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN, technicianId: null };
      const result = await service.upsert('c-1', dto);
      expect(scheduleRepo.create).toHaveBeenCalledWith({ clientId: 'c-1', ...dto });
      expect(result).toBe(created);
    });

    it('actualiza la regla si ya existe', async () => {
      const existing = { id: 'ex-1', clientId: 'c-1', scheduleGroup: ScheduleGroup.BIMONTHLY_ODD };
      scheduleRepo.findOne.mockResolvedValue(existing);
      scheduleRepo.save.mockResolvedValue({ ...existing, scheduleGroup: ScheduleGroup.BIMONTHLY_EVEN });
      scheduleRepo.find.mockResolvedValue([]);

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
});
