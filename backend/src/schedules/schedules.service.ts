import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientSchedule } from './client-schedule.entity';
import { RotationConfig, RotationFrequency } from './rotation-config.entity';
import { UpsertClientScheduleDto } from './dto/upsert-client-schedule.dto';
import { SaveRotationConfigDto } from './dto/save-rotation-config.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(ClientSchedule)
    private readonly scheduleRepo: Repository<ClientSchedule>,
    @InjectRepository(RotationConfig)
    private readonly rotationRepo: Repository<RotationConfig>,
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

  getMonthlyPreview(_year: number, _month: number): Promise<Record<string, unknown>> {
    return Promise.resolve({});
  }

  generateMonth(_year: number, _month: number): Promise<Record<string, unknown>> {
    return Promise.resolve({});
  }
}
