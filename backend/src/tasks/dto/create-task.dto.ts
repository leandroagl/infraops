import { IsDateString, IsEnum, IsUUID } from 'class-validator';
import { TaskType } from '../task-type.enum';

export class CreateTaskDto {
  @IsUUID()
  clientId: string;

  @IsUUID()
  technicianId: string;

  @IsEnum(TaskType)
  type: TaskType;

  @IsDateString()
  scheduledDate: string;
}