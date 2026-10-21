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

  it('getSiteAlerts returns normalized alerts for active alerts', async () => {
    httpGet.mockReturnValue(of({
      data: {
        data: [
          { id: 'a1', type: 'gw_wan_transition', severity: 'critical', payload: { message: 'WAN down' }, siteId: 'site-1', closedAt: null, createdAt: '2024-01-01T00:00:00Z' },
          { id: 'a2', type: 'device_restart', severity: 'high', payload: {}, siteId: 'site-1', closedAt: '2024-01-01T01:00:00Z', createdAt: '2024-01-01T00:30:00Z' },
        ],
      },
    }));
    const alerts = await service.getSiteAlerts('site-1', API_KEY);
    // solo devuelve alertas sin closedAt
    expect(alerts).toHaveLength(1);
    expect(alerts[0].alertId).toBe('a1');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].message).toBe('WAN down');
  });

  it('getSiteAlerts maps unknown severity to low', async () => {
    httpGet.mockReturnValue(of({
      data: { data: [{ id: 'a3', type: 'unknown_type', severity: 'whatever', payload: {}, siteId: 's', closedAt: null, createdAt: '2024-01-01T00:00:00Z' }] },
    }));
    const [alert] = await service.getSiteAlerts('s', API_KEY);
    expect(alert.severity).toBe('low');
  });

  it('getSiteAlerts returns empty array when API returns empty data', async () => {
    httpGet.mockReturnValue(of({ data: { data: [] } }));
    const result = await service.getSiteAlerts('site-x', API_KEY);
    expect(result).toEqual([]);
  });
});
