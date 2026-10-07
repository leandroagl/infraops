// backend/src/integrations/veeam/veeam.service.spec.ts
import { Test } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
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

  it('debería autenticar y devolver token', async () => {
    mockHttpService.post.mockReturnValue(of(mockAxios({ access_token: 'tok123' })));
    const token = await (svc as any).authenticate('host', 9419, 'user', 'pass');
    expect(token).toBe('tok123');
    expect(mockHttpService.post).toHaveBeenCalledWith(
      'https://host:9419/api/oauth2/token',
      'grant_type=password&username=user&password=pass',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }) }),
    );
  });

  it('debería lanzar error si auth falla', async () => {
    mockHttpService.post.mockReturnValue(of(mockAxios({ error: 'invalid_grant' })));
    await expect((svc as any).authenticate('host', 9419, 'user', 'bad')).rejects.toThrow('Authentication failed');
  });

  it('debería filtrar sesiones BackupJob y no incluir ReplicaJob', async () => {
    const sessions = [
      { sessionType: 'BackupJob', jobId: 'j1', state: 'Stopped', endTime: new Date(Date.now() - 3600000).toISOString(), result: { result: 'Success', message: 'Success' } },
      { sessionType: 'ReplicaJob', jobId: 'j2', state: 'Stopped', endTime: new Date().toISOString(), result: { result: 'Success', message: '' } },
    ];
    mockHttpService.get.mockReturnValue(of(mockAxios({ data: sessions })));
    const result = await (svc as any).getBackupSessions('https://host:9419', 'tok');
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
