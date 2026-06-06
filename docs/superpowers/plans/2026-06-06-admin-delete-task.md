# Admin: Eliminar Tareas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar la capacidad de eliminar tareas desde la vista admin, con menú de 3 puntos por fila, diálogo de confirmación y cascade en el log asociado.

**Architecture:** Backend añade `DELETE /tasks/:id` (ADMIN only) que elimina el `MaintenanceLog` asociado antes de borrar la tarea. Frontend crea `ConfirmDialogComponent` reutilizable en `shared/`, agrega columna `actions` con `mat-menu` en la tabla de tareas, y actualiza el array local sin recargar.

**Tech Stack:** NestJS · TypeORM · Angular 19 · Angular Material (MatMenu, MatDialog, MatSnackBar) · Jest (backend) · Jasmine/Karma (frontend)

**Spec:** `docs/superpowers/specs/2026-06-06-admin-delete-task-design.md`

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/src/tasks/tasks.module.ts` | Modificar — agregar `MaintenanceLog` a `forFeature` |
| `backend/src/tasks/tasks.service.ts` | Modificar — inyectar `logRepository`, agregar `remove()` |
| `backend/src/tasks/tasks.service.spec.ts` | Modificar — agregar mock de `logRepository`, tests de `remove()` |
| `backend/src/tasks/tasks.controller.ts` | Modificar — agregar `DELETE /tasks/:id` |
| `backend/src/tasks/tasks.controller.spec.ts` | Modificar — agregar test de `remove` |
| `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts` | Crear |
| `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.html` | Crear |
| `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.spec.ts` | Crear |
| `frontend/src/app/shared/shared.module.ts` | Modificar — declarar/exportar `ConfirmDialogComponent` |
| `frontend/src/app/core/services/tasks.service.ts` | Modificar — agregar `delete()` |
| `frontend/src/app/features/admin/tasks/tasks.component.ts` | Modificar — `deleteTask()`, `displayedColumns`, inyectar `MatSnackBar` |
| `frontend/src/app/features/admin/tasks/tasks.component.html` | Modificar — columna `actions` con `mat-menu` |
| `frontend/src/app/features/admin/tasks/tasks.component.spec.ts` | Modificar — tests de `deleteTask()` |

---

## Task 1: Backend — `remove()` en `TasksService`

**Files:**
- Modify: `backend/src/tasks/tasks.module.ts`
- Modify: `backend/src/tasks/tasks.service.ts`
- Modify: `backend/src/tasks/tasks.service.spec.ts`

- [ ] **Step 1: Agregar `MaintenanceLog` a `forFeature` en `tasks.module.ts`**

Reemplazar las líneas `imports` del módulo:

```typescript
// backend/src/tasks/tasks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ClientsModule } from '../clients/clients.module';
import { TechniciansModule } from '../technicians/technicians.module';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, MaintenanceLog]),
    ClientsModule,
    TechniciansModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, JwtAuthGuard, RolesGuard],
  exports: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 2: Escribir los tests para `remove()` en `tasks.service.spec.ts`**

Agregar el mock de `logRepository` al bloque `beforeEach` existente y añadir el bloque `describe('remove', ...)` al final del archivo, antes del cierre `});` del `describe('TasksService', ...)`.

Cambios en el bloque de declaraciones y `beforeEach`:

```typescript
// Agregar después de "let technicianRepository":
let logRepository: { delete: jest.Mock };
```

En el `beforeEach`, agregar la inicialización del mock:

```typescript
logRepository = { delete: jest.fn() };
```

En el `beforeEach`, agregar el provider al `Test.createTestingModule`:

```typescript
{ provide: getRepositoryToken(MaintenanceLog), useValue: logRepository },
```

Agregar el import al principio del spec:

```typescript
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
```

Y agregar también `delete: jest.Mock` al tipo de `taskRepository`:

```typescript
let taskRepository: {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};
```

Con `delete: jest.fn()` en la inicialización del mock de `taskRepository`.

Agregar el bloque `describe('remove')` antes del cierre del describe principal:

