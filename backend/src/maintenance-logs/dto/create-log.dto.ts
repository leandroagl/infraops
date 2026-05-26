import { Type } from 'class-transformer';
import { ArrayMinSize, IsOptional, IsString, ValidateNested } from 'class-validator';
import { LogItemDto } from './log-item.dto';

export class CreateLogDto {
  @ValidateNested({ each: true })
  @Type(() => LogItemDto)
  @ArrayMinSize(1)
  payload: LogItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}