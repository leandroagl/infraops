// backend/src/integrations/veeam/veeam.service.spec.ts
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { VeeamService } from './veeam.service';

const mockHttpService = { post: jest.fn(), get: jest.fn() };

describe('VeeamService', () => {
  let svc: VeeamService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VeeamService,
        { provide: HttpService, useValue: mockHttpService },
      ],
    }).compile();
    svc = module.get(VeeamService);
    jest.clearAllMocks();
  });

  const mockAxios = <T>(data: T): AxiosResponse<T> =>
    ({ data, status: 200, statusText: 'OK', headers: {}, config: {} as any });

  const mockAxiosError = (status: number) =>
    throwError(() => ({ response: { status, data: {} } }));

  describe('authenticate', () => {
    it('debería autenticar con primera versión candidata y devolver token y versión', async () => {
      mockHttpService.post.mockReturnValue(of(mockAxios({ access_token: 'tok123' })));
      const result = await (svc as any).authenticate('host', 9419, 'user', 'pass');
      expect(result.token).toBe('tok123');
      expect(result.version).toBe('1.1-rev2');
      expect(mockHttpService.post).toHaveBeenCalledTimes(1);
    });

    it('debería reintentar con versión anterior si recibe 400', async () => {
      mockHttpService.post
        .mockReturnValueOnce(mockAxiosError(400))
        .mockReturnValueOnce(of(mockAxios({ access_token: 'tok456' })));
      const result = await (svc as any).authenticate('host', 9419, 'user', 'pass');
      expect(result.token).toBe('tok456');
      expect(result.version).toBe('1.1-rev1');
      expect(mockHttpService.post).toHaveBeenCalledTimes(2);
    });

    it('debería lanzar error si todas las versiones fallan con 400', async () => {
      mockHttpService.post.mockReturnValue(mockAxiosError(400));
      await expect((svc as any).authenticate('host', 9419, 'user', 'pass'))
        .rejects.toThrow('No se encontró versión de API compatible');
    });

    it('debería lanzar error inmediatamente ante error no-400 sin reintentar', async () => {
      mockHttpService.post.mockReturnValue(mockAxiosError(401));
      try {
        await (svc as any).authenticate('host', 9419, 'user', 'bad');
        fail('debería haber lanzado error');
      } catch (err: any) {
        expect(err?.response?.status).toBe(401);
      }
      expect(mockHttpService.post).toHaveBeenCalledTimes(1);
    });

    it('debería lanzar Authentication failed si el servidor responde sin access_token', async () => {
      mockHttpService.post.mockReturnValue(of(mockAxios({ error: 'invalid_grant' })));
      await expect((svc as any).authenticate('host', 9419, 'user', 'bad'))
        .rejects.toThrow('Authentication failed');
    });
  });

  describe('getJobStatuses', () => {
    const job = (id: string, name: string) => ({ id, name, type: 'Backup', isDisabled: false });
    const session = (jobId: string, sessionType: string, hoursAgo = 1) => {
      const t = new Date(Date.now() - hoursAgo * 3600000).toISOString();
      return { sessionType, jobId, state: 'Stopped', creationTime: t, endTime: t, result: { result: 'Success', message: 'ok' } };
    };

    const mockVeeam = (jobs: unknown[], sessions: unknown[]) => {
      mockHttpService.post.mockReturnValue(of(mockAxios({ access_token: 'tok' })));
      mockHttpService.get.mockImplementation((url: string) =>
        of(mockAxios({ data: url.endsWith('/jobs') ? jobs : sessions })));
    };

    it('toma la sesión de un job aunque el sessionType no sea BackupJob (API 1.0 usa "Job")', async () => {
      mockVeeam([job('j1', 'DC')], [session('j1', 'Job')]);
      const [status] = await svc.getJobStatuses('host', 9419, 'u', 'p');
      expect(status.lastResult).toBe('Success');
      expect(status.hoursAgo).not.toBeNull();
    });

    it('ignora sesiones que no pertenecen a ningún job (infraestructura, retención)', async () => {
      mockVeeam(
        [job('j1', 'DC')],
        [session('infra-1', 'Infrastructure', 0.1), session('j1', 'BackupJob', 5)],
      );
      const result = await svc.getJobStatuses('host', 9419, 'u', 'p');
      expect(result).toHaveLength(1);
      expect(result[0].jobId).toBe('j1');
      expect(result[0].hoursAgo).toBeGreaterThan(4);
    });

    it('usa la sesión más reciente de cada job', async () => {
      const newest = session('j1', 'BackupJob', 1);
      const older = { ...session('j1', 'BackupJob', 30), result: { result: 'Failed', message: 'x' } };
      mockVeeam([job('j1', 'DC')], [newest, older]);
      const [status] = await svc.getJobStatuses('host', 9419, 'u', 'p');
      expect(status.lastResult).toBe('Success');
    });

    it('loguea un warn con los sessionType vistos cuando un job queda sin sesión', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      mockVeeam([job('j1', 'DC'), job('j2', 'DC2')], [session('j1', 'Job')]);
      const result = await svc.getJobStatuses('host', 9419, 'u', 'p');
      expect(result[1].lastResult).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      const msg = String(warn.mock.calls[0][0]);
      expect(msg).toContain('host:9419');
      expect(msg).toContain('DC2');
      expect(msg).toContain('Job');
      warn.mockRestore();
    });

    it('no loguea warn si todos los jobs tienen sesión', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      mockVeeam([job('j1', 'DC')], [session('j1', 'BackupJob')]);
      await svc.getJobStatuses('host', 9419, 'u', 'p');
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  it('debería marcar isStale cuando hoursAgo > 30', () => {
    const thirtyTwoHoursAgo = new Date(Date.now() - 32 * 3600000).toISOString();
    const status = (svc as any).buildJobStatus(
      { id: 'j1', name: 'DC', type: 'Backup', isDisabled: false },
      { sessionType: 'BackupJob', jobId: 'j1', state: 'Stopped', endTime: thirtyTwoHoursAgo, creationTime: thirtyTwoHoursAgo, result: { result: 'Success', message: '' } },
    );
    expect(status.isStale).toBe(true);
    expect(status.hoursAgo).toBeGreaterThan(30);
  });

  it('job sin sesiones → lastResult null, isStale false', () => {
    const status = (svc as any).buildJobStatus(
      { id: 'j1', name: 'DC', type: 'Backup', isDisabled: false },
      null,
    );
    expect(status.lastResult).toBeNull();
    expect(status.isStale).toBe(false);
    expect(status.hoursAgo).toBeNull();
  });

  it('job con endTime null (corriendo) → isRunning true, hoursAgo desde creationTime', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600000).toISOString();
    const status = (svc as any).buildJobStatus(
      { id: 'j1', name: 'DC', type: 'Backup', isDisabled: false },
      { sessionType: 'BackupJob', jobId: 'j1', state: 'Working', endTime: null, creationTime: twoHoursAgo, result: { result: 'Success', message: '' } },
    );
    expect(status.isRunning).toBe(true);
    expect(status.hoursAgo).toBeGreaterThan(1.5);
  });
});
