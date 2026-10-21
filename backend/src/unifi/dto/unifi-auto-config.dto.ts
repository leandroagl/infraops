import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class PatchUnifiAutoConfigDto {
  @IsOptional() @IsBoolean()   enabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true })  severities?: string[];
  @IsOptional() @IsInt()       helpdeskTeamId?: number | null;
  @IsOptional() @IsArray() @IsInt({ each: true })     tagIds?: number[];
}

export class UnifiAutoConfigResponseDto {
  enabled: boolean;
  severities: string[];
  helpdeskTeamId: number | null;
  tagIds: number[];
}
