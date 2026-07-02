import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { User } from '../../users/user.entity';
import { Technician } from '../../technicians/technician.entity';
import { OdooRpcService } from './odoo-rpc.service';
import { OdooPartner } from './dto/odoo-partner.dto';
import { OdooUser } from './dto/odoo-user.dto';
import { OdooSyncResult } from './dto/odoo-sync-result.dto';
import { OdooSyncStatusDto } from './dto/odoo-sync-status.dto';
import { TaskType } from '../../tasks/task-type.enum';

const CLOSING_NOTE = '<p>Ante cualquier anomalía detectada, se creará un ticket de soporte para su seguimiento y resolución.</p>';

const WINDOWS_DOMAIN_DESCRIPTION = `
<p>Control mensual preventivo sobre la infraestructura de servidores Windows.</p>
<p>Se verifican los siguientes puntos:</p>
<ul>
  <li>Estado de actualizaciones del sistema operativo (Windows Updates) en cada servidor</li>
  <li>Revisión de logs de eventos: errores y advertencias críticas</li>
  <li>Replicación de Active Directory y salud general de controladores de dominio</li>
  <li>Estado del servicio DNS: resolución, SRV records y zonas configuradas</li>
  <li>Consistencia de SYSVOL / DFSR</li>
  <li>Espacio en disco y rendimiento general del sistema</li>
</ul>
${CLOSING_NOTE}
`.trim();

const SERVER_HOST_DESCRIPTION = `
<p>Control mensual preventivo sobre los hosts de virtualización ESXi y su infraestructura asociada.</p>
<p>Se verifican los siguientes puntos:</p>
<ul>
  <li>Estado general del host: versión de ESXi, uptime y alertas de hardware</li>
  <li>Consumo de recursos: uso de CPU y memoria</li>
  <li>Estado de datastores: capacidad total, espacio libre y accesibilidad</li>
  <li>Máquinas virtuales: estado de encendido, snapshots acumulados y antigüedad, estado de VMware Tools</li>
  <li>Red: estado de vSwitches y NICs, velocidades de enlace</li>
</ul>
${CLOSING_NOTE}
`.trim();

const QNAP_DESCRIPTION = `
<p>Control mensual preventivo sobre el repositorio de backups QNAP/NAS.</p>
<p>Se verifican los siguientes puntos:</p>
<ul>
  <li>Estado de los discos físicos: cantidad instalada y detección de fallas o alertas por unidad</li>
  <li>Estado del volumen RAID: degradación, falta de sincronización o error crítico</li>
  <li>Capacidad de almacenamiento: espacio utilizado sobre el total disponible</li>
  <li>Versión de firmware del dispositivo y aplicación de actualizaciones disponibles</li>
</ul>
${CLOSING_NOTE}
`.trim();

const VEEAM_DESCRIPTION = `
<p>Control mensual preventivo sobre los trabajos de backup administrados con Veeam Backup &amp; Replication.</p>
<p>Se verifican los siguientes puntos:</p>
<ul>
  <li>Cobertura de backup por máquina virtual: job de Veeam, agente instalado o exclusión justificada</li>
  <li>Cantidad de backups completos (full) realizados en el mes por cada VM</li>
  <li>Identificación de VMs sin cobertura o con cadena de incrementales sin full base reciente</li>
</ul>
${CLOSING_NOTE}
`.trim();

const ROUTER_DESCRIPTION = `
<p>Control mensual preventivo sobre routers y firewalls de la infraestructura del cliente.</p>
<p>Se verifican los siguientes puntos:</p>
<ul>
  <li>Versión de firmware instalada y aplicación de actualizaciones disponibles</li>
  <li>Generación de backup de configuración del dispositivo</li>
</ul>
${CLOSING_NOTE}
`.trim();

