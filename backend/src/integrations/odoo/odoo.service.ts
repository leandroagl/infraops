import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class OdooService {
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
        [[['is_company', '=', true], ['vat', '!=', false]]],
        { fields: ['id', 'name', 'vat'] },
      ),
      this.clientRepo.find(),
    ]);

    const clientByCuit = new Map(
      localClients
        .filter((c) => c.taxIdNumber)
        .map((c) => [c.taxIdNumber!, c]),
    );

    let matched = 0;
    const unmatched: string[] = [];

    for (const partner of odooPartners) {
      if (!partner.vat) {
        unmatched.push(typeof partner.name === 'string' ? partner.name : `id:${partner.id}`);
        continue;
      }
      const client = clientByCuit.get(partner.vat as string);
      if (client) {
        await this.clientRepo.update(client.id, {
          odooPartnerId: partner.id,
          odooSyncedAt: new Date(),
        });
        matched++;
      } else {
        unmatched.push(typeof partner.name === 'string' ? partner.name : partner.vat as string);
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

    for (const odooUser of odooUsers) {
      if (!odooUser.login) continue;
      const login = odooUser.login as string;
      const user = userByEmail.get(login);
      if (user) {
        await this.userRepo.update(user.id, {
          odooUserId: odooUser.id,
          odooSyncedAt: new Date(),
        });
        matched++;
      } else {
        unmatched.push(login);
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
      [[['vat', '=', client.taxIdNumber], ['is_company', '=', true]]],
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

  async createTicket(clientId: string, technicianId: string): Promise<number> {
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

    const odooUserId = await this.resolveUserId(technician.user.id);
    if (odooUserId === null) {
      throw new BadRequestException(`Técnico ${technicianId} no tiene ID de Odoo`);
    }

    const teamId = parseInt(
      this.configService.getOrThrow<string>('ODOO_HELPDESK_TEAM_ID'),
      10,
    );
    if (isNaN(teamId)) {
      throw new BadRequestException('ODOO_HELPDESK_TEAM_ID must be a valid integer');
    }

    return this.odooRpc.callKw<number>(
      'helpdesk.ticket',
      'create',
      [
        {
          team_id: teamId,
          partner_id: partnerId,
          user_id: odooUserId,
          name: 'Mantenimiento de infraestructura',
          description: 'Mantenimiento mensual!',
        },
      ],
      {},
    );
  }
}
