import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTaskConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  defaultTimeMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  odooTagIds?: number[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  odooTagNames?: string[];
}
