import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OdooService } from './odoo.service';
import { ClientSubscriptionHoursDto } from './dto/client-subscription-hours.dto';
import { SubscriptionHoursQueryDto } from './dto/subscription-hours-query.dto';

@Controller('clients/subscription-hours')
@UseGuards(JwtAuthGuard)
export class SubscriptionHoursController {
  constructor(private readonly odooService: OdooService) {}

  @Get()
  getAll(@Query() query: SubscriptionHoursQueryDto): Promise<ClientSubscriptionHoursDto[]> {
    return this.odooService.getClientSubscriptionHours(query.month, query.year);
  }
}