const TICKET_META: Record<TaskType, { name: string; description: string }> = {
  [TaskType.SERVER_HOST_MAINTENANCE]:        { name: 'Mantenimiento de hosts VMware/BMC',             description: SERVER_HOST_DESCRIPTION },
  [TaskType.WINDOWS_DOMAIN_MAINTENANCE]:     { name: 'Mantenimiento de servidores y dominio Windows', description: WINDOWS_DOMAIN_DESCRIPTION },
  [TaskType.ROUTER_MAINTENANCE]:             { name: 'Mantenimiento de router y firewall',            description: ROUTER_DESCRIPTION },
  [TaskType.QNAP_MAINTENANCE]:               { name: 'Mantenimiento repositorio de backups QNAP/NAS', description: QNAP_DESCRIPTION },
  [TaskType.VEEAM_BACKUP]:                   { name: 'Mantenimiento de backups Veeam',                description: VEEAM_DESCRIPTION },
  [TaskType.TERMINAL_MAINTENANCE]:           { name: 'Mantenimiento de terminales',                   description: 'Mantenimiento mensual de terminales.' },
  [TaskType.SITE_VISIT]:                     { name: 'Visita técnica presencial',                     description: 'Visita técnica al cliente.' },
  [TaskType.AV_CONTROL]:                     { name: 'Control de antivirus',                          description: 'Control mensual de antivirus.' },
  [TaskType.UPS_CONTROL]:                    { name: 'Control de UPS',                                description: 'Control mensual de equipos UPS.' },
  [TaskType.ENDPOINT_INVENTORY]:             { name: 'Inventario de endpoints',                       description: 'Relevamiento de endpoints.' },
};

@Injectable()
export class OdooService {
  private doneStageId: number | null = null;
  private inProgressStageId: number | null = null;
  private qnapTagId: number | null = null;
  private windowsAdDomainTagId: number | null = null;
  private windowsServerTagId: number | null = null;
  private virtualizationTagId: number | null = null;
  private serverManagementTagId: number | null = null;

