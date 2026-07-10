import { IsBoolean } from 'class-validator';

export class UpdateOdooExemptDto {
  @IsBoolean()
  odooExempt: boolean;
}
