import { IsBoolean, IsEnum } from 'class-validator';
import { RotationFrequency } from '../rotation-config.entity';

export class SaveRotationConfigDto {
  @IsBoolean()
  isActive: boolean;

  @IsEnum(RotationFrequency)
  frequency: RotationFrequency;
}
