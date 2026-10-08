import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { CredentialVaultEntry } from './entities/credential-vault-entry.entity';
import { VeeamClientConfig } from './entities/veeam-client-config.entity';
import { encrypt, decrypt } from '../integration-config/crypto.util';
import type { CreateCredentialVaultEntryDto, CredentialVaultEntryResponseDto } from './dto/credential-vault.dto';

@Injectable()
export class CredentialVaultService {
  constructor(
    @InjectRepository(CredentialVaultEntry) private readonly vaultRepo: Repository<CredentialVaultEntry>,
    @InjectRepository(VeeamClientConfig) private readonly veeamConfigRepo: Repository<VeeamClientConfig>,
    private readonly configService: ConfigService,
  ) {}

  private get encryptKey(): string {
    return this.configService.get<string>('INTEGRATIONS_ENCRYPT_KEY', '');
  }

  private toDto(entry: CredentialVaultEntry): CredentialVaultEntryResponseDto {
    return { id: entry.id, name: entry.name, createdAt: entry.createdAt.toISOString() };
  }

  async list(): Promise<CredentialVaultEntryResponseDto[]> {
    const entries = await this.vaultRepo.find({ order: { name: 'ASC' } });
    return entries.map(e => this.toDto(e));
  }

  async create(dto: CreateCredentialVaultEntryDto): Promise<CredentialVaultEntryResponseDto> {
    const entity = this.vaultRepo.create({
      name: dto.name,
      encryptedPassword: encrypt(dto.password, this.encryptKey),
    });
    const saved = await this.vaultRepo.save(entity);
    return this.toDto(saved);
  }

  async delete(id: string): Promise<void> {
    const inUse = await this.veeamConfigRepo.findOne({ where: { credentialVaultEntryId: id } });
    if (inUse) {
      throw new ConflictException('Esta credencial está en uso por una o más configuraciones Veeam');
    }
    await this.vaultRepo.delete(id);
  }

  async getDecryptedPassword(id: string): Promise<string> {
    const entry = await this.vaultRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Credencial no encontrada');
    return decrypt(entry.encryptedPassword, this.encryptKey);
  }
}
