import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HealthCheckRequestDto } from './dto/health-check-request.dto';
import { VmwareHealthResult } from './dto/vmware-health-result.dto';
import { VmwareService } from './vmware.service';

@Controller('integrations/vmware')
@UseGuards(JwtAuthGuard)
export class VmwareController {
  constructor(private readonly vmwareService: VmwareService) {}

  @Post('health-check')
  healthCheck(@Body() dto: HealthCheckRequestDto): Promise<VmwareHealthResult> {
    return this.vmwareService.runHealthCheck(dto.hostUri);
  }
}
