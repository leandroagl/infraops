import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
} from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsUUID()
  technicianId?: string;

  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  odooTicketId?: number;
}
