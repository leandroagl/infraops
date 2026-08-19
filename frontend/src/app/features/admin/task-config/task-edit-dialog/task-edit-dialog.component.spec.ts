import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TaskEditDialogComponent } from './task-edit-dialog.component';
import { TaskConfigService } from '../../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../../core/models/task.models';

const mockConfig: TaskTypeConfigDto = {
  taskType: 'SERVER_HOST_MAINTENANCE',
  defaultTimeMinutes: 90,
  odooTagIds: [1],
  odooTagNames: ['Virtualización'],
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('TaskEditDialogComponent', () => {
  let component: TaskEditDialogComponent;
  let fixture: ComponentFixture<TaskEditDialogComponent>;
  let service: jasmine.SpyObj<TaskConfigService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<TaskEditDialogComponent>>;

  beforeEach(async () => {
    service = jasmine.createSpyObj('TaskConfigService', ['getHelpdeskTags', 'update']);
    service.getHelpdeskTags.and.returnValue(of([{ id: 1, name: 'Virtualización' }, { id: 2, name: 'Windows Server' }]));
    service.update.and.returnValue(of({ ...mockConfig, defaultTimeMinutes: 120 }));

    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      declarations: [TaskEditDialogComponent],
      imports: [
        NoopAnimationsModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatProgressSpinnerModule,
      ],
      providers: [
        { provide: TaskConfigService, useValue: service },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { config: mockConfig } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('pre-llena el formulario con la config actual', () => {
    expect(component.form.value.time).toBe('01:30');
    expect(component.form.value.tagIds).toEqual([1]);
  });

  it('carga los tags disponibles desde Odoo al iniciar', () => {
    expect(service.getHelpdeskTags).toHaveBeenCalled();
    expect(component.availableTags.length).toBe(2);
  });

  it('convierte HH:MM a minutos correctamente al guardar', () => {
    component.form.patchValue({ time: '02:00', tagIds: [1, 2] });
    component.save();
    expect(service.update).toHaveBeenCalledWith(
      'SERVER_HOST_MAINTENANCE',
      jasmine.objectContaining({ defaultTimeMinutes: 120 })
    );
  });

  it('cierra el dialog con null al cancelar', () => {
    component.cancel();
    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });
});
