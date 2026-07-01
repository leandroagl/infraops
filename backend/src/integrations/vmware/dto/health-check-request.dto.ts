import { IsNotEmpty, IsString } from 'class-validator';

export class HealthCheckRequestDto {
  @IsString()
  @IsNotEmpty()
  hostUri: string;
}
