import { IsUUID } from 'class-validator';

export class AssignTechnicianDto {
  @IsUUID()
  userId: string;
}