```typescript
describe('remove', () => {
  it('elimina el log asociado y la tarea cuando la tarea existe', async () => {
    taskRepository.findOne.mockResolvedValue(mockTask);
    logRepository.delete.mockResolvedValue({ affected: 1 });
    taskRepository.delete.mockResolvedValue({ affected: 1 });

    await service.remove('task-1');

    expect(taskRepository.findOne).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    expect(logRepository.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(taskRepository.delete).toHaveBeenCalledWith('task-1');
  });

  it('elimina la tarea aunque no haya log asociado (delete es no-op)', async () => {
    taskRepository.findOne.mockResolvedValue(mockTask);
    logRepository.delete.mockResolvedValue({ affected: 0 });
    taskRepository.delete.mockResolvedValue({ affected: 1 });

    await service.remove('task-1');

    expect(logRepository.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
    expect(taskRepository.delete).toHaveBeenCalledWith('task-1');
  });

  it('lanza NotFoundException si la tarea no existe', async () => {
    taskRepository.findOne.mockResolvedValue(null);

    await expect(service.remove('nonexistent')).rejects.toThrow('Tarea no encontrada');

    expect(logRepository.delete).not.toHaveBeenCalled();
    expect(taskRepository.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Correr los tests y verificar que fallan**

```bash
cd backend && npx jest tasks/tasks.service.spec.ts --no-coverage
```

Esperado: FAIL — `service.remove is not a function`

- [ ] **Step 4: Implementar `remove()` en `tasks.service.ts`**

Agregar la inyección de `logRepository` al constructor y el nuevo método. El archivo completo queda:

```typescript
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { Technician } from '../technicians/technician.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from './task-status.enum';
import { Task } from './task.entity';

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.IN_PROGRESS, TaskStatus.NOT_DONE],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.ESCALATED, TaskStatus.NOT_DONE],
  [TaskStatus.DONE]: [],
  [TaskStatus.ESCALATED]: [],
  [TaskStatus.NOT_DONE]: [],
};

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(MaintenanceLog)
    private readonly logRepository: Repository<MaintenanceLog>,
  ) {}

  async findAll(filters: FilterTasksDto): Promise<Task[]> {
    const where: Record<string, unknown> = {};
    if (filters.status)      where['status']      = filters.status;
    if (filters.clientId)    where['clientId']    = filters.clientId;
    if (filters.technicianId) where['technicianId'] = filters.technicianId;
    if (filters.type)        where['type']        = filters.type;

    return this.taskRepository.find({
      where,
      relations: ['client', 'technician', 'technician.user'],
      order: { scheduledDate: 'ASC' },
    });
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    const client = await this.clientRepository.findOne({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const technician = await this.technicianRepository.findOne({ where: { id: dto.technicianId } });
    if (!technician) throw new NotFoundException('Técnico no encontrado');

    const task = this.taskRepository.create({
      clientId: dto.clientId,
      technicianId: dto.technicianId,
      type: dto.type,
      scheduledDate: dto.scheduledDate,
    });
    const saved = await this.taskRepository.save(task);
    return this.loadTask(saved.id);
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Se debe proveer al menos un campo para actualizar');
    }

    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    if (dto.technicianId !== undefined) {
      const technician = await this.technicianRepository.findOne({
        where: { id: dto.technicianId },
      });
      if (!technician) throw new NotFoundException('Técnico no encontrado');
    }

    const updates: Partial<Task> = {};
    if (dto.technicianId !== undefined) updates.technicianId = dto.technicianId;
    if (dto.scheduledDate !== undefined) updates.scheduledDate = dto.scheduledDate;
    if (dto.odooTicketId !== undefined) updates.odooTicketId = dto.odooTicketId;

    await this.taskRepository.update(id, updates);
    return this.loadTask(id);
  }

  async updateStatus(id: string, newStatus: TaskStatus): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const allowed = VALID_TRANSITIONS[task.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transición inválida: ${task.status} → ${newStatus}`,
      );
    }

    const isTerminal = VALID_TRANSITIONS[newStatus].length === 0;
    const completedDate = isTerminal ? new Date() : null;
    await this.taskRepository.update(id, { status: newStatus, completedDate });
    return this.loadTask(id);
  }

  async remove(id: string): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    await this.logRepository.delete({ taskId: id });
    await this.taskRepository.delete(id);
  }

  private async loadTask(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['client', 'technician', 'technician.user'],
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
cd backend && npx jest tasks/tasks.service.spec.ts --no-coverage
```

Esperado: PASS — todos los tests del archivo pasan.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/tasks.module.ts backend/src/tasks/tasks.service.ts backend/src/tasks/tasks.service.spec.ts
git commit -m "feat(tasks): agregar remove() con cascade de maintenance log"
```

---

## Task 2: Backend — `DELETE /tasks/:id` en `TasksController`

**Files:**
- Modify: `backend/src/tasks/tasks.controller.ts`
- Modify: `backend/src/tasks/tasks.controller.spec.ts`

- [ ] **Step 1: Escribir el test para `remove` en `tasks.controller.spec.ts`**

Agregar `remove: jest.Mock` al tipo y mock de `tasksService`:

```typescript
let tasksService: {
  findAll: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateStatus: jest.Mock;
  remove: jest.Mock;
};
```

Y en el `beforeEach`:
```typescript
tasksService = {
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateStatus: jest.fn(),
  remove: jest.fn(),
};
```

Agregar el bloque `describe('remove')` antes del cierre del describe principal:

```typescript
describe('remove', () => {
  it('llama a tasksService.remove con el id y devuelve undefined', async () => {
    tasksService.remove.mockResolvedValue(undefined);

    const result = await controller.remove('task-1');

    expect(tasksService.remove).toHaveBeenCalledWith('task-1');
    expect(result).toBeUndefined();
  });

  it('propaga NotFoundException si la tarea no existe', async () => {
    tasksService.remove.mockRejectedValue(new NotFoundException());

    await expect(controller.remove('nonexistent')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd backend && npx jest tasks/tasks.controller.spec.ts --no-coverage
```

Esperado: FAIL — `controller.remove is not a function`

- [ ] **Step 3: Agregar el endpoint `DELETE /tasks/:id` al controller**

Agregar los imports `Delete` y `HttpCode` a la línea de imports de `@nestjs/common`, y el método al controller:

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
```

Agregar al final de la clase `TasksController`, después de `updateStatus`:

```typescript
@Delete(':id')
@Roles(UserRole.ADMIN)
@HttpCode(204)
async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
  return this.tasksService.remove(id);
}
```

- [ ] **Step 4: Correr y verificar que pasan**

```bash
cd backend && npx jest tasks/tasks.controller.spec.ts --no-coverage
```

Esperado: PASS.

- [ ] **Step 5: Correr todos los tests del backend**

```bash
cd backend && npx jest --no-coverage
```

Esperado: PASS — sin regresiones.

- [ ] **Step 6: Commit**

```bash
git add backend/src/tasks/tasks.controller.ts backend/src/tasks/tasks.controller.spec.ts
git commit -m "feat(tasks): agregar DELETE /tasks/:id solo para ADMIN"
```

---

## Task 3: Frontend — `ConfirmDialogComponent` en `shared/`

**Files:**
- Create: `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts`
- Create: `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.html`
- Create: `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.spec.ts`
- Modify: `frontend/src/app/shared/shared.module.ts`

- [ ] **Step 1: Escribir el spec del componente**

Crear `frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

const dialogData: ConfirmDialogData = {
  title: 'Eliminar tarea',
  message: '¿Seguro que deseas eliminar esto?',
};

describe('ConfirmDialogComponent', () => {
  let component: ConfirmDialogComponent;
  let fixture: ComponentFixture<ConfirmDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConfirmDialogComponent],
      imports: [NoopAnimationsModule, MatDialogModule, MatButtonModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('muestra el título y el mensaje recibidos vía MAT_DIALOG_DATA', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Eliminar tarea');
    expect(compiled.textContent).toContain('¿Seguro que deseas eliminar esto?');
  });

  it('expone data con title y message', () => {
    expect(component.data.title).toBe('Eliminar tarea');
    expect(component.data.message).toBe('¿Seguro que deseas eliminar esto?');
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
cd frontend && npx ng test --include='src/app/shared/components/confirm-dialog/confirm-dialog.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — `ConfirmDialogComponent` no existe.

- [ ] **Step 3: Crear `confirm-dialog.component.ts`**

```typescript
// frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
}

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData) {}
}
```

- [ ] **Step 4: Crear `confirm-dialog.component.html`**

```html
<!-- frontend/src/app/shared/components/confirm-dialog/confirm-dialog.component.html -->
<h2 mat-dialog-title>{{ data.title }}</h2>
<mat-dialog-content>
  <p>{{ data.message }}</p>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-stroked-button mat-dialog-close>Cancelar</button>
  <button mat-flat-button color="warn" [mat-dialog-close]="true">Eliminar</button>
</mat-dialog-actions>
```

- [ ] **Step 5: Actualizar `shared.module.ts`**

```typescript
// frontend/src/app/shared/shared.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { LocalDatePipe } from './pipes/local-date.pipe';

@NgModule({
  declarations: [LocalDatePipe, ConfirmDialogComponent],
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  exports: [LocalDatePipe, ConfirmDialogComponent],
})
export class SharedModule {}
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

```bash
cd frontend && npx ng test --include='src/app/shared/components/confirm-dialog/confirm-dialog.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shared/components/confirm-dialog/ frontend/src/app/shared/shared.module.ts
git commit -m "feat(shared): agregar ConfirmDialogComponent reutilizable"
```

---

## Task 4: Frontend — `delete()` en `TasksService`

**Files:**
- Modify: `frontend/src/app/core/services/tasks.service.ts`

- [ ] **Step 1: Agregar el método `delete()` al servicio**

Agregar al final de la clase `TasksService` en `frontend/src/app/core/services/tasks.service.ts`:

```typescript
delete(id: string): Observable<void> {
  return this.http.delete<void>(`${this.base}/${id}`);
}
```

El archivo completo queda:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Task, UpdateTaskStatusPayload } from '../models/task.models';

export interface TaskFilters {
  status?: string;
  clientId?: string;
  technicianId?: string;
  type?: string;
}

export interface CreateTaskPayload {
  clientId: string;
  technicianId: string;
  type: string;
  scheduledDate: string;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly base = `${environment.apiUrl}/tasks`;

  constructor(private http: HttpClient) {}

  getAll(filters: TaskFilters = {}): Observable<Task[]> {
    let params = new HttpParams();
    if (filters.status)      params = params.set('status',      filters.status);
    if (filters.clientId)    params = params.set('clientId',    filters.clientId);
    if (filters.technicianId) params = params.set('technicianId', filters.technicianId);
    if (filters.type)         params = params.set('type',         filters.type);
    return this.http.get<Task[]>(this.base, { params });
  }

  create(payload: CreateTaskPayload): Observable<Task> {
    return this.http.post<Task>(this.base, payload);
  }

  updateStatus(id: string, payload: UpdateTaskStatusPayload): Observable<Task> {
    return this.http.patch<Task>(`${this.base}/${id}/status`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/core/services/tasks.service.ts
git commit -m "feat(tasks): agregar método delete() en TasksService frontend"
```

---

## Task 5: Frontend — Columna `actions` en `TasksComponent`

**Files:**
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.ts`
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.html`
- Modify: `frontend/src/app/features/admin/tasks/tasks.component.spec.ts`

> `MatMenuModule` y `MatSnackBarModule` ya están importados en `admin.module.ts`. No requiere cambios de módulo.

- [ ] **Step 1: Escribir los tests para `deleteTask()` en `tasks.component.spec.ts`**

Actualizar el archivo completo:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { TasksComponent } from './tasks.component';
import { TasksService } from '../../../core/services/tasks.service';
import { Task } from '../../../core/models/task.models';
import { SharedModule } from '../../../shared/shared.module';

const mockTask = (id: string): Task => ({
  id,
  clientId: 'client-1',
  technicianId: 'tech-1',
  type: 'SERVER_MAINTENANCE',
  status: 'PENDING',
  scheduledDate: '2026-06-15',
  completedDate: null,
  odooTicketId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  client: { id: 'client-1', name: 'Acme' },
  technician: { id: 'tech-1', user: { id: 'user-1', name: 'Valen', email: 'valen@ondra.com.ar' } },
});

describe('TasksComponent', () => {
  let component: TasksComponent;
  let fixture: ComponentFixture<TasksComponent>;
  let tasksServiceSpy: jasmine.SpyObj<TasksService>;
  let dialog: MatDialog;

  beforeEach(async () => {
    tasksServiceSpy = jasmine.createSpyObj('TasksService', ['getAll', 'create', 'delete']);
    tasksServiceSpy.getAll.and.returnValue(of([mockTask('task-1'), mockTask('task-2')]));

    await TestBed.configureTestingModule({
      declarations: [TasksComponent],
      imports: [
        NoopAnimationsModule,
        MatDialogModule,
        MatMenuModule,
        MatSnackBarModule,
        MatTableModule,
        MatSortModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        FormsModule,
        SharedModule,
      ],
      providers: [
        { provide: TasksService, useValue: tasksServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TasksComponent);
    component = fixture.componentInstance;
    dialog = TestBed.inject(MatDialog);
    fixture.detectChanges();
  });

  it('ngOnInit llama a load()', () => {
    expect(tasksServiceSpy.getAll).toHaveBeenCalledTimes(1);
  });

  it('load() asigna las tareas a dataSource.data', () => {
    expect(component.dataSource.data.length).toBe(2);
    expect(component.dataSource.data[0].id).toBe('task-1');
  });

  it('load() setea loading=false y error="" cuando el servicio tiene éxito', () => {
    component.load();
    expect(component.loading).toBeFalse();
    expect(component.error).toBe('');
  });

  it('load() setea error cuando el servicio falla', () => {
    tasksServiceSpy.getAll.and.returnValue(throwError(() => new Error('Network')));
    component.load();
    expect(component.error).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  describe('openCreateDialog()', () => {
    it('inserta la nueva tarea en dataSource.data sin llamar a load()', () => {
      const newTask = mockTask('task-3');
      const mockRef = {
        afterClosed: () => of(newTask),
      } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);
      const loadSpy = spyOn(component, 'load').and.callThrough();

      const initialCount = component.dataSource.data.length;
      component.openCreateDialog();

      expect(component.dataSource.data.length).toBe(initialCount + 1);
      expect(component.dataSource.data[component.dataSource.data.length - 1].id).toBe('task-3');
      expect(loadSpy).not.toHaveBeenCalled();
    });

    it('no modifica dataSource.data cuando el dialog cierra con null', () => {
      const mockRef = {
        afterClosed: () => of(null),
      } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      const initialCount = component.dataSource.data.length;
      component.openCreateDialog();

      expect(component.dataSource.data.length).toBe(initialCount);
    });
  });

  describe('deleteTask()', () => {
    it('elimina la tarea del dataSource cuando el usuario confirma', () => {
      tasksServiceSpy.delete.and.returnValue(of(void 0));
      const mockRef = { afterClosed: () => of(true) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      component.deleteTask(mockTask('task-1'));

      expect(tasksServiceSpy.delete).toHaveBeenCalledWith('task-1');
      expect(component.dataSource.data.find(t => t.id === 'task-1')).toBeUndefined();
      expect(component.dataSource.data.length).toBe(1);
    });

    it('no modifica dataSource cuando el usuario cancela', () => {
      const mockRef = { afterClosed: () => of(undefined) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);

      const initialCount = component.dataSource.data.length;
      component.deleteTask(mockTask('task-1'));

      expect(tasksServiceSpy.delete).not.toHaveBeenCalled();
      expect(component.dataSource.data.length).toBe(initialCount);
    });

    it('muestra snackbar de error cuando el servicio falla y no modifica el dataSource', () => {
      tasksServiceSpy.delete.and.returnValue(throwError(() => new Error('Error')));
      const mockRef = { afterClosed: () => of(true) } as MatDialogRef<unknown>;
      spyOn(dialog, 'open').and.returnValue(mockRef);
      const snackBar = TestBed.inject(MatSnackBar);
      spyOn(snackBar, 'open');

      component.deleteTask(mockTask('task-1'));

      expect(snackBar.open).toHaveBeenCalledWith(
        'No se pudo eliminar la tarea',
        'Cerrar',
        jasmine.any(Object),
      );
      expect(component.dataSource.data.length).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
cd frontend && npx ng test --include='src/app/features/admin/tasks/tasks.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Esperado: FAIL — `component.deleteTask is not a function`.

- [ ] **Step 3: Actualizar `tasks.component.ts`**

```typescript
import { Component, DestroyRef, inject, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { Task, TaskStatus, TaskType } from '../../../core/models/task.models';
import { TasksService } from '../../../core/services/tasks.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TaskCreateDialogComponent } from './task-create-dialog/task-create-dialog.component';
import { statusLabel, statusBadge, typeLabel, typeBadge } from '../../../shared/utils/task-labels';

@Component({
  selector: 'app-tasks',
  templateUrl: './tasks.component.html',
  styleUrl: './tasks.component.scss',
})
export class TasksComponent implements OnInit, AfterViewInit {
  readonly dataSource = new MatTableDataSource<Task>([]);
  readonly displayedColumns = ['client', 'type', 'technician', 'scheduledDate', 'status', 'actions'];
  loading = false;
  error = '';
  filterStatus = '';

  @ViewChild(MatSort) sort!: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  readonly statusOptions: { value: string; label: string }[] = [
    { value: '',            label: 'Todos'        },
    { value: 'PENDING',     label: 'Pendiente'    },
    { value: 'IN_PROGRESS', label: 'En curso'     },
    { value: 'DONE',        label: 'Completado'   },
    { value: 'ESCALATED',   label: 'Escalado'     },
    { value: 'NOT_DONE',    label: 'No realizado' },
  ];

  constructor(
    private tasksService: TasksService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void { this.load(); }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (row: Task, column: string): string => {
      switch (column) {
        case 'client':     return row.client?.name ?? '';
        case 'technician': return row.technician?.user?.name ?? '';
        default:           return (row as unknown as Record<string, string>)[column] ?? '';
      }
    };
  }

  load(): void {
    this.loading = true;
    this.error = '';
    const filters = this.filterStatus ? { status: this.filterStatus } : {};
    this.tasksService.getAll(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: tasks => { this.dataSource.data = tasks; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar las tareas.'; this.loading = false; },
    });
  }

  openCreateDialog(): void {
    this.dialog.open(TaskCreateDialogComponent, { width: '480px' })
      .afterClosed().pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(task => {
        if (task) this.dataSource.data = [...this.dataSource.data, task];
      });
  }

  deleteTask(task: Task): void {
    const clientName = task.client?.name ?? 'este cliente';
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar tarea',
        message: `¿Eliminar la tarea de ${clientName}? Esta acción no se puede deshacer.`,
      },
    }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      if (!confirmed) return;
      this.tasksService.delete(task.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.dataSource.data = this.dataSource.data.filter(t => t.id !== task.id);
          this.snackBar.open('Tarea eliminada', 'Cerrar', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('No se pudo eliminar la tarea', 'Cerrar', { duration: 4000 });
        },
      });
    });
  }

  typeLabel(type: TaskType): string   { return typeLabel(type); }
  typeBadge(type: TaskType): string   { return typeBadge(type); }
  statusBadge(status: TaskStatus): string { return statusBadge(status); }
  statusLabel(status: TaskStatus): string { return statusLabel(status); }
}
```

- [ ] **Step 4: Actualizar `tasks.component.html`**

Agregar la columna `actions` antes de las filas `<tr>` al final de la tabla, y agregar la nueva columna a los `<tr>` row definitions. El archivo completo:

```html
<div class="page">
  <div class="page-header">
    <div>
      <h1 class="page-header__title">Tareas</h1>
      <span class="page-header__count" *ngIf="!loading">{{ dataSource.data.length }} tareas</span>
    </div>
    <div class="page-header__actions">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" style="width:180px">
        <mat-label>Estado</mat-label>
        <mat-select [(ngModel)]="filterStatus" (selectionChange)="load()">
          <mat-option *ngFor="let s of statusOptions" [value]="s.value">{{ s.label }}</mat-option>
        </mat-select>
      </mat-form-field>
      <button mat-flat-button color="primary" (click)="openCreateDialog()">
        <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin-right:4px;vertical-align:middle">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nueva tarea
      </button>
    </div>
  </div>

  <div *ngIf="error" class="error-banner">
    {{ error }}
    <button mat-button (click)="load()">Reintentar</button>
  </div>

  <div class="surface-card tasks-table">
    <table mat-table [dataSource]="dataSource" matSort matSortActive="client" matSortDirection="asc" style="width:100%">

      <ng-container matColumnDef="client">
        <th mat-header-cell *matHeaderCellDef mat-sort-header>Cliente</th>
        <td mat-cell *matCellDef="let row">{{ row.client?.name ?? '—' }}</td>
      </ng-container>

      <ng-container matColumnDef="type">
        <th mat-header-cell *matHeaderCellDef>Tipo</th>
        <td mat-cell *matCellDef="let row">
          <span class="badge" [ngClass]="typeBadge(row.type)">{{ typeLabel(row.type) }}</span>
        </td>
      </ng-container>

      <ng-container matColumnDef="technician">
        <th mat-header-cell *matHeaderCellDef>Técnico</th>
        <td mat-cell *matCellDef="let row" class="cell-secondary">{{ row.technician?.user?.name ?? '—' }}</td>
      </ng-container>

      <ng-container matColumnDef="scheduledDate">
        <th mat-header-cell *matHeaderCellDef>Fecha</th>
        <td mat-cell *matCellDef="let row" class="cell-mono">{{ row.scheduledDate | localDate }}</td>
      </ng-container>

      <ng-container matColumnDef="status">
        <th mat-header-cell *matHeaderCellDef>Estado</th>
        <td mat-cell *matCellDef="let row">
          <span class="badge" [ngClass]="statusBadge(row.status)">
            <span class="dot"></span>{{ statusLabel(row.status) }}
          </span>
        </td>
      </ng-container>

      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let row" class="cell-actions">
          <button mat-icon-button [matMenuTriggerFor]="rowMenu">
            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor">
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
          <mat-menu #rowMenu="matMenu">
            <button mat-menu-item (click)="deleteTask(row)">
              <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;margin-right:6px;vertical-align:middle">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              Eliminar
            </button>
          </mat-menu>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      <tr class="mat-mdc-no-data-row" *matNoDataRow>
        <td [attr.colspan]="displayedColumns.length">
          {{ loading ? 'Cargando…' : 'No hay tareas.' }}
        </td>
      </tr>
    </table>
  </div>
</div>
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

```bash
cd frontend && npx ng test --include='src/app/features/admin/tasks/tasks.component.spec.ts' --watch=false --browsers=ChromeHeadless
```

Esperado: PASS — todos los tests del archivo pasan.

- [ ] **Step 6: Correr todos los tests del frontend**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Esperado: PASS — sin regresiones.

- [ ] **Step 7: Commit final**

```bash
git add frontend/src/app/features/admin/tasks/tasks.component.ts frontend/src/app/features/admin/tasks/tasks.component.html frontend/src/app/features/admin/tasks/tasks.component.spec.ts
git commit -m "feat(admin): agregar opción de eliminar tarea con menú de 3 puntos y confirmación"
```
