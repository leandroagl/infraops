import { extractWanIssues, UnifiInternetIssue } from './unifi-wan-issues';

const BUCKET_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// "ahora" fijo: bucket 5975917 (datos reales observados el 2026-10-23)
const NOW_INDEX = 5975917;
const NOW_MS = NOW_INDEX * BUCKET_MS;

describe('extractWanIssues', () => {
  it('devuelve [] si internetIssues es null, undefined o vacío', () => {
    expect(extractWanIssues(null, NOW_MS)).toEqual([]);
    expect(extractWanIssues(undefined, NOW_MS)).toEqual([]);
    expect(extractWanIssues([], NOW_MS)).toEqual([]);
  });

  it('wanDowntime genera wan_down con inicio y fin de la racha', () => {
    const issues: UnifiInternetIssue[] = [{ index: 5975902, count: 3, wanDowntime: true }];

    expect(extractWanIssues(issues, NOW_MS)).toEqual([
      {
        type: 'wan_down',
        startIndex: 5975902,
        lastSeen: new Date((5975902 + 3) * BUCKET_MS).toISOString(),
      },
    ]);
  });

  it('wanDowntime + wan2FailoverActive en la misma entrada genera solo wan_down', () => {
    const issues: UnifiInternetIssue[] = [
      { index: 5975902, count: 3, wanDowntime: true, wan2FailoverActive: true },
    ];

    const result = extractWanIssues(issues, NOW_MS);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('wan_down');
  });

  it('wan2FailoverActive sin wanDowntime genera wan_failover', () => {
    const issues: UnifiInternetIssue[] = [{ index: 5975905, wan2FailoverActive: true }];

    const result = extractWanIssues(issues, NOW_MS);

    expect(result).toEqual([
      {
        type: 'wan_failover',
        startIndex: 5975905,
        lastSeen: new Date((5975905 + 1) * BUCKET_MS).toISOString(),
      },
    ]);
  });

  it('una racha de caída y otra de failover producen una alerta cada una', () => {
    const issues: UnifiInternetIssue[] = [
      { index: 5975902, count: 3, wan2FailoverActive: true, wanDowntime: true },
      { index: 5975905, wan2FailoverActive: true },
    ];

    expect(extractWanIssues(issues, NOW_MS).map(i => i.type)).toEqual(['wan_down', 'wan_failover']);
  });

  it('ignora highLatency y notReported', () => {
    const issues: UnifiInternetIssue[] = [
      { index: 5975902, highLatency: true, latencyAvgMs: 157, latencyMaxMs: 1087 },
      { index: 5975904, notReported: true },
      { index: 5975905 },
    ];

    expect(extractWanIssues(issues, NOW_MS)).toEqual([]);
  });

  it('descarta rachas cuyo fin supera la antigüedad máxima (24 h por defecto)', () => {
    const issues: UnifiInternetIssue[] = [
      // terminó hace 25 h
      { index: NOW_INDEX - (25 * HOUR_MS) / BUCKET_MS - 1, count: 1, wanDowntime: true },
    ];

    expect(extractWanIssues(issues, NOW_MS)).toEqual([]);
  });

  it('conserva rachas que terminaron justo dentro de la antigüedad máxima', () => {
    const issues: UnifiInternetIssue[] = [
      // el fin de la racha cae exactamente a 24 h de "ahora"
      { index: NOW_INDEX - (24 * HOUR_MS) / BUCKET_MS - 1, count: 1, wanDowntime: true },
    ];

    expect(extractWanIssues(issues, NOW_MS)).toHaveLength(1);
  });

  it('respeta una antigüedad máxima custom', () => {
    const issues: UnifiInternetIssue[] = [{ index: NOW_INDEX - 24, wanDowntime: true }]; // ~2 h

    expect(extractWanIssues(issues, NOW_MS, HOUR_MS)).toEqual([]);
    expect(extractWanIssues(issues, NOW_MS, 3 * HOUR_MS)).toHaveLength(1);
  });

  it('ignora entradas sin index numérico (estructura defensiva)', () => {
    const issues = [
      { wanDowntime: true },
      { index: 'abc', wanDowntime: true },
      { index: 5975905, wan2FailoverActive: true },
    ] as unknown as UnifiInternetIssue[];

    const result = extractWanIssues(issues, NOW_MS);

    expect(result).toHaveLength(1);
    expect(result[0].startIndex).toBe(5975905);
  });
});
