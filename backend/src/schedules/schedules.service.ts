import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig, RotationFrequency } from './rotation-config.entity';
import { MONTH_TO_GROUP, ScheduleGroup } from './schedule-group.enum';
import { UpsertClientScheduleDto } from './dto/upsert-client-schedule.dto';
import { SaveRotationConfigDto } from './dto/save-rotation-config.dto';
import { TasksService } from '../tasks/tasks.service';
import { TaskType } from '../tasks/task-type.enum';
import { TaskStatus } from '../tasks/task-status.enum';
import { Task } from '../tasks/task.entity';
import { Technician } from '../technicians/technician.entity';
import { TaskConfigService } from '../task-config/task-config.service';

export interface MonthlyPreviewClientDto {
  clientId: string;
  clientName: string;
  technicianId: string | null;
  technicianName: string | null;
}

export interface TaskStatsDto {
  total: number;
  done: number;
  notDone: number;
  clientsWithTasks: number;
}

export interface MonthlyPreviewDto {
  year: number;
  month: number;
  group: ScheduleGroup;
  clients: MonthlyPreviewClientDto[];
  clientsWithoutTechnician: number;
  wasGenerated: boolean;
  taskStats: TaskStatsDto | null;
  taskTypesWithoutTags: TaskType[];
}

export interface GenerationResultDto {
  tasksCreated: number;
  tasksSkipped: number;
  errors: Array<{ clientId: string; taskType: string; error: string }>;
}

export interface RotationPreviewDto {
  technicians: Array<{
    technicianId: string;
    name: string;
    clientCount: number;
    clients: string[];
  }>;
}

const V1_TASK_TYPES: TaskType[] = [
  TaskType.SERVER_HOST_MAINTENANCE,
  TaskType.WINDOWS_DOMAIN_MAINTENANCE,
  TaskType.QNAP_MAINTENANCE,
  TaskType.VEEAM_BACKUP,
  TaskType.ROUTER_MAINTENANCE,
];

