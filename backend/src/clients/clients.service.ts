import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { InfradocClient, InfradocService } from './infradoc/infradoc.service';

export interface SyncResult {
  created: number;
  updated: number;
  archived: number;
  unchanged: number;
  syncedAt: Date;
}

export type ClientResponse = Omit<Client, 'infradocId' | 'lastSyncedAt'>;

@Injectable()
export class ClientsService {
  private lastSyncAt: Date | null = null;
  private readonly COOLDOWN_MS = 60_000;

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly infradocService: InfradocService,
  ) {}

  async findAll(): Promise<ClientResponse[]> {
    const clients = await this.clientRepository.find({ order: { name: 'ASC' } });
    return clients.map(({ infradocId, lastSyncedAt, ...rest }) => rest);
  }

  async syncWithInfradoc(skipCooldown = false): Promise<SyncResult> {
    if (!skipCooldown && this.lastSyncAt !== null) {
      const elapsed = Date.now() - this.lastSyncAt.getTime();
      if (elapsed < this.COOLDOWN_MS) {
        throw new HttpException(
          'Sync ejecutado recientemente. Intentá de nuevo en unos segundos.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const [infradocClients, localClients] = await Promise.all([
      this.infradocService.getClients(),
      this.clientRepository.find(),
    ]);

    const localByInfradocId = new Map(localClients.map((c) => [c.infradocId, c]));
    const infradocIds = new Set(infradocClients.map((c) => c.infradocId));

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const remote of infradocClients) {
      const local = localByInfradocId.get(remote.infradocId);

      if (!local) {
        await this.clientRepository.save(
          this.clientRepository.create({ ...remote, lastSyncedAt: new Date() }),
        );
        created++;
      } else if (this.hasChanged(local, remote)) {
        const { infradocId, ...fields } = remote;
        await this.clientRepository.update(local.id, { ...fields, lastSyncedAt: new Date() });
        updated++;
      } else {
        unchanged++;
      }
    }

    let archived = 0;
    for (const local of localClients) {
      if (!infradocIds.has(local.infradocId) && local.isActive) {
        await this.clientRepository.update(local.id, {
          isActive: false,
          lastSyncedAt: new Date(),
        });
        archived++;
      }
    }

    const syncedAt = new Date();
    this.lastSyncAt = syncedAt;

    return { created, updated, archived, unchanged, syncedAt };
  }

  @Cron('0 */4 * * *')
  async scheduledSync(): Promise<void> {
    try {
      await this.syncWithInfradoc(true);
    } catch {
      // InfraDoc puede no estar disponible temporalmente
    }
  }

  private hasChanged(local: Client, remote: InfradocClient): boolean {
    return (
      local.name !== remote.name ||
      local.abbreviation !== remote.abbreviation ||
      local.type !== remote.type ||
      local.website !== remote.website ||
      local.referral !== remote.referral ||
      local.rate !== remote.rate ||
      local.currencyCode !== remote.currencyCode ||
      local.netTerms !== remote.netTerms ||
      local.taxIdNumber !== remote.taxIdNumber ||
      local.isLead !== remote.isLead ||
      local.notes !== remote.notes ||
      local.isActive !== remote.isActive
    );
  }
}