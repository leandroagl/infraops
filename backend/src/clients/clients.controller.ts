import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientsService, ClientResponse, SyncResult } from './clients.service';

@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(): Promise<ClientResponse[]> {
    return this.clientsService.findAll();
  }

  @Post('sync')
  sync(): Promise<SyncResult> {
    return this.clientsService.syncWithInfradoc();
  }
}