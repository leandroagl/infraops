import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { CredentialVaultService } from './credential-vault.service';
import { CreateCredentialVaultEntryDto } from './dto/credential-vault.dto';

@Controller('credential-vault')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CredentialVaultController {
  constructor(private readonly svc: CredentialVaultService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(@Body() dto: CreateCredentialVaultEntryDto) {
    return this.svc.create(dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
