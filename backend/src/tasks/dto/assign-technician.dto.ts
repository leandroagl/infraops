import { IsUUID } from 'class-validator';

export class AssignTechnicianDto {
  @IsUUID()
  technicianId!: string;
}
