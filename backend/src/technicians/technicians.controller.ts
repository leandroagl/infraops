import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import {
  TechniciansService,
  TechnicianUserResponse,
} from './technicians.service';

@Controller('technicians')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Get()
  findAll(): Promise<TechnicianUserResponse[]> {
    return this.techniciansService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  assign(@Body() dto: AssignTechnicianDto): Promise<TechnicianUserResponse> {
    return this.techniciansService.assign(dto.userId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(200)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ ok: true }> {
    await this.techniciansService.remove(id);
    return { ok: true };
  }
}
