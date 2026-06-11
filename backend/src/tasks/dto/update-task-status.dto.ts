import { IsEnum, IsInt, Min, ValidateIf } from 'class-validator';
import { TaskStatus } from '../task-status.enum';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ValidateIf((o) => o.status === TaskStatus.DONE || o.status === TaskStatus.NOT_DONE)
  @IsInt()
  @Min(1)
  timeSpentMinutes?: number;
}
