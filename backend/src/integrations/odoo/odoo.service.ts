import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { User } from '../../users/user.entity';
import { Technician } from '../../technicians/technician.entity';
import { OdooSystemRpcService } from './odoo-system-rpc.service';
import { OdooPartner } from './dto/odoo-partner.dto';
import { OdooUser } from './dto/odoo-user.dto';
import { OdooSyncResult } from './dto/odoo-sync-result.dto';
import { OdooSyncStatusDto } from './dto/odoo-sync-status.dto';
import { ClientSubscriptionHoursDto } from './dto/client-subscription-hours.dto';
import { TaskType } from '../../tasks/task-type.enum';
import { TaskConfigService } from '../../task-config/task-config.service';
import { TICKET_DESCRIPTION_DEFAULTS } from '../../task-config/task-description-defaults';

const TICKET_META: Record<TaskType, { name: string }> = {
  [TaskType.SERVER_HOST_MAINTENANCE]:    { name: 'Mantenimiento de hosts VMware/BMC' },
  [TaskType.WINDOWS_DOMAIN_MAINTENANCE]: { name: 'Mantenimiento de servidores y dominio Windows' },
  [TaskType.ROUTER_MAINTENANCE]:         { name: 'Mantenimiento de router y firewall' },
  [TaskType.QNAP_MAINTENANCE]:           { name: 'Mantenimiento repositorio de backups QNAP/NAS' },
  [TaskType.VEEAM_BACKUP]:               { name: 'Mantenimiento de backups Veeam' },
  [TaskType.TERMINAL_MAINTENANCE]:       { name: 'Mantenimiento de terminales' },
  [TaskType.SITE_VISIT]:                 { name: 'Visita técnica presencial' },
  [TaskType.AV_CONTROL]:                 { name: 'Control de antivirus' },
  [TaskType.UPS_CONTROL]:               { name: 'Control de UPS' },
  [TaskType.ENDPOINT_INVENTORY]:         { name: 'Inventario de endpoints' },
};

@Injectable()
export class OdooService {
  private readonly logger = new Logger(OdooService.name);
  private doneStageId: number | null = null;
  private inProgressStageId: number | null = null;

