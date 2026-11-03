import { IsArray, IsInt, IsString, IsUUID } from 'class-validator';

export class CreateTicketDto {
  @IsInt()
  helpdeskTeamId: number;

  @IsArray()
  @IsInt({ each: true })
  tagIds: number[];

  @IsUUID()
  clientId: string;

  @IsString()
  siteId: string;
}
