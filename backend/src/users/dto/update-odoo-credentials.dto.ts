import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class UpdateOdooCredentialsDto {
  @IsEmail()
  odooApiEmail: string;

  @IsString()
  @IsNotEmpty()
  odooApiKey: string;
}
