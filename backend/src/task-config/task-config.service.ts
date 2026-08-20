import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskType } from '../tasks/task-type.enum';
import { TaskTypeConfig } from './task-type-config.entity';
import { UpdateTaskConfigDto } from './dto/update-task-config.dto';
import { TICKET_DESCRIPTION_DEFAULTS } from './task-description-defaults';

const ALL_TASK_TYPES = Object.values(TaskType);

@Injectable()
export class TaskConfigService {
  constructor(
    @InjectRepository(TaskTypeConfig)
    private readonly repo: Repository<TaskTypeConfig>,
  ) {}

  async findAll(): Promise<TaskTypeConfig[]> {
    const rows = await this.repo.find();
    const byType = new Map(rows.map(r => [r.taskType, r]));
    return ALL_TASK_TYPES.map(taskType => {
      const config = byType.get(taskType) ?? this.defaultConfig(taskType);
      config.defaultTicketDescription = TICKET_DESCRIPTION_DEFAULTS[taskType];
      return config;
    });
  }

  async findOne(taskType: TaskType): Promise<TaskTypeConfig | null> {
    return this.repo.findOne({ where: { taskType } });
  }

  async upsert(taskType: TaskType, dto: UpdateTaskConfigDto): Promise<TaskTypeConfig> {
    const existing = (await this.repo.findOne({ where: { taskType } }))
      ?? this.defaultConfig(taskType);
    if (dto.defaultTimeMinutes !== undefined)  existing.defaultTimeMinutes  = dto.defaultTimeMinutes;
    if (dto.odooTagIds !== undefined)          existing.odooTagIds          = dto.odooTagIds;
    if (dto.odooTagNames !== undefined)        existing.odooTagNames        = dto.odooTagNames;
    if (dto.ticketDescription !== undefined)   existing.ticketDescription   = dto.ticketDescription;
    const saved = await this.repo.save(existing);
    saved.defaultTicketDescription = TICKET_DESCRIPTION_DEFAULTS[taskType];
    return saved;
  }

  private defaultConfig(taskType: TaskType): TaskTypeConfig {
    const config = new TaskTypeConfig();
    config.taskType           = taskType;
    config.defaultTimeMinutes = null;
    config.odooTagIds         = [];
    config.odooTagNames       = [];
    config.ticketDescription  = null;
    return config;
  }
}
