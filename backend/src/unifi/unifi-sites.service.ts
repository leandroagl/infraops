import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiSiteConfig } from './entities/unifi-site-config.entity';
import {
  AvailableUnifiSiteDto,
  CreateUnifiSiteConfigDto,
  CreateUnifiSiteConfigsBulkDto,
  UpdateUnifiSiteConfigDto,
  UnifiSiteConfigResponseDto,
} from './dto/unifi-site-config.dto';
import { UnifiService } from '../integrations/unifi/unifi.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';

@Injectable()
export class UnifiSitesService {
  constructor(
    @InjectRepository(UnifiSiteConfig)
    private readonly repo: Repository<UnifiSiteConfig>,
    private readonly unifiSvc: UnifiService,
    private readonly integrationCfg: IntegrationConfigService,
  ) {}

  async findAll(): Promise<UnifiSiteConfigResponseDto[]> {
    return this.repo.find();
  }

  async create(dto: CreateUnifiSiteConfigDto): Promise<UnifiSiteConfigResponseDto> {
    const entity = this.repo.create({
      clientId: dto.clientId,
      clientName: dto.clientName,
      siteId: dto.siteId,
      siteName: dto.siteName,
      isEnabled: dto.isEnabled ?? true,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateUnifiSiteConfigDto): Promise<UnifiSiteConfigResponseDto> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Site config no encontrado');
    if (dto.siteName !== undefined) existing.siteName = dto.siteName;
    if (dto.isEnabled !== undefined) existing.isEnabled = dto.isEnabled;
    return this.repo.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Site config no encontrado');
    await this.repo.delete(id);
  }

  async findEnabled(): Promise<UnifiSiteConfig[]> {
    return this.repo.find({ where: { isEnabled: true } });
  }

  async createBulk(dto: CreateUnifiSiteConfigsBulkDto): Promise<UnifiSiteConfigResponseDto[]> {
    const results: UnifiSiteConfigResponseDto[] = [];
    for (const site of dto.sites) {
      const entity = this.repo.create({
        clientId: dto.clientId,
        clientName: dto.clientName,
        siteId: site.siteId,
        siteName: site.siteName,
        isEnabled: dto.isEnabled ?? true,
      });
      results.push(await this.repo.save(entity));
    }
    return results;
  }

  async getAvailableSites(): Promise<AvailableUnifiSiteDto[]> {
    const { apiKey } = await this.integrationCfg.getUnifiDecrypted();
    return this.unifiSvc.getAvailableSites(apiKey);
  }
}
