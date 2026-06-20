import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import {
  InfradocClient,
  InfradocLocation,
  InfradocService,
} from './infradoc/infradoc.service';

export interface SyncResult {
  created: number;
  updated: number;
  archived: number;
  unchanged: number;
  syncedAt: Date;
}

export type ClientResponse = Omit<Client, 'infradocId' | 'lastSyncedAt'>;

@Injectable()
export class ClientsService implements OnModuleInit {
  private readonly logger = new Logger(ClientsService.name);
  private lastSyncAt: Date | null = null;
  private readonly COOLDOWN_MS = 60_000;

  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    private readonly infradocService: InfradocService,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.clientRepository.count();
    if (count === 0) {
      this.logger.log('BD de clientes vacía — iniciando sync con InfraDoc...');
      await this.syncWithInfradoc(true);
      this.logger.log('Sync inicial completado.');
    }
  }

  async findAll(): Promise<ClientResponse[]> {
    const clients = await this.clientRepository.find({
      order: { name: 'ASC' },
    });
    return clients.map(({ infradocId, lastSyncedAt, ...rest }) => rest);
  }

  async findOne(id: string): Promise<ClientResponse> {
    const client = await this.clientRepository.findOne({ where: { id } });
    if (!client) throw new NotFoundException(`Cliente ${id} no encontrado`);
    const { infradocId, lastSyncedAt, ...rest } = client;
    return rest;
  }

  async findInfradocId(id: string): Promise<number | null> {
    const client = await this.clientRepository.findOne({
      where: { id },
      select: ['infradocId'],
    });
    return client?.infradocId ?? null;
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

    const [infradocClients, localClients, infradocLocations] =
      await Promise.all([
        this.infradocService.getClients(),
        this.clientRepository.find(),
        this.infradocService.getLocations(),
      ]);

    const primaryAddressMap = new Map<number, string>();
    for (const loc of infradocLocations) {
      if (loc.isPrimary) {
        const parts = [loc.address, loc.city].filter(Boolean) as string[];
        primaryAddressMap.set(loc.infradocClientId, parts.join(', '));
      }
    }

    const localByInfradocId = new Map(
      localClients.map((c) => [c.infradocId, c]),
    );
    const infradocIds = new Set(infradocClients.map((c) => c.infradocId));

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const remote of infradocClients) {
      const local = localByInfradocId.get(remote.infradocId);
      const newPrimaryAddress =
        primaryAddressMap.get(remote.infradocId) ?? null;

      if (!local) {
        await this.clientRepository.save(
          this.clientRepository.create({
            ...remote,
            lastSyncedAt: new Date(),
            primaryAddress: newPrimaryAddress,
          }),
        );
        created++;
      } else if (this.hasChanged(local, remote, newPrimaryAddress)) {
        const { infradocId, ...fields } = remote;
        await this.clientRepository.update(local.id, {
          ...fields,
          lastSyncedAt: new Date(),
          primaryAddress: newPrimaryAddress,
        });
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
      const result = await this.syncWithInfradoc(true);
      this.logger.log(`Sync periódico completado: ${JSON.stringify(result)}`);
    } catch (err: unknown) {
      this.logger.error(
        'Sync periódico fallido — InfraDoc puede no estar disponible',
        err,
      );
    }
  }

  private hasChanged(
    local: Client,
    remote: InfradocClient,
    newPrimaryAddress: string | null,
  ): boolean {
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
      local.isActive !== remote.isActive ||
      local.primaryAddress !== newPrimaryAddress
    );
  }
}
