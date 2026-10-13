import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { BackupsConfigComponent } from './backups-config.component';
import { BackupsService } from '../../../features/backups/services/backups.service';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { BackupConfig } from '../../../features/backups/models/backup.models';

const veeamRow: BackupConfig = {
  provider: 'VEEAM', id: 'v1', clientId: 'c1', clientName: 'ACME',
  host: 'acme.ondravirtual.com.ar', port: 9419, isEnabled: true, lastConnectedAt: null,
};
const jetRow: BackupConfig = {
  provider: 'JETBACKUP', id: 'jc1', clientId: 'c2', clientName: 'PSQ Hosting',
  jobId: 'job-1', jobName: 'PSQ', isEnabled: true,
};

const acronisRow: BackupConfig = {
  provider: 'ACRONIS', id: 'ac1', clientId: 'c3', clientName: 'Atalaya',
  policyId: 'pol-1', policyName: 'Atalaya - 365 Mails', tenantName: 'Tenant 1', isEnabled: true,
};

describe('BackupsConfigComponent', () => {
  let fixture: ComponentFixture<BackupsConfigComponent>;
  let mockSvc: jasmine.SpyObj<BackupsService>;

  beforeEach(async () => {
    mockSvc = jasmine.createSpyObj('BackupsService', [
      'listConfigs', 'deleteConfig', 'testConnection', 'deleteJetbackupConfig', 'deleteAcronisConfig',
    ]);

    await TestBed.configureTestingModule({
      declarations: [BackupsConfigComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatIconModule, MatSnackBarModule, MatTableModule, MatProgressSpinnerModule],
      providers: [{ provide: BackupsService, useValue: mockSvc }],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupsConfigComponent);
  });

  it('debería cargar configs al init', () => {
    mockSvc.listConfigs.and.returnValue(of([]));
    fixture.detectChanges();
    expect(mockSvc.listConfigs).toHaveBeenCalled();
  });

  it('testConnection debería mostrar resultado en snackBar', () => {
    mockSvc.listConfigs.and.returnValue(of([]));
    mockSvc.testConnection.and.returnValue(of({ success: true, message: 'Conectado. 12 jobs.' }));
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const snackSpy = spyOn((comp as any).snackBar, 'open');
    comp.testConnection({ id: 'x' } as any);
    expect(snackSpy).toHaveBeenCalledWith('Conectado. 12 jobs.', 'Cerrar', jasmine.any(Object));
  });

  describe('columna Tipo', () => {
    beforeEach(() => {
      mockSvc.listConfigs.and.returnValue(of([veeamRow, jetRow]));
      fixture.detectChanges();
    });

    it('incluye la columna "provider" entre las columnas mostradas', () => {
      expect(fixture.componentInstance.displayedColumns).toContain('provider');
    });

    it('identifica cada fila como Veeam o JetBackup', () => {
      const badges = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.provider-badge'))
        .map(b => b.textContent?.trim());
      expect(badges).toEqual(['Veeam', 'JetBackup']);
    });

    it('en las filas de JetBackup muestra el nombre del job en lugar del host', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('acme.ondravirtual.com.ar');
      expect(text).toContain('PSQ');
    });

    it('solo las filas de Veeam tienen botón de probar conexión', () => {
      const buttons = fixture.nativeElement.querySelectorAll('button[aria-label="Probar conexión"]');
      expect(buttons.length).toBe(1);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      mockSvc.listConfigs.and.returnValue(of([veeamRow, jetRow]));
      mockSvc.deleteConfig.and.returnValue(of(undefined));
      mockSvc.deleteJetbackupConfig.and.returnValue(of(undefined));
      fixture.detectChanges();
    });

    it('elimina una config de Veeam con deleteConfig', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      fixture.componentInstance.delete(veeamRow);
      expect(mockSvc.deleteConfig).toHaveBeenCalledWith('v1');
      expect(mockSvc.deleteJetbackupConfig).not.toHaveBeenCalled();
    });

    it('elimina una config de JetBackup con deleteJetbackupConfig', () => {
      spyOn(window, 'confirm').and.returnValue(true);
      fixture.componentInstance.delete(jetRow);
      expect(mockSvc.deleteJetbackupConfig).toHaveBeenCalledWith('jc1');
      expect(mockSvc.deleteConfig).not.toHaveBeenCalled();
    });

    it('no elimina si el usuario cancela', () => {
      spyOn(window, 'confirm').and.returnValue(false);
      fixture.componentInstance.delete(jetRow);
      expect(mockSvc.deleteJetbackupConfig).not.toHaveBeenCalled();
    });
  });
});

describe('BackupsConfigComponent · Acronis', () => {
  let fixture: ComponentFixture<BackupsConfigComponent>;
  let mockSvc: jasmine.SpyObj<BackupsService>;

  beforeEach(async () => {
    mockSvc = jasmine.createSpyObj('BackupsService', ['listConfigs', 'deleteAcronisConfig', 'deleteConfig', 'deleteJetbackupConfig']);
    mockSvc.listConfigs.and.returnValue(of([veeamRow, acronisRow]));
    mockSvc.deleteAcronisConfig.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({
      declarations: [BackupsConfigComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatIconModule, MatSnackBarModule, MatTableModule, MatProgressSpinnerModule],
      providers: [{ provide: BackupsService, useValue: mockSvc }],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupsConfigComponent);
    fixture.detectChanges();
  });

  it('identifica las filas de Acronis con su etiqueta y clase propias', () => {
    const badges = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.provider-badge'));
    expect(badges.map(b => b.textContent?.trim())).toEqual(['Veeam', 'Acronis']);
    expect(badges[1].classList).toContain('provider-badge--acronis');
  });

  it('muestra el plan y el tenant en lugar del host, y no muestra puerto', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Atalaya - 365 Mails');
    expect(text).toContain('Tenant 1');
  });

  it('solo las filas de Veeam tienen botón de probar conexión', () => {
    expect(fixture.nativeElement.querySelectorAll('button[aria-label="Probar conexión"]').length).toBe(1);
  });

  it('elimina una config de Acronis con deleteAcronisConfig', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    fixture.componentInstance.delete(acronisRow);
    expect(mockSvc.deleteAcronisConfig).toHaveBeenCalledWith('ac1');
    expect(mockSvc.deleteConfig).not.toHaveBeenCalled();
    expect(mockSvc.deleteJetbackupConfig).not.toHaveBeenCalled();
  });
});
