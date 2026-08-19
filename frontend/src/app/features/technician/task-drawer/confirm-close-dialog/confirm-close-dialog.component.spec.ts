import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import {
  ConfirmCloseDialogComponent,
  ConfirmCloseDialogData,
} from './confirm-close-dialog.component';

const baseData: ConfirmCloseDialogData = {
  mode: 'DONE',
  taskType: 'SERVER_HOST_MAINTENANCE',
  config: {
    taskType: 'SERVER_HOST_MAINTENANCE',
    defaultTimeMinutes: 90,
    odooTagIds: [1],
    odooTagNames: ['Virtualización'],
    updatedAt: '2026-01-01T00:00:00Z',
  },
  odooTicketId: 1234,
  issuesSummary: { dcdiagErrors: [], veeamMissing: false, emptyFields: [] },
};

describe('ConfirmCloseDialogComponent', () => {
  let component: ConfirmCloseDialogComponent;
  let fixture: ComponentFixture<ConfirmCloseDialogComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<ConfirmCloseDialogComponent>>;

  function setup(data: ConfirmCloseDialogData): Promise<void> {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    TestBed.resetTestingModule();
    return TestBed.configureTestingModule({
      declarations: [ConfirmCloseDialogComponent],
      imports: [NoopAnimationsModule, CommonModule, MatButtonModule, MatDialogModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents().then(() => {
      fixture = TestBed.createComponent(ConfirmCloseDialogComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });
  }

  it('muestra el tiempo formateado', async () => {
    await setup(baseData);
    expect(component.formattedTime).toBe('1:30 h');
  });

  it('devuelve true al confirmar', async () => {
    await setup(baseData);
    component.confirm();
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('devuelve null al cancelar', async () => {
    await setup(baseData);
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });

  it('detecta alertas cuando hay errores DCDiag', async () => {
    await setup({ ...baseData, issuesSummary: { dcdiagErrors: ['ERROR: DNS'], veeamMissing: false, emptyFields: [] } });
    expect(component.hasAlerts).toBe(true);
  });

  it('en modo NOT_DONE no muestra tags ni ticket', async () => {
    await setup({ ...baseData, mode: 'NOT_DONE' });
    expect(component.showTags).toBe(false);
    expect(component.showTicket).toBe(false);
  });
});
