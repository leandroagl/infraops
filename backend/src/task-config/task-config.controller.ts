import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';
import { TaskType } from '../tasks/task-type.enum';
import { TaskConfigService } from './task-config.service';
import { TaskTypeConfig } from './task-type-config.entity';
import { UpdateTaskConfigDto } from './dto/update-task-config.dto';

const VALID_TASK_TYPES = new Set<string>(Object.values(TaskType));

@Controller('task-config')
@UseGuards(JwtAuthGuard)
export class TaskConfigController {
  constructor(private readonly taskConfigService: TaskConfigService) {}

  @Get()
  findAll(): Promise<TaskTypeConfig[]> {
    return this.taskConfigService.findAll();
  }

  @Patch(':taskType')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('taskType') taskType: string,
    @Body() dto: UpdateTaskConfigDto,
  ): Promise<TaskTypeConfig> {
    if (!VALID_TASK_TYPES.has(taskType)) {
      throw new BadRequestException(`Tipo de tarea inválido: ${taskType}`);
    }
    return this.taskConfigService.upsert(taskType as TaskType, dto);
  }
}
