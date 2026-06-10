import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { of } from 'rxjs';
import { InfradocService } from './infradoc.service';

describe('InfradocService', () => {
  let service: InfradocService;
  let httpService: { get: jest.Mock };

  const makeRaw = (override: Record<string, unknown> = {}) => ({
    client_id: '1',
    client_name: 'ACME Corp',
    client_abbreviation: 'ACME',
    client_type: 'Empresa',
    client_website: 'acme.com',
    client_referral: null,
    client_rate: null,
    client_currency_code: null,
    client_net_terms: null,
    client_is_lead: '0',
    client_notes: null,
    client_archived_at: null,
    ...override,
  });

  const axiosRes = (data: object): AxiosResponse => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  });

  beforeEach(async () => {
    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InfradocService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<InfradocService>(InfradocService);
  });

  it('mapea los campos de InfraDoc al formato InfradocClient', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'True', count: 1, data: [makeRaw()] })),
    );

    const result = await service.getClients();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      infradocId: 1,
      name: 'ACME Corp',
      abbreviation: 'ACME',
      type: 'Empresa',
      website: 'acme.com',
      referral: null,
      rate: null,
      currencyCode: null,
      netTerms: null,
      taxIdNumber: null,
      isLead: false,
      notes: null,
      isActive: true,
    });
  });

  it('setea isActive en false cuando client_archived_at tiene fecha', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({
        success: 'True',
        count: 1,
        data: [makeRaw({ client_archived_at: '2026-01-01 00:00:00' })],
      })),
    );

    const result = await service.getClients();

    expect(result[0].isActive).toBe(false);
  });

  it('mapea client_type a taxIdNumber cuando tiene formato CUIT', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({
        success: 'True',
        count: 1,
        data: [makeRaw({ client_type: '30-50438253-9' })],
      })),
    );

    const result = await service.getClients();

    expect(result[0].taxIdNumber).toBe('30-50438253-9');
  });

  it('retorna taxIdNumber null cuando client_type no tiene formato CUIT', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({
        success: 'True',
        count: 1,
        data: [makeRaw({ client_type: 'Empresa' })],
      })),
    );

    const result = await service.getClients();

    expect(result[0].taxIdNumber).toBeNull();
  });

  it('convierte client_is_lead "1" a true', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({
        success: 'True',
        count: 1,
        data: [makeRaw({ client_is_lead: '1' })],
      })),
    );

    const result = await service.getClients();

    expect(result[0].isLead).toBe(true);
  });

  it('lanza ServiceUnavailableException cuando InfraDoc devuelve success False', async () => {
    httpService.get.mockReturnValue(
      of(axiosRes({ success: 'False', message: 'Auth failed' })),
    );

    await expect(service.getClients()).rejects.toThrow(ServiceUnavailableException);
  });

  describe('getLocations', () => {
    const makeRawLocation = (override: Record<string, unknown> = {}) => ({
      location_id: '1',
      location_client_id: '10',
      location_address: 'Av. Corrientes 1234',
      location_city: 'Buenos Aires',
      location_primary: '1',
      ...override,
    });

    it('mapea los campos de InfraDoc al formato InfradocLocation', async () => {
      httpService.get.mockReturnValue(
        of(axiosRes({ success: 'True', count: 1, data: [makeRawLocation()] })),
      );

      const result = await service.getLocations();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        infradocClientId: 10,
        address: 'Av. Corrientes 1234',
        city: 'Buenos Aires',
        isPrimary: true,
      });
    });

    it('mapea location_primary "0" a isPrimary false', async () => {
      httpService.get.mockReturnValue(
        of(axiosRes({ success: 'True', count: 1, data: [makeRawLocation({ location_primary: '0' })] })),
      );

      const result = await service.getLocations();

      expect(result[0].isPrimary).toBe(false);
    });

    it('lanza ServiceUnavailableException cuando InfraDoc devuelve success False', async () => {
      httpService.get.mockReturnValue(
        of(axiosRes({ success: 'False', message: 'Auth failed' })),
      );

      await expect(service.getLocations()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
