// backend/src/integrations/veeam/veeam.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as https from 'https';
import type { VeeamJob, VeeamSession, VeeamApiResponse, BackupJobStatus } from './dto/veeam-api.dto';

@Injectable()
export class VeeamService {
  private readonly API_VERSION = '1.1-rev2';
  private readonly STALE_HOURS = 30;
  private readonly httpsAgent = new https.Agent({ rejectUnauthorized: false });

  constructor(private readonly httpService: HttpService) {}

  private baseUrl(host: string, port: number): string {
    return `https://${host}:${port}`;
  }

  private apiHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'x-api-version': this.API_VERSION,
      Accept: 'application/json',
    };
  }

  private async authenticate(host: string, port: number, username: string, password: string): Promise<string> {
    const url = `${this.baseUrl(host, port)}/api/oauth2/token`;
    const body = `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const res = await firstValueFrom(
      this.httpService.post<{ access_token?: string }>(url, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-api-version': this.API_VERSION,
        },
        httpsAgent: this.httpsAgent,
        timeout: 15000,
      }),
    );
    if (!res.data.access_token) throw new Error('Authentication failed');
    return res.data.access_token;
  }

  private async getJobs(baseUrl: string, token: string): Promise<VeeamJob[]> {
    const res = await firstValueFrom(
      this.httpService.get<VeeamApiResponse<VeeamJob>>(`${baseUrl}/api/v1/jobs`, {
        headers: this.apiHeaders(token),
        httpsAgent: this.httpsAgent,
        timeout: 30000,
      }),
    );
    return res.data.data ?? [];
  }

  private async getBackupSessions(baseUrl: string, token: string): Promise<VeeamSession[]> {
    const res = await firstValueFrom(
      this.httpService.get<VeeamApiResponse<VeeamSession>>(`${baseUrl}/api/v1/sessions`, {
        headers: this.apiHeaders(token),
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
    const token = await this.authenticate(host, port, username, password);
    const [jobs, sessions] = await Promise.all([
      this.getJobs(base, token),
      this.getBackupSessions(base, token),
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
      const token = await this.authenticate(host, port, username, password);
      const jobs = await this.getJobs(base, token);
      return { success: true, message: `Conectado. ${jobs.length} jobs encontrados.`, jobCount: jobs.length };
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}