  constructor(
    private readonly systemRpc: OdooSystemRpcService,
    private readonly configService: ConfigService,
    private readonly taskConfigService: TaskConfigService,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Technician)
    private readonly technicianRepo: Repository<Technician>,
  ) {}

  async syncPartners(): Promise<OdooSyncResult> {
    const [odooPartners, localClients] = await Promise.all([
      this.systemRpc.callKw<OdooPartner[]>(
        'res.partner',
        'search_read',
        [
          [
            ['is_company', '=', true],
            ['vat', '!=', false],
          ],
        ],
        { fields: ['id', 'name', 'vat'] },
      ),
      this.clientRepo.find(),
    ]);

    const clientByCuit = new Map(
      localClients
        .filter((c) => c.taxIdNumber)
        .map((c) => [c.taxIdNumber!.replace(/-/g, ''), c]),
    );

    let matched = 0;
    const unmatched: string[] = [];

    for (const partner of odooPartners) {
      if (!partner.vat) {
        unmatched.push(
          typeof partner.name === 'string' ? partner.name : `id:${partner.id}`,
        );
        continue;
      }
      const client = clientByCuit.get(partner.vat.replace(/-/g, ''));
      if (client) {
        await this.clientRepo.update(client.id, {
          odooPartnerId: partner.id,
          odooSyncedAt: new Date(),
        });
        matched++;
      } else {
        unmatched.push(
          typeof partner.name === 'string' ? partner.name : partner.vat,
        );
      }
    }

    return { matched, unmatched, total: odooPartners.length };
  }

  async syncUsers(): Promise<OdooSyncResult> {
    const [odooUsers, localUsers] = await Promise.all([
      this.systemRpc.callKw<OdooUser[]>(
        'res.users',
        'search_read',
        [[['active', '=', true]]],
        { fields: ['id', 'login', 'name'] },
      ),
      this.userRepo.find({ where: { isActive: true } }),
    ]);

    const userByEmail = new Map(localUsers.map((u) => [u.email, u]));
    let matched = 0;
    const unmatched: string[] = [];
    const matchedPairs: Array<{ userId: string; odooUserId: number }> = [];

    for (const odooUser of odooUsers) {
      if (!odooUser.login) continue;
      const login = odooUser.login;
      const user = userByEmail.get(login);
      if (user) {
        await this.userRepo.update(user.id, {
          odooUserId: odooUser.id,
          odooSyncedAt: new Date(),
        });
        matchedPairs.push({ userId: user.id, odooUserId: odooUser.id });
        matched++;
      } else {
        unmatched.push(login);
      }
    }

    if (matchedPairs.length > 0) {
      const employees = await this.systemRpc.callKw<
        Array<{ id: number; user_id: [number, string] }>
      >(
        'hr.employee',
        'search_read',
        [[['user_id', 'in', matchedPairs.map((p) => p.odooUserId)]]],
        { fields: ['id', 'user_id'] },
      );
      const employeeByOdooUserId = new Map(
        employees.map((e) => [e.user_id[0], e.id]),
      );
      for (const pair of matchedPairs) {
        const employeeId = employeeByOdooUserId.get(pair.odooUserId);
        if (employeeId !== undefined) {
          await this.userRepo.update(pair.userId, {
            odooEmployeeId: employeeId,
          });
        }
      }
    }

    return { matched, unmatched, total: odooUsers.length };
  }

  async getSyncStatus(): Promise<OdooSyncStatusDto> {
    const [clientsWithoutOdooId, usersWithoutOdooId] = await Promise.all([
      this.clientRepo.count({ where: { odooPartnerId: IsNull() } }),
      this.userRepo.count({ where: { odooUserId: IsNull() } }),
    ]);
    return { clientsWithoutOdooId, usersWithoutOdooId };
  }

  async resolvePartnerId(clientId: string): Promise<number | null> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) return null;
    if (client.odooPartnerId !== null) return client.odooPartnerId;
    if (!client.taxIdNumber) return null;

    const normalizedVat = client.taxIdNumber.replace(/-/g, '');
    const partners = await this.systemRpc.callKw<OdooPartner[]>(
      'res.partner',
      'search_read',
      [
        [
          ['vat', '=', normalizedVat],
          ['is_company', '=', true],
        ],
      ],
      { fields: ['id', 'vat'], limit: 1 },
    );

    if (partners.length === 0) return null;

    await this.clientRepo.update(clientId, {
      odooPartnerId: partners[0].id,
      odooSyncedAt: new Date(),
    });
    return partners[0].id;
  }

  async resolveUserId(userId: string): Promise<number | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    if (user.odooUserId !== null) return user.odooUserId;

    const odooUsers = await this.systemRpc.callKw<OdooUser[]>(
      'res.users',
      'search_read',
      [[['login', '=', user.email]]],
      { fields: ['id', 'login'], limit: 1 },
    );

    if (odooUsers.length === 0) return null;

    await this.userRepo.update(userId, {
      odooUserId: odooUsers[0].id,
      odooSyncedAt: new Date(),
    });
    return odooUsers[0].id;
  }

  async resolveEmployeeId(userId: string): Promise<number | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    if (user.odooEmployeeId !== null) return user.odooEmployeeId;
    if (user.odooUserId === null) return null;

    const employees = await this.systemRpc.callKw<Array<{ id: number }>>(
      'hr.employee',
      'search_read',
      [[['user_id', '=', user.odooUserId]]],
      { fields: ['id'], limit: 1 },
    );

    if (employees.length === 0) return null;

    await this.userRepo.update(userId, {
      odooEmployeeId: employees[0].id,
      odooSyncedAt: new Date(),
    });
    return employees[0].id;
  }

  async resolveSaleLineId(clientId: string): Promise<number | null> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) return null;
    if (client.odooSaleLineId !== null) return client.odooSaleLineId;
    if (client.odooPartnerId === null) return null;

    const lines = await this.systemRpc.callKw<Array<{ id: number }>>(
      'sale.order.line',
      'search_read',
      [
        [
          ['order_id.partner_id', '=', client.odooPartnerId],
          ['product_id.name', '=', 'Hora Única'],
          ['order_id.state', 'in', ['sale', 'done']],
        ],
      ],
      { fields: ['id'], limit: 1 },
    );

    if (lines.length === 0) return null;

    await this.clientRepo.update(clientId, {
      odooSaleLineId: lines[0].id,
      odooSyncedAt: new Date(),
    });
    return lines[0].id;
  }

  async getSubscriptionHours(
    partnerIds: number[],
  ): Promise<{ partnerId: number; contracted: number; delivered: number }[]> {
    if (partnerIds.length === 0) return [];

    const lines = await this.systemRpc.callKw<
      Array<{
        id: number;
        product_uom_qty: number;
        qty_delivered: number;
        order_id: [number, string];
      }>
    >(
      'sale.order.line',
      'search_read',
      [
        [
          ['order_id.partner_id', 'in', partnerIds],
          ['product_id.name', 'in', ['Hora Única', 'Hora Única Garantia']],
          ['order_id.state', 'in', ['sale', 'done']],
        ],
      ],
      { fields: ['product_uom_qty', 'qty_delivered', 'order_id'] },
    );

    if (lines.length === 0) return [];

    const orderIds = [...new Set(lines.map((l) => l.order_id[0]))];
    const orders = await this.systemRpc.callKw<
      Array<{ id: number; partner_id: [number, string] }>
    >(
      'sale.order',
      'read',
      [orderIds],
      { fields: ['partner_id'] },
    );

    const partnerByOrderId = new Map(orders.map((o) => [o.id, o.partner_id[0]]));

    const totals = new Map<number, { contracted: number; delivered: number }>();
    for (const line of lines) {
      const partnerId = partnerByOrderId.get(line.order_id[0]);
      if (partnerId === undefined) continue;
      const existing = totals.get(partnerId) ?? { contracted: 0, delivered: 0 };
      totals.set(partnerId, {
        contracted: existing.contracted + line.product_uom_qty,
        delivered: existing.delivered + line.qty_delivered,
      });
    }

    return Array.from(totals.entries()).map(([partnerId, { contracted, delivered }]) => ({
      partnerId,
      contracted,
      delivered,
    }));
  }

  async getClientSubscriptionHours(): Promise<ClientSubscriptionHoursDto[]> {
    const clients = await this.clientRepo.find({
      where: { isActive: true, odooPartnerId: Not(IsNull()) },
      select: { id: true, odooPartnerId: true },
    });

    if (clients.length === 0) return [];

    const partnerIds = clients.map((c) => c.odooPartnerId!);
    const hours = await this.getSubscriptionHours(partnerIds);

    const partnerToClientId = new Map(clients.map((c) => [c.odooPartnerId!, c.id]));

    return hours.map(({ partnerId, contracted, delivered }) => ({
      clientId: partnerToClientId.get(partnerId)!,
      contracted,
      delivered,
      available: Math.max(0, contracted - delivered),
    }));
  }

  private async logTimesheet(
    odooTicketId: number,
    employeeId: number,
    unitAmount: number,
  ): Promise<void> {
    await this.systemRpc.callKw<number>(
      'account.analytic.line',
      'create',
      [
        {
          helpdesk_ticket_id: odooTicketId,
          employee_id: employeeId,
          name: 'Mantenimiento realizado',
          unit_amount: unitAmount,
          date: new Date().toISOString().split('T')[0],
        },
      ],
      {},
    );
  }

  private async resolveInProgressStageId(): Promise<number> {
    if (this.inProgressStageId !== null) return this.inProgressStageId;

    const teamId = parseInt(
      this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
      10,
    );

    const stages = await this.systemRpc.callKw<Array<{ id: number }>>(
      'helpdesk.stage',
      'search_read',
      [
        [
          ['team_ids', 'in', [teamId]],
          ['name', '=', 'En curso'],
        ],
      ],
      { fields: ['id'], limit: 1 },
    );

    if (stages.length === 0) {
      throw new ServiceUnavailableException(
        'No se encontró stage "En curso" en Odoo para el equipo configurado',
      );
    }

    this.inProgressStageId = stages[0].id;
    return this.inProgressStageId;
  }

  async markTicketInProgress(odooTicketId: number): Promise<void> {
    const stageId = await this.resolveInProgressStageId();
    await this.systemRpc.callKw<boolean>(
      'helpdesk.ticket',
      'write',
      [[odooTicketId], { stage_id: stageId }],
      {},
    );
  }

  private async resolveDoneStageId(): Promise<number> {
    if (this.doneStageId !== null) return this.doneStageId;

    const teamId = parseInt(
      this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
      10,
    );

    const stages = await this.systemRpc.callKw<Array<{ id: number }>>(
      'helpdesk.stage',
      'search_read',
      [
        [
          ['team_ids', 'in', [teamId]],
          ['fold', '=', true],
        ],
      ],
      { fields: ['id'], limit: 1 },
    );

    if (stages.length === 0) {
      throw new ServiceUnavailableException(
        'No se encontró stage de cierre en Odoo para el equipo configurado',
      );
    }

    this.doneStageId = stages[0].id;
    return this.doneStageId;
  }

  async getHelpdeskTags(): Promise<{ id: number; name: string }[]> {
    const tags = await this.systemRpc.callKw<Array<{ id: number; name: string }>>(
      'helpdesk.tag',
      'search_read',
      [[]],
      { fields: ['id', 'name'] },
    );
    return tags.map(t => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async closeTicket(
    odooTicketId: number,
    employeeId: number,
    unitAmount: number,
  ): Promise<void> {
    const stageId = await this.resolveDoneStageId();
    await this.logTimesheet(odooTicketId, employeeId, unitAmount);
    await this.systemRpc.callKw<boolean>(
      'helpdesk.ticket',
      'write',
      [[odooTicketId], { stage_id: stageId }],
      {},
    );
  }

  async createTicket(
    clientId: string,
    technicianId: string,
    taskType: TaskType,
  ): Promise<number> {
    const teamId = parseInt(
      this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
      10,
    );
    if (isNaN(teamId)) {
      throw new BadRequestException(
        'ODOO_HELPDESK_TEAM_ID must be a valid integer',
      );
    }

    const partnerId = await this.resolvePartnerId(clientId);
    if (partnerId === null) {
      throw new BadRequestException(`Cliente ${clientId} no tiene ID de Odoo`);
    }

    const technician = await this.technicianRepo.findOne({
      where: { id: technicianId },
      relations: ['user'],
    });
    if (!technician) {
      throw new BadRequestException(`Técnico ${technicianId} no encontrado`);
    }
    if (!technician.user) {
      throw new BadRequestException(
        `Técnico ${technicianId} no tiene usuario asociado`,
      );
    }

    const odooUserId = await this.resolveUserId(technician.user.id);
    if (odooUserId === null) {
      throw new BadRequestException(
        `Técnico ${technicianId} no tiene ID de Odoo`,
      );
    }

    const saleLineId = await this.resolveSaleLineId(clientId);
    const meta = TICKET_META[taskType];
    const config = await this.taskConfigService.findOne(taskType);

    const payload: Record<string, unknown> = {
      team_id: teamId,
      partner_id: partnerId,
      user_id: odooUserId,
      name: meta.name,
      description: config?.ticketDescription ?? TICKET_DESCRIPTION_DEFAULTS[taskType],
    };
    if (saleLineId !== null) {
      payload['sale_line_id'] = saleLineId;
    }
    if (config && config.odooTagIds.length > 0) {
      payload['tag_ids'] = [[6, 0, config.odooTagIds]];
    }

    const ticketId = await this.systemRpc.callKw<number>(
      'helpdesk.ticket',
      'create',
      [payload],
      {},
    );
    if (!ticketId) {
      throw new ServiceUnavailableException(
        'Odoo devolvió false al crear el ticket — verificar sale_line_id y permisos del equipo',
      );
    }
    return ticketId;
  }

  async postInternalNote(ticketId: number, note: string, technicianUserId: string): Promise<void> {
    const partnerId = await this.resolveUserPartnerId(technicianUserId);
    const kwargs: Record<string, unknown> = {
      body: note,
      message_type: 'comment',
      subtype_xmlid: 'mail.mt_note',
    };
    if (partnerId !== null) kwargs['author_id'] = partnerId;
    await this.systemRpc.callKw('helpdesk.ticket', 'message_post', [[ticketId]], kwargs);
  }

  private async resolveUserPartnerId(userId: string): Promise<number | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.odooUserId) return null;
    const results = await this.systemRpc.callKw<Array<{ id: number; partner_id: [number, string] }>>(
      'res.users', 'read', [[user.odooUserId]], { fields: ['partner_id'] },
    );
    return results?.[0]?.partner_id?.[0] ?? null;
  }
}
