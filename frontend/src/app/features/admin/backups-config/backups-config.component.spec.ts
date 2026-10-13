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

describe('BackupsConfigComponent', () => {
  let fixture: ComponentFixture<BackupsConfigComponent>;
  let mockSvc: jasmine.SpyObj<BackupsService>;

  beforeEach(async () => {
    mockSvc = jasmine.createSpyObj('BackupsService', ['listConfigs', 'deleteConfig', 'testConnection']);

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
});
