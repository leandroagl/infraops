import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TasksService } from './tasks.service';
import { environment } from '../../../environments/environment';

describe('TasksService', () => {
  let service: TasksService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(TasksService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('assignTechnician hace PATCH a /tasks/:id con technicianId y retorna la tarea actualizada', () => {
    const expected = { id: 'task-1', technicianId: 'tech-1' } as any;

    service.assignTechnician('task-1', 'tech-1').subscribe(result => {
      expect(result).toEqual(expected);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tasks/task-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ technicianId: 'tech-1' });
    req.flush(expected);
  });
});
