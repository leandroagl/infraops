import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ClientInfrastructureDto } from './dto/client-infrastructure.dto';
import { InfrastructureService } from './infrastructure.service';

@Controller('infradoc')
@UseGuards(JwtAuthGuard)
export class InfrastructureController {
  constructor(private readonly infrastructureService: InfrastructureService) {}

  @Get('clients/:clientId/infrastructure')
  getClientInfrastructure(
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ): Promise<ClientInfrastructureDto> {
    return this.infrastructureService.getClientInfrastructure(clientId);
  }
}