  constructor(
    private readonly odooRpc: OdooRpcService,
    private readonly configService: ConfigService,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Technician)
    private readonly technicianRepo: Repository<Technician>,
  ) {}

  async syncPartners(): Promise<OdooSyncResult> {
    const [odooPartners, localClients] = await Promise.all([
      this.odooRpc.callKw<OdooPartner[]>(
        'res.partner',
        'search_read',
        [
          [
            ['is_company', '=', true],
            ['vat', '!=', false],
            ['email', '!=', false],
          ],
        ],
        { fields: ['id', 'name', 'vat'] },
      ),
      this.clientRepo.find(),
    ]);

    const clientByCuit = new Map(
      localClients.filter((c) => c.taxIdNumber).map((c) => [c.taxIdNumber!, c]),
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
      const client = clientByCuit.get(partner.vat);
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
      this.odooRpc.callKw<OdooUser[]>(
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
      const employees = await this.odooRpc.callKw<
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

    const partners = await this.odooRpc.callKw<OdooPartner[]>(
      'res.partner',
      'search_read',
      [
        [
          ['vat', '=', client.taxIdNumber],
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

    const odooUsers = await this.odooRpc.callKw<OdooUser[]>(
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

    const employees = await this.odooRpc.callKw<Array<{ id: number }>>(
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

    const lines = await this.odooRpc.callKw<Array<{ id: number }>>(
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

  async logTimesheet(
    odooTicketId: number,
    employeeId: number,
    unitAmount: number,
  ): Promise<void> {
    await this.odooRpc.callKw<number>(
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

    const stages = await this.odooRpc.callKw<Array<{ id: number }>>(
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
    await this.odooRpc.callKw<boolean>(
      'helpdesk.ticket',
      'write',
      [[odooTicketId], { stage_id: stageId }],
      {},
    );
  }

  private async resolveQnapTagId(): Promise<number> {
    if (this.qnapTagId !== null) return this.qnapTagId;

    const tags = await this.odooRpc.callKw<Array<{ id: number }>>(
      'helpdesk.tag',
      'search_read',
      [[['name', '=', 'Backups (NAS)']]],
      { fields: ['id'], limit: 1 },
    );

    if (tags.length === 0) {
      throw new ServiceUnavailableException(
        'No se encontró el tag "Backups (NAS)" en Odoo',
      );
    }

    this.qnapTagId = tags[0].id;
    return this.qnapTagId;
  }

  private async resolveWindowsAdDomainTagId(): Promise<number> {
    if (this.windowsAdDomainTagId !== null) return this.windowsAdDomainTagId;

    const tags = await this.odooRpc.callKw<Array<{ id: number }>>(
      'helpdesk.tag',
      'search_read',
      [[['name', '=', 'Windows AD Domain']]],
      { fields: ['id'], limit: 1 },
    );

    if (tags.length === 0) {
      throw new ServiceUnavailableException(
        'No se encontró el tag "Windows AD Domain" en Odoo',
      );
    }

    this.windowsAdDomainTagId = tags[0].id;
    return this.windowsAdDomainTagId;
  }

  private async resolveWindowsServerTagId(): Promise<number> {
    if (this.windowsServerTagId !== null) return this.windowsServerTagId;

    const tags = await this.odooRpc.callKw<Array<{ id: number }>>(
      'helpdesk.tag',
      'search_read',
      [[['name', '=', 'Windows Server']]],
      { fields: ['id'], limit: 1 },
    );

    if (tags.length === 0) {
      throw new ServiceUnavailableException(
        'No se encontró el tag "Windows Server" en Odoo',
      );
    }

    this.windowsServerTagId = tags[0].id;
    return this.windowsServerTagId;
  }

  private async resolveVirtualizationTagId(): Promise<number> {
    if (this.virtualizationTagId !== null) return this.virtualizationTagId;

    const tags = await this.odooRpc.callKw<Array<{ id: number }>>(
      'helpdesk.tag',
      'search_read',
      [[['name', '=', 'Virtualización']]],
      { fields: ['id'], limit: 1 },
    );

    if (tags.length === 0) {
      throw new ServiceUnavailableException(
        'No se encontró el tag "Virtualización" en Odoo',
      );
    }

    this.virtualizationTagId = tags[0].id;
    return this.virtualizationTagId;
  }

  private async resolveServerManagementTagId(): Promise<number> {
    if (this.serverManagementTagId !== null) return this.serverManagementTagId;

    const tags = await this.odooRpc.callKw<Array<{ id: number }>>(
      'helpdesk.tag',
      'search_read',
      [[['name', '=', 'Gestión de servidores']]],
      { fields: ['id'], limit: 1 },
    );

    if (tags.length === 0) {
      throw new ServiceUnavailableException(
        'No se encontró el tag "Gestión de servidores" en Odoo',
      );
    }

    this.serverManagementTagId = tags[0].id;
    return this.serverManagementTagId;
  }

  private async resolveDoneStageId(): Promise<number> {
    if (this.doneStageId !== null) return this.doneStageId;

    const teamId = parseInt(
      this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
      10,
    );

    const stages = await this.odooRpc.callKw<Array<{ id: number }>>(
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

  async closeTicket(
    odooTicketId: number,
    employeeId: number,
    unitAmount: number,
  ): Promise<void> {
    const stageId = await this.resolveDoneStageId();
    await this.logTimesheet(odooTicketId, employeeId, unitAmount);
    await this.odooRpc.callKw<boolean>(
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

    const payload: Record<string, unknown> = {
      team_id: teamId,
      partner_id: partnerId,
      user_id: odooUserId,
      name: meta.name,
      description: meta.description,
    };
    if (saleLineId !== null) {
      payload['sale_line_id'] = saleLineId;
    }
    if (taskType === TaskType.WINDOWS_DOMAIN_MAINTENANCE) {
      const adDomainTagId = await this.resolveWindowsAdDomainTagId();
      const serverTagId = await this.resolveWindowsServerTagId();
      payload['tag_ids'] = [[6, 0, [adDomainTagId, serverTagId]]];
    }
    if (taskType === TaskType.SERVER_HOST_MAINTENANCE) {
      const virtualizationId = await this.resolveVirtualizationTagId();
      const serverMgmtId = await this.resolveServerManagementTagId();
      payload['tag_ids'] = [[6, 0, [virtualizationId, serverMgmtId]]];
    }
    if (taskType === TaskType.QNAP_MAINTENANCE) {
      const tagId = await this.resolveQnapTagId();
      payload['tag_ids'] = [[6, 0, [tagId]]];
    }
    if (taskType === TaskType.VEEAM_BACKUP) {
      const tagId = await this.resolveQnapTagId();
      payload['tag_ids'] = [[6, 0, [tagId]]];
    }

    const ticketId = await this.odooRpc.callKw<number>(
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

  async postInternalNote(ticketId: number, note: string): Promise<void> {
    await this.odooRpc.callKw(
      'helpdesk.ticket',
      'message_post',
      [[ticketId]],
      {
        body: note,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_note',
      },
    );
  }
}
