import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class PatchOdooConfigDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  db?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  helpdeskTeamId?: number;

  @IsOptional()
  @IsString()
  stageInProgressName?: string;

  @IsOptional()
  @IsString()
  stageNotDoneName?: string;

  @IsOptional()
  @IsString()
  stageDoneName?: string;
}

export class OdooConfigResponseDto {
  url: string;
  db: string;
  username: string;
  apiKey: string;
  helpdeskTeamId: number;
  stageInProgressName: string;
  stageNotDoneName: string;
  stageDoneName: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
