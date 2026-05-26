import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LogItemDto {
  @IsString()
  @IsNotEmpty()
  item: string;

  @IsIn(['ok', 'warn', 'error'])
  result: 'ok' | 'warn' | 'error';

  @IsOptional()
  @IsString()
  notes?: string;
}