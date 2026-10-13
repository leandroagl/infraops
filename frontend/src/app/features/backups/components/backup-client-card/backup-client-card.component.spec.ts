import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupClientCardComponent } from './backup-client-card.component';
import type { BackupJobStatus, ClientBackup } from '../../models/backup.models';

const job = (overrides: Partial<BackupJobStatus> = {}): BackupJobStatus => ({
  provider: 'VEEAM',
  jobId: 'j1',
  jobName: 'Job',
  jobType: 'Backup',
  isRunning: false,
  lastResult: 'Success',
  lastMessage: null,
  lastRunAt: null,
  hoursAgo: null,
  isStale: false,
  ...overrides,
});

const client = (overrides: Partial<ClientBackup> = {}): ClientBackup => ({
  clientId: 'c1',
  clientName: 'Cliente',
  status: 'ok',
  totalJobs: 1,
  okCount: 1,
  warnCount: 0,
  critCount: 0,
  hasRunningJob: false,
  lastReadAt: '2026-10-13T12:00:00Z',
  jobs: [job()],
  ...overrides,
});

describe('BackupClientCardComponent', () => {
  let fixture: ComponentFixture<BackupClientCardComponent>;

  const render = (c: ClientBackup): HTMLElement => {
    fixture.componentInstance.client = c;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [BackupClientCardComponent] });
    fixture = TestBed.createComponent(BackupClientCardComponent);
  });

  it('muestra "N ok" cuando hay jobs con resultado exitoso', () => {
    const el = render(client());
    expect(el.querySelector('.count-chip.ok')?.textContent).toContain('1 ok');
  });

  it('no muestra "ok" y avisa "sin datos" cuando ningún job tiene resultado', () => {
    const el = render(client({
      status: 'no_data', okCount: 0, jobs: [job({ lastResult: null })],
    }));
    expect(el.querySelector('.count-chip.ok')).toBeNull();
    expect(el.querySelector('.no-data-note')?.textContent).toContain('sin datos');
  });

  it('muestra el chip JetBackup si algún job es de JetBackup', () => {
    const el = render(client({ jobs: [job({ provider: 'JETBACKUP' })] }));
    expect(el.querySelector('.provider-chip')?.textContent).toContain('JetBackup');
  });

  it('no muestra el chip JetBackup si el cliente solo tiene Veeam', () => {
    const el = render(client());
    expect(el.querySelector('.provider-chip')).toBeNull();
  });

  it('muestra el chip JetBackup una sola vez aunque haya varios jobs', () => {
    const el = render(client({
      totalJobs: 2, okCount: 2,
      jobs: [job({ provider: 'JETBACKUP', jobId: 'a' }), job({ provider: 'JETBACKUP', jobId: 'b' })],
    }));
    expect(el.querySelectorAll('.provider-chip').length).toBe(1);
  });
});
