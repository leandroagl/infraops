export class VeeamClientConfigResponseDto {
  id: string;
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  username: string;
  isEnabled: boolean;
  lastConnectedAt: string | null;
}

export class CreateVeeamConfigDto {
  clientId: string;
  clientName: string;
  host: string;
  port: number;
  username: string;
  password: string;
  isEnabled: boolean;
}

export class UpdateVeeamConfigDto {
  clientName?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  isEnabled?: boolean;
}

export class TestConnectionResultDto {
  success: boolean;
  message: string;
  jobCount?: number;
}
