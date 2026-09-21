import { IsObject } from 'class-validator';
import { ExpirationTypeConfigEntryDto } from '../../integration-config/dto/odoo-config.dto';

export class PatchExpirationTypeConfigsDto {
  // Diccionario por ExpirationType — la validación profunda de cada entrada
  // se hace en IntegrationConfigService.patchOdoo() (ver comentario en
  // odoo-config.dto.ts sobre por qué no se valida acá con decorators).
  @IsObject()
  expirationsTypeConfigs: Record<string, ExpirationTypeConfigEntryDto>;
}
