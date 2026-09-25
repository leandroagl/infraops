import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { ExpirationTicket } from './expiration-ticket.entity';
import {
  ExpirationItemDto, ExpirationDetailDto,
  UrgentBacklogPreviewDto, UrgentBacklogPreviewItemDto, UrgentBacklogResultDto,
} from './dto/expiration-item.dto';
import { OdooService } from '../integrations/odoo/odoo.service';
import { IntegrationConfigService } from '../integration-config/integration-config.service';
import { OdooConfigResponseDto } from '../integration-config/dto/odoo-config.dto';
import { Client } from '../clients/client.entity';
import { TasksService } from '../tasks/tasks.service';
import { TaskType } from '../tasks/task-type.enum';

type TypeConfigEntry = {
  enabled: boolean;
  helpdeskTeamId: number | null;
  daysAhead: number;
  tagIds: number[];
  taskName?: string | null;
  defaultTimeMinutes?: number | null;
  ticketDescription?: string | null;
  timesheetDescription?: string | null;
};
type TypeConfigs = Record<string, TypeConfigEntry>;

@Injectable()
export class ExpirationTicketsService {
  private readonly logger = new Logger(ExpirationTicketsService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly odooService: OdooService,
    private readonly integrationConfigService: IntegrationConfigService,
    @InjectRepository(ExpirationTicket)
    private readonly ticketRepo: Repository<ExpirationTicket>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    private readonly tasksService: TasksService,
  ) {}

  async getExpirationsWithTickets(days?: number): Promise<ExpirationItemDto[]> {
    const items = await this.notificationsService.getExpirations(days);
    if (items.length === 0) return items;

    const rows = await this.ticketRepo.find();
    const byKey = new Map(
      rows.map((r) => [this.key(r.type, r.sourceId, r.expireDate), r]),
    );

    return items.map((item) => {
      const row = byKey.get(this.key(item.type, item.sourceId, item.expireDate));
      return row?.odooTicketId != null
        ? { ...item, odooTicketId: row.odooTicketId }
        : item;
    });
  }

  async getExpirationByTaskId(taskId: string): Promise<ExpirationDetailDto | null> {
    const row = await this.ticketRepo.findOne({ where: { taskId } });
    if (!row) return null;

    const items = await this.notificationsService.getExpirations();
    const liveItem = items.find(
      (i) => i.type === row.type && i.sourceId === row.sourceId,
    );

    const config = await this.integrationConfigService.getOdoo();
    const typeConfigs = (config.expirationsTypeConfigs ?? {}) as TypeConfigs;
    const helpdeskTeamId = typeConfigs[row.type]?.helpdeskTeamId ?? null;

    let teamSlas: { id: number; name: string; time_days: number }[] | null = null;
    if (helpdeskTeamId) {
      try {
        teamSlas = await this.odooService.getHelpdeskSlas(helpdeskTeamId);
      } catch {
        teamSlas = null;
      }
    }

    return {
      type: row.type,
      sourceId: row.sourceId,
      expireDate: row.expireDate,
      clientId: row.clientId,
      clientName: liveItem?.clientName ?? null,
      itemName: liveItem?.itemName ?? null,
      make: liveItem?.make,
      model: liveItem?.model,
      serial: liveItem?.serial,
      daysUntil: liveItem?.daysUntil ?? null,
      odooTicketId: row.odooTicketId,
      defaultTimeMinutes: typeConfigs[row.type]?.defaultTimeMinutes ?? null,
      teamSlas,
    };
  }

