import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { BackupClientDrawerComponent } from './backup-client-drawer.component';
import type { ClientBackup, BackupJobStatus, BackupJobResult } from '../../models/backup.models';

const baseClient: ClientBackup = {
  clientId: 'c1', clientName: 'Cliente Test', status: 'ok',
  totalJobs: 2, okCount: 2, warnCount: 0, critCount: 0,
  hasRunningJob: false, lastReadAt: '2026-10-12T10:00:00Z', jobs: [],
};

describe('BackupClientDrawerComponent', () => {
  let fixture: ComponentFixture<BackupClientDrawerComponent>;
  let comp: BackupClientDrawerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BackupClientDrawerComponent],
      imports: [
        NoopAnimationsModule,
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTableModule,
        MatTooltipModule,
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupClientDrawerComponent);
    comp = fixture.componentInstance;
  });

  it('botón refresh emite refreshRequest con el clientId', () => {
    comp.client = { ...baseClient };
    comp.open = true;
    comp.refreshing = false;
    const emitted: string[] = [];
    comp.refreshRequest.subscribe(id => emitted.push(id));
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.d-refresh') as HTMLButtonElement;
    btn.click();
    expect(emitted).toEqual(['c1']);
  });

  it('botón refresh está deshabilitado cuando refreshing es true', () => {
    comp.client = { ...baseClient };
    comp.open = true;
    comp.refreshing = true;
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.d-refresh') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('muestra texto "último snapshot" cuando isSnapshot es true', () => {
    comp.client = { ...baseClient, isSnapshot: true, lastReadAt: '2026-10-12' };
    comp.open = true;
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('último snapshot');
  });

  it('muestra "lectura en vivo" cuando isSnapshot es false', () => {
    comp.client = { ...baseClient, isSnapshot: false };
    comp.open = true;
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('lectura en vivo');
  });

  describe('expandir error de job', () => {
    const mkJob = (jobId: string, lastResult: BackupJobResult | null, lastMessage: string | null): BackupJobStatus => ({
      jobId, jobName: `job-${jobId}`, jobType: 'Backup', isRunning: false,
      lastResult, lastMessage, lastRunAt: null, hoursAgo: 1, isStale: false,
    });
    const longMsg = 'Error: línea 1\nlínea 2\nlínea 3\nlínea 4';

    const render = (jobs: BackupJobStatus[]) => {
      comp.client = { ...baseClient, jobs };
      comp.open = true;
      fixture.detectChanges();
    };
    const rows = () => fixture.nativeElement.querySelectorAll('tr.mat-mdc-row, tr.mat-row') as NodeListOf<HTMLElement>;
    const detail = () => fixture.nativeElement.querySelector('.job-msg-full') as HTMLElement | null;

    it('click en job Failed muestra el mensaje completo', () => {
      render([mkJob('1', 'Failed', longMsg)]);
      expect(detail()).toBeNull();
      rows()[0].click();
      fixture.detectChanges();
      expect(detail()?.textContent).toContain('línea 4');
    });

    it('click en job Warning muestra el mensaje completo', () => {
      render([mkJob('1', 'Warning', longMsg)]);
      rows()[0].click();
      fixture.detectChanges();
      expect(detail()?.textContent).toContain('línea 4');
    });

    it('segundo click colapsa el mensaje', () => {
      render([mkJob('1', 'Failed', longMsg)]);
      rows()[0].click();
      fixture.detectChanges();
      rows()[0].click();
      fixture.detectChanges();
      expect(detail()).toBeNull();
    });

    it('click en job Success no expande nada', () => {
      render([mkJob('1', 'Success', 'ok')]);
      rows()[0].click();
      fixture.detectChanges();
      expect(detail()).toBeNull();
    });

    it('click en job sin mensaje no expande nada', () => {
      render([mkJob('1', 'Failed', null)]);
      rows()[0].click();
      fixture.detectChanges();
      expect(detail()).toBeNull();
    });

    it('expandir otro job colapsa el anterior', () => {
      render([mkJob('1', 'Failed', 'msg-uno'), mkJob('2', 'Warning', 'msg-dos')]);
      rows()[0].click();
      fixture.detectChanges();
      rows()[1].click();
      fixture.detectChanges();
      const open = fixture.nativeElement.querySelectorAll('.job-msg-full');
      expect(open.length).toBe(1);
      expect(open[0].textContent).toContain('msg-dos');
    });
  });
});
