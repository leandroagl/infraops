import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { UnifiService } from './unifi.service';

const API_KEY = 'test-api-key';

describe('UnifiService', () => {
  let service: UnifiService;
  let httpGet: jest.Mock;

  beforeEach(async () => {
    httpGet = jest.fn();
    const module = await Test.createTestingModule({
      providers: [
        UnifiService,
        { provide: HttpService, useValue: { get: httpGet } },
      ],
    }).compile();
    service = module.get(UnifiService);
  });

  const EMPTY_HOSTS = of({ data: { data: [] } });

  it('getAvailableSites maps siteId and meta.desc (display name)', async () => {
    httpGet
      .mockReturnValueOnce(of({ data: { data: [
        { siteId: 'abc123', hostId: 'h1', meta: { desc: 'Oficina Central', name: 'oficina' } },
        { siteId: 'def456', hostId: 'h2', meta: { desc: 'Sucursal Norte',  name: 'sucursal' } },
      ] } }))
      .mockReturnValueOnce(EMPTY_HOSTS);
    const result = await service.getAvailableSites(API_KEY);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ siteId: 'abc123', siteName: 'Oficina Central' });
    expect(result[1]).toEqual({ siteId: 'def456', siteName: 'Sucursal Norte' });
  });

  it('getAvailableSites uses host name for "Default" sites', async () => {
    httpGet
      .mockReturnValueOnce(of({ data: { data: [
        { siteId: 'ghi789', hostId: 'host-A', meta: { desc: 'Default', name: 'default' } },
      ] } }))
      .mockReturnValueOnce(of({ data: { data: [
        { id: 'host-A', reportedState: { name: 'AMSPEC UDM Pro' } },
      ] } }));
    const result = await service.getAvailableSites(API_KEY);
    expect(result[0]).toEqual({ siteId: 'ghi789', siteName: 'AMSPEC UDM Pro' });
  });

  it('getAvailableSites falls back to hardware.name when reportedState.name absent', async () => {
    httpGet
      .mockReturnValueOnce(of({ data: { data: [
        { siteId: 'xxx', hostId: 'host-B', meta: { desc: 'Default', name: 'default' } },
      ] } }))
      .mockReturnValueOnce(of({ data: { data: [
        { id: 'host-B', reportedState: { hardware: { name: 'UCG Ultra' } } },
      ] } }));
    const result = await service.getAvailableSites(API_KEY);
    expect(result[0]).toEqual({ siteId: 'xxx', siteName: 'UCG Ultra' });
  });

  it('getAvailableSites falls back to WAN IP when host has no name', async () => {
    httpGet
      .mockReturnValueOnce(of({ data: { data: [
        { siteId: 'jkl000', hostId: 'h4', meta: { desc: 'Default', name: 'default' },
          statistics: { ispInfo: { name: 'Telecom' }, wans: { WAN: { externalIp: '190.137.73.11' } } } },
      ] } }))
      .mockReturnValueOnce(EMPTY_HOSTS);
    const result = await service.getAvailableSites(API_KEY);
    expect(result[0]).toEqual({ siteId: 'jkl000', siteName: 'Default — 190.137.73.11 (Telecom)' });
  });

  it('getAvailableSites keeps "Default" when no host name and no WAN info', async () => {
    httpGet
      .mockReturnValueOnce(of({ data: { data: [
        { siteId: 'mno111', hostId: 'h5', meta: { desc: 'Default', name: 'default' } },
      ] } }))
      .mockReturnValueOnce(EMPTY_HOSTS);
    const result = await service.getAvailableSites(API_KEY);
    expect(result[0]).toEqual({ siteId: 'mno111', siteName: 'Default' });
  });

  it('getAvailableSites returns empty array when API returns empty data', async () => {
    httpGet.mockReturnValueOnce(of({ data: { data: [] } })).mockReturnValueOnce(EMPTY_HOSTS);
    const result = await service.getAvailableSites(API_KEY);
    expect(result).toEqual([]);
  });

  describe('getSiteHostMap', () => {
    it('returns a map of siteId to hostId', async () => {
      httpGet.mockReturnValue(of({ data: { data: [
        { siteId: 'site-1', hostId: 'host-A', meta: { desc: 'Oficina', name: 'oficina' } },
        { siteId: 'site-2', hostId: 'host-B', meta: { desc: 'Sucursal', name: 'sucursal' } },
      ] } }));
      const result = await service.getSiteHostMap(API_KEY);
      expect(result.get('site-1')).toBe('host-A');
      expect(result.get('site-2')).toBe('host-B');
    });

    it('returns empty map when API returns no sites', async () => {
      httpGet.mockReturnValue(of({ data: { data: [] } }));
      const result = await service.getSiteHostMap(API_KEY);
      expect(result.size).toBe(0);
    });
  });

  describe('getSiteInternetIssues', () => {
    it('returns a map of siteId to statistics.internetIssues', async () => {
      const issues = [{ index: 5975902, count: 3, wanDowntime: true }];
      httpGet.mockReturnValue(of({ data: { data: [
        { siteId: 'site-1', hostId: 'host-A', meta: { desc: 'Oficina', name: 'oficina' }, statistics: { internetIssues: issues } },
        { siteId: 'site-2', hostId: 'host-B', meta: { desc: 'Sucursal', name: 'sucursal' }, statistics: { internetIssues: null } },
        { siteId: 'site-3', hostId: 'host-C', meta: { desc: 'Sin stats', name: 'sinstats' } },
      ] } }));
      const result = await service.getSiteInternetIssues(API_KEY);
      expect(result.get('site-1')).toEqual(issues);
      expect(result.has('site-2')).toBe(false);
      expect(result.has('site-3')).toBe(false);
    });

    it('returns empty map when API returns no sites', async () => {
      httpGet.mockReturnValue(of({ data: { data: [] } }));
      const result = await service.getSiteInternetIssues(API_KEY);
      expect(result.size).toBe(0);
    });
  });

  describe('getAllDevices', () => {
    it('returns a map of hostId to devices and updatedAt', async () => {
      httpGet.mockReturnValue(of({ data: {
        data: [
          { hostId: 'host-A', hostName: 'UDM Pro', updatedAt: '2026-10-21T10:00:00Z', devices: [
            { id: 'AA', mac: 'AA', name: 'Router', model: 'UDM', ip: '10.0.0.1', status: 'online', version: '3.0', firmwareStatus: 'upToDate', isConsole: true, isManaged: true },
          ] },
          { hostId: 'host-B', hostName: 'UCG', updatedAt: '2026-10-20T10:00:00Z', devices: [] },
        ],
        httpStatusCode: 200,
      } }));
      const result = await service.getAllDevices(API_KEY);
      expect(result.get('host-A')?.devices).toHaveLength(1);
      expect(result.get('host-A')?.updatedAt).toBe('2026-10-21T10:00:00Z');
      expect(result.get('host-B')?.devices).toHaveLength(0);
    });

    it('returns empty map when API returns no data', async () => {
      httpGet.mockReturnValue(of({ data: { data: [], httpStatusCode: 200 } }));
      const result = await service.getAllDevices(API_KEY);
      expect(result.size).toBe(0);
    });
  });
});
