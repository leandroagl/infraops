import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Router } from '@angular/router';
import { CellClickedEvent } from 'ag-grid-community';
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
    expect(component.clients.length).toBe(1);
    expect(component.clients[0].name).toBe('ACME Corp');
  });

  it('navega a /clients/:id al hacer click en la columna nombre', () => {
    component.onCellClicked({
      colDef: { field: 'name' },
      data: { id: '1' },
    } as CellClickedEvent);

    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clients', '1']);
  });

  it('no navega al hacer click en la columna dirección', () => {
    component.onCellClicked({
      colDef: { field: 'primaryAddress' },
      data: { id: '1' },
    } as CellClickedEvent);

    expect(routerSpy.navigate).not.toHaveBeenCalled();
  });

  it('expone columnDefs con los campos name y primaryAddress', () => {
    const fields = component.columnDefs.map(c => c.field);
    expect(fields).toContain('name');
    expect(fields).toContain('primaryAddress');
  });
});
