import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatchOdooConfigDto } from './odoo-config.dto';

describe('PatchOdooConfigDto — expirationsTypeConfigs', () => {
  // Mismo payload que manda el frontend: un diccionario por ExpirationType,
  // no un único objeto — reproduce el bug real reportado en consola del navegador.
  const validPayload = {
    expirationsTypeConfigs: {
      asset_warranty: { enabled: true,  helpdeskTeamId: null, daysAhead: 30, tagIds: [] },
      certificate:    { enabled: true,  helpdeskTeamId: 9,    daysAhead: 15, tagIds: [3, 4] },
      domain:         { enabled: false, helpdeskTeamId: null, daysAhead: 30, tagIds: [] },
      software:       { enabled: true,  helpdeskTeamId: null, daysAhead: 45, tagIds: [] },
    },
  };

  it('no rechaza un diccionario por tipo con las 4 claves de ExpirationType', async () => {
    const dto = plainToInstance(PatchOdooConfigDto, validPayload);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });

  it('preserva el valor recibido tal cual (no lo colapsa a una sola instancia)', () => {
    const dto = plainToInstance(PatchOdooConfigDto, validPayload);
    expect(dto.expirationsTypeConfigs).toEqual(validPayload.expirationsTypeConfigs);
  });

  it('acepta expirationsTypeConfigs ausente (campo opcional)', async () => {
    const dto = plainToInstance(PatchOdooConfigDto, {});
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors).toHaveLength(0);
  });
});
