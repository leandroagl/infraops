import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { ClientsListComponent } from './clients-list.component';
import { ClientsService } from '../../../core/services/clients.service';
import { Client } from '../../../core/models/client.models';

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: '1',
  name: 'ACME Corp',
  primaryAddress: 'Av. Corrientes 1234, Buenos Aires',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('ClientsListComponent', () => {
  let component: ClientsListComponent;
  let fixture: ComponentFixture<ClientsListComponent>;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    clientsServiceSpy = jasmine.createSpyObj('ClientsService', ['getAll']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    clientsServiceSpy.getAll.and.returnValue(of([
      makeClient({ id: '1', name: 'ACME Corp', isActive: true }),
      makeClient({ id: '2', name: 'Archivado SA', isActive: false }),
    ]));

    await TestBed.configureTestingModule({
      declarations: [ClientsListComponent],
      imports: [NoopAnimationsModule, FormsModule, MatTableModule, MatSortModule],
      providers: [
        { provide: ClientsService, useValue: clientsServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga solo clientes activos en ngOnInit', () => {
    expect(component.dataSource.data.length).toBe(1);
    expect(component.dataSource.data[0].name).toBe('ACME Corp');
  });

  it('navega a /clients/:id al llamar navigateToClient', () => {
    component.navigateToClient('1');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients', '1']);
  });

  it('expone displayedColumns con los campos name y primaryAddress', () => {
    expect(component.displayedColumns).toContain('name');
    expect(component.displayedColumns).toContain('primaryAddress');
  });

  it('muestra loadError true cuando falla la carga', async () => {
    const errorSpy = jasmine.createSpyObj('ClientsService', ['getAll']);
    errorSpy.getAll.and.returnValue(throwError(() => new Error('Network error')));
    const routerSpyLocal = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [ClientsListComponent],
      imports: [NoopAnimationsModule, FormsModule, MatTableModule, MatSortModule],
      providers: [
        { provide: ClientsService, useValue: errorSpy },
        { provide: Router, useValue: routerSpyLocal },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    const f = TestBed.createComponent(ClientsListComponent);
    f.detectChanges();

    expect(f.componentInstance.loadError).toBe(true);
    expect(f.componentInstance.dataSource.data.length).toBe(0);
  });

  it('aplica filtro al dataSource al llamar applyFilter', () => {
    component.quickFilter = 'acme';
    component.applyFilter();
    expect(component.dataSource.filter).toBe('acme');
  });
});
