import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { TaskConfigComponent } from './task-config.component';
import { TaskConfigService } from '../../../core/services/task-config.service';
import { TaskTypeConfigDto } from '../../../core/models/task.models';

const mockConfigs: TaskTypeConfigDto[] = [
  {
    taskType: 'SERVER_HOST_MAINTENANCE',
    defaultTimeMinutes: 90,
    odooTagIds: [1],
    odooTagNames: ['Virtualización'],
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    taskType: 'WINDOWS_DOMAIN_MAINTENANCE',
    defaultTimeMinutes: null,
    odooTagIds: [],
    odooTagNames: [],
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

describe('TaskConfigComponent', () => {
  let component: TaskConfigComponent;
  let fixture: ComponentFixture<TaskConfigComponent>;
  let taskConfigService: jasmine.SpyObj<TaskConfigService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    taskConfigService = jasmine.createSpyObj('TaskConfigService', ['getAll']);
    taskConfigService.getAll.and.returnValue(of(mockConfigs));

    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      declarations: [TaskConfigComponent],
      imports: [NoopAnimationsModule, MatTableModule, MatButtonModule, MatIconModule, MatDialogModule],
      providers: [
        { provide: TaskConfigService, useValue: taskConfigService },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga configs al iniciar', () => {
    expect(taskConfigService.getAll).toHaveBeenCalledTimes(1);
    expect(component.configs).toEqual(mockConfigs);
  });

  it('actualiza el array local al recibir resultado del dialog', () => {
    const updated: TaskTypeConfigDto = { ...mockConfigs[0], defaultTimeMinutes: 120 };
    component.onConfigUpdated(updated);
    expect(component.configs[0].defaultTimeMinutes).toBe(120);
  });

  it('formatea minutos como HH:MM h', () => {
    expect(component.formatMinutes(90)).toBe('1:30 h');
    expect(component.formatMinutes(30)).toBe('0:30 h');
    expect(component.formatMinutes(null)).toBe('— sin configurar');
  });
});
