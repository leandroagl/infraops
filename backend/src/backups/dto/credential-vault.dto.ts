import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCredentialVaultEntryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CredentialVaultEntryResponseDto {
  id: string;
  name: string;
  createdAt: string;
}
