import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TaskStatus } from '../tasks/task-status.enum';
import { TaskType } from '../tasks/task-type.enum';
import { Task } from '../tasks/task.entity';
import { QnapPayload } from '../maintenance-logs/log-item.interface';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { DeviationOperator } from '../deviation-rules/deviation-operator.enum';
import { DeviationRule } from '../deviation-rules/deviation-rule.entity';
import { DeviationRulesService } from '../deviation-rules/deviation-rules.service';
import { MaintenanceDeviationEvaluatorService } from './maintenance-deviation-evaluator.service';
import { MaintenanceDeviation } from './maintenance-deviation.entity';
import { MaintenanceDeviationStatus } from './maintenance-deviation-status.enum';

function rule(overrides: Partial<DeviationRule> = {}): DeviationRule {
  return {
    id: 'rule-1',
    taskType: TaskType.QNAP_MAINTENANCE,
    signalKey: 'maxUsedSpacePct',
    operator: DeviationOperator.GT,
    thresholdNumber: 90,
    thresholdBoolean: null,
    enabled: true,
    helpdeskTeamId: 7,
    tagIds: [3],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as DeviationRule;
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

function log(payload: QnapPayload, overrides: Partial<MaintenanceLog> = {}): MaintenanceLog {
  return {
    id: 'log-1',
    taskId: 'task-1',
    task: null as any,
    technicianId: 'tech-1',
    technician: null as any,
    payload,
    notes: null,
    registeredAt: new Date('2026-06-01'),
    ...overrides,
  };
}

function qnapPayload(overrides: Partial<QnapPayload['qnap'][number]> = {}): QnapPayload {
  return {
    type: 'QNAP_MAINTENANCE',
    qnap: [
      {
        deviceId: 1,
        deviceName: 'NAS-1',
        diskCount: 4,
        totalSpaceGB: 100,
        usedSpaceGB: 95,
        disksWithError: [],
        raidStatus: 'ok',
        firmwareVersion: '5.0',
        firmwareUpdated: true,
        ...overrides,
      },
    ],
  };
}

describe('MaintenanceDeviationEvaluatorService', () => {
  let service: MaintenanceDeviationEvaluatorService;
  let deviationRepo: any;
  let deviationRulesService: { findAll: jest.Mock };

  beforeEach(async () => {
    deviationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data),
      save: jest.fn(async (e) => e),
    };
    deviationRulesService = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceDeviationEvaluatorService,
        { provide: getRepositoryToken(MaintenanceDeviation), useValue: deviationRepo },
        { provide: DeviationRulesService, useValue: deviationRulesService },
      ],
    }).compile();

    service = module.get(MaintenanceDeviationEvaluatorService);
  });

  it('crea una detección PENDING cuando la señal matchea la regla', async () => {
    deviationRulesService.findAll.mockResolvedValue([rule()]);

    const result = await service.evaluate(log(qnapPayload({ usedSpaceGB: 95 })), task());

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(MaintenanceDeviationStatus.PENDING);
    expect(result[0].detectedValueNumber).toBe(95);
    expect(result[0].signalKey).toBe('maxUsedSpacePct');
    expect(result[0].taskId).toBe('task-1');
    expect(result[0].logId).toBe('log-1');
    expect(result[0].ruleId).toBe('rule-1');
    expect(result[0].helpdeskTeamId).toBe(7);
    expect(result[0].tagIds).toEqual([3]);
    expect(deviationRepo.save).toHaveBeenCalled();
  });

  it('no crea nada cuando la señal no matchea la regla', async () => {
    deviationRulesService.findAll.mockResolvedValue([rule()]);

    const result = await service.evaluate(log(qnapPayload({ usedSpaceGB: 50 })), task());

    expect(result).toHaveLength(0);
    expect(deviationRepo.save).not.toHaveBeenCalled();
  });

  it('no evalúa una regla si la señal devuelve null (sin datos)', async () => {
    deviationRulesService.findAll.mockResolvedValue([rule()]);
    const emptyPayload: QnapPayload = { type: 'QNAP_MAINTENANCE', qnap: [] };

    const result = await service.evaluate(log(emptyPayload), task());

    expect(result).toHaveLength(0);
    expect(deviationRepo.save).not.toHaveBeenCalled();
  });

  it('no duplica si ya existe una detección para ese log + señal', async () => {
    deviationRulesService.findAll.mockResolvedValue([rule()]);
    deviationRepo.findOne.mockResolvedValue({ id: 'existing' });

    const result = await service.evaluate(log(qnapPayload({ usedSpaceGB: 95 })), task());

    expect(result).toHaveLength(0);
    expect(deviationRepo.save).not.toHaveBeenCalled();
  });

  it('ignora las reglas deshabilitadas', async () => {
    deviationRulesService.findAll.mockResolvedValue([rule({ enabled: false })]);

    const result = await service.evaluate(log(qnapPayload({ usedSpaceGB: 95 })), task());

    expect(result).toHaveLength(0);
  });

  it('ignora reglas de otro taskType', async () => {
    deviationRulesService.findAll.mockResolvedValue([
      rule({ taskType: TaskType.VEEAM_BACKUP, signalKey: 'anyVmWithoutBackup', operator: DeviationOperator.EQ, thresholdBoolean: true, thresholdNumber: null }),
    ]);

    const result = await service.evaluate(log(qnapPayload({ usedSpaceGB: 95 })), task());

    expect(result).toHaveLength(0);
  });

  it('matchea una señal booleana con thresholdBoolean', async () => {
    deviationRulesService.findAll.mockResolvedValue([
      rule({
        taskType: TaskType.VEEAM_BACKUP,
        signalKey: 'anyVmWithoutBackup',
        operator: DeviationOperator.EQ,
        thresholdBoolean: true,
        thresholdNumber: null,
      }),
    ]);
    const veeamPayload = {
      type: 'VEEAM_BACKUP' as const,
      notes: null,
      vms: [{ vmName: 'VM1', coverage: 'no_backup' as const, fullsInMonth: null }],
    };

    const result = await service.evaluate(
      log(veeamPayload as any, { taskId: 'task-2' }),
      task({ id: 'task-2', type: TaskType.VEEAM_BACKUP }),
    );

    expect(result).toHaveLength(1);
    expect(result[0].detectedValueBoolean).toBe(true);
  });
});
