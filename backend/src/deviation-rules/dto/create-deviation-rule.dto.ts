import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { TaskType } from '../../tasks/task-type.enum';
import { DeviationOperator } from '../deviation-operator.enum';

export class CreateDeviationRuleDto {
  @IsEnum(TaskType)
  taskType: TaskType;

  @IsString()
  signalKey: string;

  @IsEnum(DeviationOperator)
  operator: DeviationOperator;

  @IsOptional()
  @IsNumber()
  thresholdNumber?: number;

  @IsOptional()
  @IsBoolean()
  thresholdBoolean?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  helpdeskTeamId?: number | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tagIds?: number[];
}