  @Cron('0 8 * * *')
  async createPendingExpirationTickets(): Promise<void> {
    try {
      const config = await this.integrationConfigService.getOdooConfigDecrypted();
      const typeConfigs = (config.expirationsTypeConfigs ?? {}) as TypeConfigs;
      const enabledEntries = Object.entries(typeConfigs).filter(
        ([, c]) => c.enabled && c.helpdeskTeamId,
      );

      if (enabledEntries.length === 0) {
        this.logger.warn('createPendingExpirationTickets: ningún tipo habilitado con equipo configurado, omitiendo');
        return;
      }

      const configByType = new Map(enabledEntries);
      const maxDaysAhead = Math.max(...enabledEntries.map(([, c]) => c.daysAhead));
      const items = await this.notificationsService.getExpirations(maxDaysAhead);
      if (items.length === 0) {
        this.logger.log('createPendingExpirationTickets: 0 creados, 0 errores');
        return;
      }

      const existingRows = await this.ticketRepo.find();
      const existingKeys = new Set(
        existingRows.map((r) => this.key(r.type, r.sourceId, r.expireDate)),
      );

      const pending = items.filter((item) => {
        const cfg = configByType.get(item.type);
        if (!cfg) return false;
        if (item.daysUntil > cfg.daysAhead) return false;
        return !existingKeys.has(this.key(item.type, item.sourceId, item.expireDate));
      });

      let created = 0;
      let errors = 0;

      for (const item of pending) {
        const cfg = configByType.get(item.type)!;

        const client = await this.clientRepo.findOne({
          where: { infradocId: item.clientId, isActive: true },
        });
        if (!client) {
          this.logger.warn(`Cliente InfraDoc ${item.clientId} no encontrado (o inactivo) en InfraOps — omitiendo`);
          errors++;
          continue;
        }

        try {
          await this.createTicketWithTask(item, client.id, cfg);
          created++;
        } catch (err: unknown) {
          this.logger.error(
            `Error creando ticket para ${item.type} ${item.sourceId}: ${(err as Error).message}`,
          );
          errors++;
        }
      }

      this.logger.log(`createPendingExpirationTickets: ${created} creados, ${errors} errores`);
    } catch (err: unknown) {
      this.logger.error(`createPendingExpirationTickets falló: ${(err as Error).message}`, err as Error);
    }
  }

  // Crea el ticket en Odoo, persiste (o actualiza) la fila de expiration_tickets y
  // crea la Task asociada. Si existingRowId viene informado, actualiza esa fila
  // (backlog pre-sembrado) en vez de insertar una nueva.
  private async createTicketWithTask(
    item: ExpirationItemDto,
    clientId: string,
    cfg: TypeConfigEntry,
    existingRowId?: string,
  ): Promise<number> {
    const odooTicketId = await this.odooService.createExpirationTicket(
      item, clientId, cfg.helpdeskTeamId!, cfg.tagIds, cfg.taskName, cfg.ticketDescription,
    );

    let ticketRowId: string;
    if (existingRowId) {
      await this.ticketRepo.update(existingRowId, { odooTicketId });
      ticketRowId = existingRowId;
    } else {
      const saved = await this.ticketRepo.save({
        type: item.type,
        sourceId: item.sourceId,
        expireDate: item.expireDate,
        clientId,
        odooTicketId,
      });
      ticketRowId = saved.id;
    }

    try {
      const task = await this.tasksService.createFromExistingTicket({
        clientId,
        type: TaskType.EXPIRATION_CONTROL,
        odooTicketId,
        scheduledDate: new Date().toISOString().slice(0, 10),
        expirationType: item.type,
      });
      await this.ticketRepo.update(ticketRowId, { taskId: task.id });
    } catch (err: unknown) {
      this.logger.error(
        `Ticket ${odooTicketId} creado pero falló crear la Task asociada: ${(err as Error).message}`,
      );
    }

    return odooTicketId;
  }

  // Guarda la config por tipo del módulo Vencimientos. Cuando un tipo pasa de
  // deshabilitado a habilitado, pre-siembra su backlog actual (filas sin
  // odooTicketId real) para que el cron no dispare tickets para todo lo que
  // ya estaba pendiente — solo lo que aparezca de ahí en adelante.
  async saveTypeConfig(type: string, entry: TypeConfigEntry, updatedBy: string): Promise<OdooConfigResponseDto> {
    const before = await this.integrationConfigService.getOdoo();
    const oldConfigs = (before.expirationsTypeConfigs ?? {}) as TypeConfigs;
    const wasEnabled = oldConfigs[type]?.enabled ?? false;

    const newConfigs: TypeConfigs = { ...oldConfigs, [type]: entry };
    const result = await this.integrationConfigService.patchOdoo(
      { expirationsTypeConfigs: newConfigs },
      updatedBy,
    );

    if (entry.enabled && !wasEnabled) {
      await this.seedBacklogForType(type, entry.daysAhead);
    }

    return result;
  }

