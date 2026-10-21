import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiAutoConfig } from './entities/unifi-auto-config.entity';
import { PatchUnifiAutoConfigDto, UnifiAutoConfigResponseDto } from './dto/unifi-auto-config.dto';

@Injectable()
export class UnifiAutoConfigService {
  constructor(
    @InjectRepository(UnifiAutoConfig)
    private readonly repo: Repository<UnifiAutoConfig>,
  ) {}

  private async getRow(): Promise<UnifiAutoConfig> {
    return (await this.repo.findOne({ where: { id: 1 } })) ?? new UnifiAutoConfig();
  }

  async get(): Promise<UnifiAutoConfigResponseDto> {
    const row = await this.getRow();
    return {
      enabled: row.enabled ?? false,
      severities: row.severities ?? ['critical'],
      helpdeskTeamId: row.helpdeskTeamId ?? null,
      tagIds: row.tagIds ?? [],
    };
  }

  async patch(dto: PatchUnifiAutoConfigDto): Promise<UnifiAutoConfigResponseDto> {
    const existing = await this.getRow();
    existing.id = 1;
    if (dto.enabled !== undefined)        existing.enabled        = dto.enabled;
    if (dto.severities !== undefined)     existing.severities     = dto.severities;
    if (dto.helpdeskTeamId !== undefined) existing.helpdeskTeamId = dto.helpdeskTeamId;
    if (dto.tagIds !== undefined)         existing.tagIds         = dto.tagIds;
    await this.repo.save(existing);
    return this.get();
  }
}
