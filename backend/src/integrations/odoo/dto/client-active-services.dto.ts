export class ClientServiceDto {
  name: string;
  active: boolean;
}

export class ClientActiveServicesDto {
  clientId: string;
  services: ClientServiceDto[];
}
