// backend/src/integrations/veeam/veeam.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import type { VeeamJob, VeeamSession, VeeamApiResponse, BackupJobStatus } from './dto/veeam-api.dto';

@Injectable()
export class VeeamService {
  private readonly VERSION_CANDIDATES = ['1.1-rev2', '1.1-rev1', '1.1-rev0', '1.0-rev1', '1.0-rev0'];
  private readonly STALE_HOURS = 30;
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });
  // cache host:port → versión que funcionó, para no renegociar en cada llamada
  private readonly versionCache = new Map<string, string>();

  constructor(private readonly httpService: HttpService) {}

  private baseUrl(host: string, port: number): string {
    return `https://${host}:${port}`;
  }

  private apiHeaders(token: string, version: string) {
    return {
      Authorization: `Bearer ${token}`,
      'x-api-version': version,
      Accept: 'application/json',
    };
  }

  private isVersionError(err: unknown): boolean {
    const axiosErr = err as { response?: { status?: number } };
    return axiosErr?.response?.status === 400;
  }

  private async tryAuthenticate(
    host: string, port: number, username: string, password: string, version: string,
  ): Promise<string> {
    const url = `${this.baseUrl(host, port)}/api/oauth2/token`;
    const body = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const res = await firstValueFrom(
      this.httpService.post<{ access_token?: string }>(url, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-version': version,
        },
        httpsAgent: this.httpsAgent,
        timeout: 15000,
      }),
    );
    if (!res.data.access_token) throw new Error('Authentication failed');
    return res.data.access_token;
  }

  private async authenticate(
    host: string, port: number, username: string, password: string,
  ): Promise<{ token: string; version: string }> {
    const cacheKey = `${host}:${port}`;
    const cached = this.versionCache.get(cacheKey);
    const candidates = cached
      ? [cached, ...this.VERSION_CANDIDATES.filter(v => v !== cached)]
      : this.VERSION_CANDIDATES;

    for (const version of candidates) {
      try {
        const token = await this.tryAuthenticate(host, port, username, password, version);
        this.versionCache.set(cacheKey, version);
        return { token, version };
      } catch (err) {
        if (this.isVersionError(err)) continue;
        throw err;
      }
    }
    throw new Error('No se encontró versión de API compatible con este servidor Veeam');
  }

  private async getJobs(baseUrl: string, token: string, version: string): Promise<VeeamJob[]> {
    const res = await firstValueFrom(
      this.httpService.get<VeeamApiResponse<VeeamJob>>(`${baseUrl}/api/v1/jobs`, {
        headers: this.apiHeaders(token, version),
        httpsAgent: this.httpsAgent,
        timeout: 30000,
      }),
    );
    return res.data.data ?? [];
  }

  private async getBackupSessions(baseUrl: string, token: string, version: string): Promise<VeeamSession[]> {
    const res = await firstValueFrom(
      this.httpService.get<VeeamApiResponse<VeeamSession>>(`${baseUrl}/api/v1/sessions`, {
        headers: this.apiHeaders(token, version),
        params: { limit: 500, orderColumn: 'CreationTime', orderAsc: false },
        httpsAgent: this.httpsAgent,
        timeout: 30000,
      }),
    );
    return (res.data.data ?? []).filter(s => s.sessionType === 'BackupJob');
  }

  private hoursAgo(isoStr: string | null): number | null {
    if (!isoStr) return null;
    return (Date.now() - new Date(isoStr).getTime()) / 3600000;
  }

  private buildJobStatus(job: VeeamJob, lastSession: VeeamSession | null): BackupJobStatus {
    if (!lastSession) {
      return {
        jobId: job.id, jobName: job.name, jobType: job.type,
        isRunning: false, lastResult: null, lastMessage: null,
        lastRunAt: null, hoursAgo: null, isStale: false,
      };
    }
    const isRunning = lastSession.state === 'Working' || lastSession.state === 'Starting';
    const refTime = lastSession.endTime ?? lastSession.creationTime;
    const hours = this.hoursAgo(refTime);
    return {
      jobId: job.id,
      jobName: job.name,
      jobType: job.type,
      isRunning,
      lastResult: lastSession.result?.result ?? null,
      lastMessage: lastSession.result?.message ?? null,
      lastRunAt: refTime,
      hoursAgo: hours !== null ? Math.round(hours * 10) / 10 : null,
      isStale: hours !== null && !isRunning && hours > this.STALE_HOURS,
    };
  }

  async getJobStatuses(
    host: string, port: number, username: string, password: string,
  ): Promise<BackupJobStatus[]> {
    const base = this.baseUrl(host, port);
    const { token, version } = await this.authenticate(host, port, username, password);
    const [jobs, sessions] = await Promise.all([
      this.getJobs(base, token, version),
      this.getBackupSessions(base, token, version),
    ]);
    const lastByJob = new Map<string, VeeamSession>();
    for (const s of sessions) {
      if (!lastByJob.has(s.jobId)) lastByJob.set(s.jobId, s);
    }
    return jobs.map(j => this.buildJobStatus(j, lastByJob.get(j.id) ?? null));
  }

  async testConnection(
    host: string, port: number, username: string, password: string,
  ): Promise<{ success: boolean; message: string; jobCount?: number }> {
    try {
      const base = this.baseUrl(host, port);
      const { token, version } = await this.authenticate(host, port, username, password);
      const jobs = await this.getJobs(base, token, version);
      return { success: true, message: `Conectado. ${jobs.length} jobs encontrados.`, jobCount: jobs.length };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}