const THROTTLE_MS = 800;

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    @InjectRepository(ClientSchedule)
    private readonly scheduleRepo: Repository<ClientSchedule>,
    @InjectRepository(RotationConfig)
    private readonly rotationRepo: Repository<RotationConfig>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Technician)
    private readonly techRepo: Repository<Technician>,
    private readonly tasksService: TasksService,
    private readonly taskConfigService: TaskConfigService,
  ) {}

  findAll(): Promise<ClientSchedule[]> {
    return this.scheduleRepo.find({
      relations: ['client', 'technician'],
      order: { client: { name: 'ASC' } },
    });
  }

  async upsert(clientId: string, dto: UpsertClientScheduleDto): Promise<ClientSchedule> {
    let rule = await this.scheduleRepo.findOne({ where: { clientId } });
    if (!rule) {
      rule = this.scheduleRepo.create({ clientId, ...dto });
    } else {
      Object.assign(rule, dto);
    }
    await this.scheduleRepo.save(rule);
    return this.scheduleRepo.findOne({
      where: { clientId },
      relations: ['client', 'technician', 'technician.user'],
    }) as Promise<ClientSchedule>;
  }

  async getRotationConfig(): Promise<RotationConfig> {
    const cfg = await this.rotationRepo.findOne({ where: {} });
    if (cfg) return cfg;
    const def = this.rotationRepo.create({
      isActive: false,
      frequency: RotationFrequency.EVERY_GENERATION,
      generationsSinceLastRotation: 0,
    });
    return this.rotationRepo.save(def);
  }

  async saveRotationConfig(dto: SaveRotationConfigDto): Promise<RotationConfig> {
    const cfg = await this.getRotationConfig();
    Object.assign(cfg, dto);
    return this.rotationRepo.save(cfg);
  }

  async previewRotation(): Promise<RotationPreviewDto> {
    const [rules, technicians] = await Promise.all([
      this.scheduleRepo.find({
        where: { isActive: true },
        relations: ['client'],
        order: { clientId: 'ASC' },
      }),
      this.techRepo.find({ relations: ['user'] }),
    ]);

    if (technicians.length === 0) return { technicians: [] };

    const distributed = this.distributeRoundRobin(rules, technicians);

    return {
      technicians: technicians.map((t) => {
        const assigned = distributed.filter((d) => d.technicianId === t.id);
        return {
          technicianId: t.id,
          name: t.user?.name ?? t.id,
          clientCount: assigned.length,
          clients: assigned.map((d) => (d.client as ClientSchedule['client'])?.name ?? d.clientId),
        };
      }),
    };
  }

  private distributeRoundRobin(
    rules: ClientSchedule[],
    technicians: Technician[],
  ): Array<{ clientId: string; technicianId: string; client: ClientSchedule['client'] }> {
    if (technicians.length === 0) return [];
    return rules.map((rule, idx) => ({
      clientId: rule.clientId,
      technicianId: technicians[idx % technicians.length].id,
      client: rule.client,
    }));
  }

  private async applyRotationIfNeeded(): Promise<void> {
    const cfg = await this.getRotationConfig();
    if (!cfg.isActive) return;

    if (cfg.frequency === RotationFrequency.EVERY_TWO_GENERATIONS) {
      cfg.generationsSinceLastRotation += 1;
      if (cfg.generationsSinceLastRotation < 2) {
        await this.rotationRepo.save(cfg);
        return;
      }
      cfg.generationsSinceLastRotation = 0;
    }

    const [rules, technicians] = await Promise.all([
      this.scheduleRepo.find({ where: { isActive: true }, order: { clientId: 'ASC' } }),
      this.techRepo.find(),
    ]);

    const distributed = this.distributeRoundRobin(rules, technicians);
    await Promise.all(
      distributed.map((d) =>
        this.scheduleRepo.update({ clientId: d.clientId }, { technicianId: d.technicianId }),
      ),
    );

    await this.rotationRepo.save(cfg);
  }

  async getMonthlyPreview(year: number, month: number): Promise<MonthlyPreviewDto> {
    const group = MONTH_TO_GROUP[month];
    const all = await this.scheduleRepo.find({
      where: { isActive: true, scheduleGroup: group },
      relations: ['client', 'technician', 'technician.user'],
    });

    const clients: MonthlyPreviewClientDto[] = all.map(r => ({
      clientId: r.clientId,
      clientName: r.client?.name ?? '',
      technicianId: r.technicianId ?? null,
      technicianName: r.technician?.user?.name ?? null,
    }));

    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

    const tasks = await this.taskRepo.find({
      where: { scheduledDate: Between(firstDay, lastDay) as unknown as string },
      select: ['id', 'status', 'clientId'],
    });

    const wasGenerated = tasks.length > 0;
    const taskStats: TaskStatsDto | null = wasGenerated
      ? {
          total: tasks.length,
          done: tasks.filter(
            t => t.status === TaskStatus.DONE || t.status === TaskStatus.ESCALATED,
          ).length,
          notDone: tasks.filter(t => t.status === TaskStatus.NOT_DONE).length,
          clientsWithTasks: new Set(tasks.map(t => t.clientId)).size,
        }
      : null;

    const configs = await this.taskConfigService.findAll();
    const configByType = new Map(configs.map(c => [c.taskType, c]));
    const taskTypesWithoutTags = V1_TASK_TYPES.filter(
      type => (configByType.get(type)?.odooTagIds.length ?? 0) === 0,
    );

    return {
      year,
      month,
      group,
      clients,
      clientsWithoutTechnician: clients.filter(c => !c.technicianId).length,
      wasGenerated,
      taskStats,
      taskTypesWithoutTags,
    };
  }

  private async closeUnfinishedTasksFromPreviousMonth(
    year: number,
    month: number,
  ): Promise<void> {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const pad = (n: number) => String(n).padStart(2, '0');
    const firstDay = `${prevYear}-${pad(prevMonth)}-01`;
    const lastDayNum = new Date(prevYear, prevMonth, 0).getDate();
    const lastDay = `${prevYear}-${pad(prevMonth)}-${pad(lastDayNum)}`;

    const unfinished = await this.taskRepo.find({
      where: [
        { scheduledDate: Between(firstDay, lastDay) as unknown as string, status: TaskStatus.PENDING },
        { scheduledDate: Between(firstDay, lastDay) as unknown as string, status: TaskStatus.IN_PROGRESS },
      ],
      select: ['id'],
    });

    for (const task of unfinished) {
      try {
        await this.tasksService.updateStatus(task.id, TaskStatus.NOT_DONE, {
          reason: 'Cierre automático de fin de mes',
        });
      } catch (err) {
        this.logger.warn(
          `No se pudo cerrar tarea ${task.id} automáticamente: ${(err as Error).message}`,
        );
      }
    }
  }

  async generateMonth(year: number, month: number): Promise<GenerationResultDto> {
    await this.closeUnfinishedTasksFromPreviousMonth(year, month);
    await this.applyRotationIfNeeded();
    const group = MONTH_TO_GROUP[month];
    const rules = await this.scheduleRepo.find({
      where: { isActive: true, scheduleGroup: group },
      relations: ['client', 'technician'],
    });

    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDay    = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;

    let tasksCreated = 0;
    let tasksSkipped = 0;
    const errors: GenerationResultDto['errors'] = [];

    for (const rule of rules) {
      if (!rule.technicianId) {
        tasksSkipped += V1_TASK_TYPES.length;
        continue;
      }

      for (const type of V1_TASK_TYPES) {
        const exists = await this.taskRepo.findOne({
          where: {
            clientId: rule.clientId,
            type,
            scheduledDate: Between(firstDay, lastDay) as unknown as string,
          },
        });

        if (exists) { tasksSkipped++; continue; }

        try {
          await this.tasksService.create({
            clientId: rule.clientId,
            technicianId: rule.technicianId,
            type,
            scheduledDate: firstDay,
          });
          tasksCreated++;
          await new Promise(r => setTimeout(r, THROTTLE_MS));
        } catch (err) {
          if (err instanceof BadRequestException) {
            // InfraDoc: cliente no tiene infra para este tipo → skip silencioso
            tasksSkipped++;
          } else {
            this.logger.error(`Error generando ${type} para ${rule.clientId}: ${(err as Error).message}`);
            errors.push({ clientId: rule.clientId, taskType: type, error: (err as Error).message });
          }
        }
      }
    }

    return { tasksCreated, tasksSkipped, errors };
  }
}
