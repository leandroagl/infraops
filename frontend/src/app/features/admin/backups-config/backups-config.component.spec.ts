import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { BackupsConfigComponent } from './backups-config.component';
import { BackupsService } from '../../../features/backups/services/backups.service';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';

const mockSvc = { listConfigs: jest.fn(), deleteConfig: jest.fn(), testConnection: jest.fn() };

describe('BackupsConfigComponent', () => {
  let fixture: ComponentFixture<BackupsConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [BackupsConfigComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatSnackBarModule, MatTableModule],
      providers: [{ provide: BackupsService, useValue: mockSvc }],
    }).compileComponents();
    fixture = TestBed.createComponent(BackupsConfigComponent);
  });

  it('debería cargar configs al init', () => {
    mockSvc.listConfigs.mockReturnValue(of([]));
    fixture.detectChanges();
    expect(mockSvc.listConfigs).toHaveBeenCalled();
  });

  it('testConnection debería mostrar resultado en snackBar', () => {
    mockSvc.listConfigs.mockReturnValue(of([]));
    mockSvc.testConnection.mockReturnValue(of({ success: true, message: 'Conectado. 12 jobs.' }));
    fixture.detectChanges();
    const comp = fixture.componentInstance;
    const snackSpy = jest.spyOn((comp as any).snackBar, 'open');
    comp.testConnection({ id: 'x' } as any);
    expect(snackSpy).toHaveBeenCalledWith('Conectado. 12 jobs.', 'Cerrar', expect.any(Object));
  });
});
