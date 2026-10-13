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

  describe('columna Tipo (proveedor)', () => {
    const mkJob = (provider: BackupJobStatus['provider']): BackupJobStatus => ({
      provider, jobId: provider, jobName: `job-${provider}`, jobType: 'Backup', isRunning: false,
      lastResult: 'Success', lastMessage: null, lastRunAt: null, hoursAgo: 1, isStale: false,
    });

    it('muestra el proveedor de cada job en la columna Tipo', () => {
      comp.client = { ...baseClient, jobs: [mkJob('VEEAM'), mkJob('ACRONIS'), mkJob('JETBACKUP')] };
      comp.open = true;
      fixture.detectChanges();
      const chips = Array.from(fixture.nativeElement.querySelectorAll('.provider-chip') as NodeListOf<HTMLElement>)
        .map(e => e.textContent?.trim());
      expect(chips).toEqual(['Veeam', 'Acronis', 'JetBackup']);
    });

    it('no repite el jobType debajo del nombre del job', () => {
      comp.client = { ...baseClient, jobs: [mkJob('VEEAM')] };
      comp.open = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.job-type')).toBeNull();
    });
  });

  describe('expandir error de job', () => {
    const mkJob = (jobId: string, lastResult: BackupJobResult | null, lastMessage: string | null): BackupJobStatus => ({
      provider: 'VEEAM', jobId, jobName: `job-${jobId}`, jobType: 'Backup', isRunning: false,
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

describe('BackupClientDrawerComponent · detalle por recurso (Acronis)', () => {
  let fixture: ComponentFixture<BackupClientDrawerComponent>;
  let comp: BackupClientDrawerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BackupClientDrawerComponent],
      imports: [NoopAnimationsModule, CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTableModule, MatTooltipModule],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupClientDrawerComponent);
    comp = fixture.componentInstance;
  });

  const acronisJob = (over: Partial<BackupJobStatus> = {}): BackupJobStatus => ({
    provider: 'ACRONIS', jobId: 'pol-1', jobName: 'Plan Demo', jobType: 'Acronis', isRunning: false,
    lastResult: 'Success', lastMessage: null, lastRunAt: null, hoursAgo: 2, isStale: false, ...over,
  });
  const item = (name: string, result: BackupJobResult, lastCode: string, hoursSinceOk: number) => ({
    itemId: name, name, type: 'machine', result, hoursSinceOk, lastCode, lastRunAt: null,
  });
  const render = (jobs: BackupJobStatus[]) => {
    comp.client = { ...baseClient, jobs };
    comp.open = true;
    fixture.detectChanges();
  };
  const rows = () => fixture.nativeElement.querySelectorAll('tr.mat-mdc-row, tr.mat-row') as NodeListOf<HTMLElement>;
  const q = (sel: string) => fixture.nativeElement.querySelectorAll(sel) as NodeListOf<HTMLElement>;

  it('un plan ok con items se puede expandir y lista cada recurso', () => {
    render([acronisJob({ items: [item('VM-01', 'Success', 'ok', 2), item('VM-02', 'Warning', 'warning', 3)] })]);
    expect(q('.job-item').length).toBe(0);
    rows()[0].click();
    fixture.detectChanges();
    expect(Array.from(q('.job-item-name')).map(e => e.textContent?.trim())).toEqual(['VM-01', 'VM-02']);
    expect(q('.job-msg-full').length).toBe(0);
  });

  it('un recurso con fallo duro muestra el código en vez de la antigüedad centinela', () => {
    render([acronisJob({ lastResult: 'Failed', items: [item('VM-03', 'Failed', 'error', 49), item('VM-04', 'Success', 'ok', 5.5)] })]);
    rows()[0].click();
    fixture.detectChanges();
    const meta = Array.from(q('.job-item-meta')).map(e => e.textContent?.trim());
    expect(meta).toEqual(['error', '5.5h']);
  });

  it('muestra el agregado M365 con conteos y los peores nombres', () => {
    render([acronisJob({
      lastResult: 'Failed', lastMessage: '1 de 3 recurso(s) con problema: Buzón 3',
      aggregate: { total: 3, okCount: 2, warnCount: 0, critCount: 1, worst: ['Buzón 3'] },
    })]);
    rows()[0].click();
    fixture.detectChanges();
    const text = (q('.job-agg')[0].textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('3 recursos');
    expect(text).toContain('2 ok');
    expect(text).toContain('1 fail');
    expect(text).toContain('Buzón 3');
  });

  it('un job sin detalle ni mensaje sigue sin expandirse', () => {
    render([acronisJob()]);
    rows()[0].click();
    fixture.detectChanges();
    expect(q('.job-detail').length).toBe(0);
  });
});
