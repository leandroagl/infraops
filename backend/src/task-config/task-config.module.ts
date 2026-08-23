import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskTypeConfig } from './task-type-config.entity';
import { TaskConfigService } from './task-config.service';
import { TaskConfigController } from './task-config.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TaskTypeConfig])],
  controllers: [TaskConfigController],
  providers: [TaskConfigService],
  exports: [TaskConfigService],
})
export class TaskConfigModule {}
