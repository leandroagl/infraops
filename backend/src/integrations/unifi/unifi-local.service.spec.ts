import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { UnifiLocalService } from './unifi-local.service';

const LOCAL_URL = 'https://192.168.1.1';
const API_KEY = 'test-api-key';
const SITES_URL = `${LOCAL_URL}/proxy/network/integration/v1/sites`;

// internalReference = shortName usado en el path de devices
const SITE_A = { id: 'uuid-site-a', internalReference: 'linkolan1', name: 'Linkolan' };
const SITE_B = { id: 'uuid-site-b', internalReference: 'covema22', name: 'Covema' };

// state: 0 = offline, 1 = online (API legacy, enteros)
const ONLINE_DEVICE = { _id: 'dev1', mac: 'aa:bb:cc:dd:ee:01', name: 'AP Sala', model: 'U6 Lite', ip: '10.0.0.2', state: 1, type: 'uap' };
const OFFLINE_DEVICE = { _id: 'dev2', mac: 'aa:bb:cc:dd:ee:02', name: 'AP Pasillo', model: 'UAP-AC-Pro', ip: '10.0.0.3', state: 0, type: 'uap' };

describe('UnifiLocalService', () => {
  let service: UnifiLocalService;
  let httpService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = { get: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        UnifiLocalService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();
    service = module.get(UnifiLocalService);
  });

  describe('findLocalSiteByName', () => {
    it('returns internalReference when name matches exactly', async () => {
      httpService.get.mockReturnValue(of({ data: { data: [SITE_A, SITE_B], totalCount: 2, count: 2, offset: 0, limit: 200 } }));
      const result = await service.findLocalSiteByName(LOCAL_URL, API_KEY, 'Linkolan');
      expect(result).toBe('linkolan1');
    });

    it('matches site name case-insensitively', async () => {
      httpService.get.mockReturnValue(of({ data: { data: [SITE_A], totalCount: 1, count: 1, offset: 0, limit: 200 } }));
      const result = await service.findLocalSiteByName(LOCAL_URL, API_KEY, 'linkolan');
      expect(result).toBe('linkolan1');
    });

    it('returns null when no site matches the name', async () => {
      httpService.get.mockReturnValue(of({ data: { data: [SITE_A, SITE_B], totalCount: 2, count: 2, offset: 0, limit: 200 } }));
      const result = await service.findLocalSiteByName(LOCAL_URL, API_KEY, 'NoExiste');
      expect(result).toBeNull();
    });

    it('returns null when sites list is empty', async () => {
      httpService.get.mockReturnValue(of({ data: { data: [], totalCount: 0, count: 0, offset: 0, limit: 200 } }));
      const result = await service.findLocalSiteByName(LOCAL_URL, API_KEY, 'Linkolan');
      expect(result).toBeNull();
    });

    it('calls the integration API sites endpoint with limit param', async () => {
      httpService.get.mockReturnValue(of({ data: { data: [], totalCount: 0, count: 0, offset: 0, limit: 200 } }));
      await service.findLocalSiteByName(LOCAL_URL, API_KEY, 'X');
      expect(httpService.get).toHaveBeenCalledWith(
        SITES_URL,
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-API-KEY': API_KEY }),
          params: { limit: '200' },
        }),
      );
    });
  });

  describe('getSiteDevices', () => {
    it('returns only offline devices (state === 0) for the given site shortName', async () => {
      httpService.get.mockReturnValue(of({
        data: { meta: { rc: 'ok' }, data: [ONLINE_DEVICE, OFFLINE_DEVICE] },
      }));
      const result = await service.getSiteDevices(LOCAL_URL, API_KEY, 'linkolan1');
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('dev2');
      expect(result[0].state).toBe(0);
    });

    it('returns empty array when all devices are online', async () => {
      httpService.get.mockReturnValue(of({
        data: { meta: { rc: 'ok' }, data: [ONLINE_DEVICE] },
      }));
      const result = await service.getSiteDevices(LOCAL_URL, API_KEY, 'linkolan1');
      expect(result).toEqual([]);
    });

    it('calls the legacy stat/device endpoint with the site shortName and API key header', async () => {
      httpService.get.mockReturnValue(of({ data: { meta: { rc: 'ok' }, data: [] } }));
      await service.getSiteDevices(LOCAL_URL, API_KEY, 'linkolan1');
      expect(httpService.get).toHaveBeenCalledWith(
        `${LOCAL_URL}/proxy/network/api/s/linkolan1/stat/device`,
        expect.objectContaining({ headers: expect.objectContaining({ 'X-API-KEY': API_KEY }) }),
      );
    });
  });
});
