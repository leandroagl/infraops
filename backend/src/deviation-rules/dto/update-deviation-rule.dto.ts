import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { DeviationOperator } from '../deviation-operator.enum';

export class UpdateDeviationRuleDto {
  @IsOptional()
  @IsEnum(DeviationOperator)
  operator?: DeviationOperator;

  @IsOptional()
  @IsNumber()
  thresholdNumber?: number | null;

  @IsOptional()
  @IsBoolean()
  thresholdBoolean?: boolean | null;

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
