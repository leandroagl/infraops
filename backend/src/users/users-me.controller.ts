import { Body, Controller, Get, HttpCode, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { UpdateOdooCredentialsDto } from './dto/update-odoo-credentials.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersMeController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() currentUser: JwtPayload): Promise<MeResponseDto> {
    return this.usersService.getMe(currentUser.sub);
  }

  @Put('me/odoo-credentials')
  @HttpCode(200)
  updateOdooCredentials(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: UpdateOdooCredentialsDto,
  ): Promise<void> {
    return this.usersService.updateOdooCredentials(currentUser.sub, dto);
  }
}
