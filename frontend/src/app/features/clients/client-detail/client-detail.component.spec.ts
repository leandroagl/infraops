import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClientDetailComponent } from './client-detail.component';
import { ClientsService } from '../../../core/services/clients.service';
import { SidenavContextService } from '../../../core/services/sidenav-context.service';
import { Client } from '../../../core/models/client.models';

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'abc',
  name: 'ACME Corp',
  primaryAddress: null,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('ClientDetailComponent', () => {
  let fixture: ComponentFixture<ClientDetailComponent>;
  let clientsServiceSpy: jasmine.SpyObj<ClientsService>;
  let sidenavCtxSpy: jasmine.SpyObj<SidenavContextService>;

  beforeEach(async () => {
    clientsServiceSpy = jasmine.createSpyObj('ClientsService', ['getById']);
    sidenavCtxSpy = jasmine.createSpyObj('SidenavContextService', ['setClient', 'clearClient']);
    clientsServiceSpy.getById.and.returnValue(of(makeClient()));

    await TestBed.configureTestingModule({
      declarations: [ClientDetailComponent],
      providers: [
        { provide: ClientsService, useValue: clientsServiceSpy },
        { provide: SidenavContextService, useValue: sidenavCtxSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'abc' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientDetailComponent);
    fixture.detectChanges();
  });

  it('llama a sidenavCtx.setClient con el id y nombre del cliente', () => {
    expect(sidenavCtxSpy.setClient).toHaveBeenCalledWith({ id: 'abc', name: 'ACME Corp' });
  });

  it('llama a sidenavCtx.clearClient al destruirse', () => {
    fixture.destroy();
    expect(sidenavCtxSpy.clearClient).toHaveBeenCalled();
  });

  it('setea loadError en true cuando falla la carga', async () => {
    clientsServiceSpy.getById.and.returnValue(throwError(() => new Error('network')));
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      declarations: [ClientDetailComponent],
      providers: [
        { provide: ClientsService, useValue: clientsServiceSpy },
        { provide: SidenavContextService, useValue: sidenavCtxSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'abc' } } } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const f = TestBed.createComponent(ClientDetailComponent);
    f.detectChanges();
    expect(f.componentInstance.loadError).toBe(true);
  });
});
