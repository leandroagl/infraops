import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Client } from './client.entity';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { InfradocService } from './infradoc/infradoc.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client]), HttpModule],
  controllers: [ClientsController],
  providers: [ClientsService, InfradocService],
  exports: [ClientsService],
})
export class ClientsModule {}