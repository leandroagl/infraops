import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { BackupClientDrawerComponent } from './backup-client-drawer.component';
import type { ClientBackup } from '../../models/backup.models';

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
});
