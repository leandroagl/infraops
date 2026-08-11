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
import { Task } from '../tasks/task.entity';

export interface MonthlyPreviewClientDto {
  clientId: string;
  clientName: string;
  technicianId: string | null;
  technicianName: string | null;
}

export interface MonthlyPreviewDto {
  year: number;
  month: number;
  group: ScheduleGroup;
  clients: MonthlyPreviewClientDto[];
  clientsWithoutTechnician: number;
}

export interface GenerationResultDto {
  tasksCreated: number;
  tasksSkipped: number;
  errors: Array<{ clientId: string; taskType: string; error: string }>;
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
    private readonly tasksService: TasksService,
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

  previewRotation(): Promise<ClientSchedule[]> {
    return Promise.resolve([]);
  }

  async getMonthlyPreview(year: number, month: number): Promise<MonthlyPreviewDto> {
    const group = MONTH_TO_GROUP[month];
    const all = await this.scheduleRepo.find({
      where: { isActive: true, scheduleGroup: group },
      relations: ['client', 'technician', 'technician.user'],
    });

    const filtered = all.filter(r => r.scheduleGroup === group);

    const clients: MonthlyPreviewClientDto[] = filtered.map(r => ({
      clientId: r.clientId,
      clientName: r.client?.name ?? '',
      technicianId: r.technicianId ?? null,
      technicianName: r.technician?.user?.name ?? null,
    }));

    return {
      year,
      month,
      group,
      clients,
      clientsWithoutTechnician: clients.filter(c => !c.technicianId).length,
    };
  }

  async generateMonth(year: number, month: number): Promise<GenerationResultDto> {
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
