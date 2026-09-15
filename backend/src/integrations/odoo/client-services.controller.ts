import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OdooService } from './odoo.service';
import { ClientActiveServicesDto } from './dto/client-active-services.dto';

@Controller('clients/services')
@UseGuards(JwtAuthGuard)
export class ClientServicesController {
  constructor(private readonly odooService: OdooService) {}

  @Get()
  getAll(): Promise<ClientActiveServicesDto[]> {
    return this.odooService.getClientActiveServices();
  }
}
