import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskConfigService } from './task-config.service';
import { TaskTypeConfig } from './task-type-config.entity';
import { TaskType } from '../tasks/task-type.enum';

describe('TaskConfigService', () => {
  let service: TaskConfigService;
  let repo: any;

  beforeEach(async () => {
    repo = { findOne: jest.fn(), save: jest.fn(), find: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskConfigService,
        { provide: getRepositoryToken(TaskTypeConfig), useValue: repo },
      ],
    }).compile();
    service = module.get<TaskConfigService>(TaskConfigService);
  });

  describe('upsert', () => {
    it('persists ondraOwnedHosts when provided', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (e: TaskTypeConfig) => e);

      const result = await service.upsert(TaskType.SERVER_HOST_MAINTENANCE, {
        ondraOwnedHosts: ['srv1-cloud.ondravirtual.com.ar'],
      });

      expect(result.ondraOwnedHosts).toEqual(['srv1-cloud.ondravirtual.com.ar']);
    });

    it('defaults ondraOwnedHosts to [] when not in DB', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (e: TaskTypeConfig) => e);

      const result = await service.upsert(TaskType.SERVER_HOST_MAINTENANCE, {});

      expect(result.ondraOwnedHosts).toEqual([]);
    });
  });
});