  private async seedBacklogForType(type: string, daysAhead: number): Promise<void> {
    const items = await this.notificationsService.getExpirations(daysAhead);
    const matching = items.filter((i) => i.type === type);
    if (matching.length === 0) return;

    const existingRows = await this.ticketRepo.find();
    const existingKeys = new Set(
      existingRows.map((r) => this.key(r.type, r.sourceId, r.expireDate)),
    );
    const toSeed = matching.filter(
      (i) => !existingKeys.has(this.key(i.type, i.sourceId, i.expireDate)),
    );
    if (toSeed.length === 0) return;

    const infradocIds = [...new Set(toSeed.map((i) => i.clientId))];
    const clients = await this.clientRepo.find({
      where: { infradocId: In(infradocIds), isActive: true },
    });
    const byInfradocId = new Map(clients.map((c) => [c.infradocId as number, c]));

    const rows = toSeed
      .map((i) => {
        const client = byInfradocId.get(i.clientId);
        if (!client) return null;
        return {
          type: i.type,
          sourceId: i.sourceId,
          expireDate: i.expireDate,
          clientId: client.id,
          odooTicketId: null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) return;
    await this.ticketRepo.insert(rows);
    this.logger.log(`Backlog pre-sembrado para ${type}: ${rows.length} vencimientos marcados sin ticket automático`);
  }

  // "Tickets urgentes" — catch-up manual, acotado por [minDays, maxDays], para vencimientos
  // de tipos habilitados que todavía no tienen ticket real. A diferencia del cron diario
  // (que respeta el daysAhead propio de cada tipo), compara siempre en vivo contra InfraDoc,
  // así detecta tanto backlog pre-sembrado (fila con odooTicketId null) como vencimientos
  // que nunca llegaron a tener fila de tracking.
  async getUrgentBacklogPreview(minDays: number, maxDays: number): Promise<UrgentBacklogPreviewDto> {
    const candidates = await this.getUrgentCandidates(minDays, maxDays);
    if (candidates.length === 0) return { count: 0, items: [] };

    const items: UrgentBacklogPreviewItemDto[] = candidates.map(({ item }) => ({
      type: item.type,
      sourceId: item.sourceId,
      expireDate: item.expireDate,
      clientName: item.clientName,
      itemName: item.itemName,
      daysUntil: item.daysUntil,
    }));

    return { count: items.length, items };
  }

  async createUrgentBacklogTickets(minDays: number, maxDays: number): Promise<UrgentBacklogResultDto> {
    const candidates = await this.getUrgentCandidates(minDays, maxDays);
    if (candidates.length === 0) return { created: 0, errors: 0 };

    let created = 0;
    let errors = 0;

    for (const { item, cfg, existingRow } of candidates) {
      const client = await this.clientRepo.findOne({
        where: { infradocId: item.clientId, isActive: true },
      });
      if (!client) {
        this.logger.warn(`Cliente InfraDoc ${item.clientId} no encontrado (o inactivo) en InfraOps — omitiendo`);
        errors++;
        continue;
      }

      try {
        await this.createTicketWithTask(item, client.id, cfg, existingRow?.id);
        created++;
      } catch (err: unknown) {
        this.logger.error(`Error en ticket urgente ${item.type}/${item.sourceId}: ${(err as Error).message}`);
        errors++;
      }
    }

    this.logger.log(`createUrgentBacklogTickets: ${created} creados, ${errors} errores`);
    return { created, errors };
  }

  private async getUrgentCandidates(
    minDays: number,
    maxDays: number,
  ): Promise<{ item: ExpirationItemDto; cfg: TypeConfigEntry; existingRow: ExpirationTicket | null }[]> {
    const config = await this.integrationConfigService.getOdooConfigDecrypted();
    const typeConfigs = (config.expirationsTypeConfigs ?? {}) as TypeConfigs;
    const enabledEntries = Object.entries(typeConfigs).filter(([, c]) => c.enabled && c.helpdeskTeamId);
    if (enabledEntries.length === 0) return [];
    const configByType = new Map(enabledEntries);

    const items = await this.notificationsService.getExpirations(maxDays);
    const inRange = items.filter(
      (i) => configByType.has(i.type) && i.daysUntil >= minDays && i.daysUntil <= maxDays,
    );
    if (inRange.length === 0) return [];

    const existingRows = await this.ticketRepo.find();
    const rowByKey = new Map(existingRows.map((r) => [this.key(r.type, r.sourceId, r.expireDate), r]));

    return inRange
      .map((item) => ({
        item,
        cfg: configByType.get(item.type)!,
        existingRow: rowByKey.get(this.key(item.type, item.sourceId, item.expireDate)) ?? null,
      }))
      .filter(({ existingRow }) => existingRow?.odooTicketId == null);
  }

  private key(type: string, sourceId: string, expireDate: string): string {
    return `${type}|${sourceId}|${expireDate}`;
  }
}
