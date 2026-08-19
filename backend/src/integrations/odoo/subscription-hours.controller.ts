import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OdooService } from './odoo.service';
import { ClientSubscriptionHoursDto } from './dto/client-subscription-hours.dto';

@Controller('clients/subscription-hours')
@UseGuards(JwtAuthGuard)
export class SubscriptionHoursController {
  constructor(private readonly odooService: OdooService) {}

  @Get()
  getAll(): Promise<ClientSubscriptionHoursDto[]> {
    return this.odooService.getClientSubscriptionHours();
  }
}
