import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { CreateDeviationRuleDto } from './dto/create-deviation-rule.dto';
import { UpdateDeviationRuleDto } from './dto/update-deviation-rule.dto';
import { DeviationRule } from './deviation-rule.entity';
import { AvailableDeviationSignal, DeviationRulesService } from './deviation-rules.service';

@Controller('deviation-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DeviationRulesController {
  constructor(private readonly deviationRulesService: DeviationRulesService) {}

  @Get()
  findAll(): Promise<DeviationRule[]> {
    return this.deviationRulesService.findAll();
  }

  @Get('signals')
  getAvailableSignals(): AvailableDeviationSignal[] {
    return this.deviationRulesService.getAvailableSignals();
  }

  @Post()
  create(@Body() dto: CreateDeviationRuleDto): Promise<DeviationRule> {
    return this.deviationRulesService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDeviationRuleDto,
  ): Promise<DeviationRule> {
    return this.deviationRulesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.deviationRulesService.remove(id);
  }
}
