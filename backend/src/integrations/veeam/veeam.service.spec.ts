// backend/src/integrations/veeam/veeam.service.spec.ts
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

  it('debería filtrar sesiones BackupJob y no incluir ReplicaJob', async () => {
    const sessions = [
      { sessionType: 'BackupJob', jobId: 'j1', state: 'Stopped', endTime: new Date(Date.now() - 3600000).toISOString(), result: { result: 'Success', message: 'Success' } },
      { sessionType: 'ReplicaJob', jobId: 'j2', state: 'Stopped', endTime: new Date().toISOString(), result: { result: 'Success', message: '' } },
    ];
    mockHttpService.get.mockReturnValue(of(mockAxios({ data: sessions })));
    const result = await (svc as any).getBackupSessions('https://host:9419', 'tok', '1.1-rev2');
    expect(result).toHaveLength(1);
    expect(result[0].sessionType).toBe('BackupJob');
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
