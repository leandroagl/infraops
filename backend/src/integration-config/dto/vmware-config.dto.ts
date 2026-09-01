import { IsString, IsOptional } from 'class-validator';

export class PatchVmwareConfigDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class VmwareConfigResponseDto {
  username: string;
  password: string;
  updatedAt: Date | null;
  updatedBy: string | null;
}
