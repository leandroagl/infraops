import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { BehaviorSubject, of } from 'rxjs';
import { By } from '@angular/platform-browser';
import { ShellComponent } from './shell.component';
import { AuthService } from '../services/auth.service';
import { SidenavContextService, ClientSidenavContext } from '../services/sidenav-context.service';

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let clientSubject: BehaviorSubject<ClientSidenavContext | null>;

  beforeEach(async () => {
    clientSubject = new BehaviorSubject<ClientSidenavContext | null>(null);

    await TestBed.configureTestingModule({
      declarations: [ShellComponent],
      imports: [NoopAnimationsModule, MatMenuModule, MatDividerModule],
      providers: [
        {
          provide: Router,
          useValue: jasmine.createSpyObj('Router', { isActive: false, navigate: Promise.resolve(true) }),
        },
        {
          provide: AuthService,
          useValue: { getCurrentUser: () => null, logout: jasmine.createSpy(), user$: of(null) },
        },
        {
          provide: SidenavContextService,
          useValue: { client$: clientSubject.asObservable() },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
  });

  it('muestra el nav global cuando no hay cliente activo', () => {
    const globalNav = fixture.nativeElement.querySelector('.sidebar__nav--global');
    expect(globalNav).toBeTruthy();
  });

  it('no muestra el nav de cliente cuando no hay cliente activo', () => {
    const clientNav = fixture.nativeElement.querySelector('.sidebar__nav--client');
    expect(clientNav).toBeFalsy();
  });

  it('muestra el nav de cliente cuando hay cliente activo', () => {
    clientSubject.next({ id: '1', name: 'ACME Corp' });
    fixture.detectChanges();
    const clientNav = fixture.nativeElement.querySelector('.sidebar__nav--client');
    expect(clientNav).toBeTruthy();
  });

  it('no muestra el nav global cuando hay cliente activo', () => {
    clientSubject.next({ id: '1', name: 'ACME Corp' });
    fixture.detectChanges();
    const globalNav = fixture.nativeElement.querySelector('.sidebar__nav--global');
    expect(globalNav).toBeFalsy();
  });

  it('usa mat-sidenav-container como contenedor principal', () => {
    const container = fixture.nativeElement.querySelector('mat-sidenav-container');
    expect(container).toBeTruthy();
  });

  it('usa mat-toolbar como topbar', () => {
    const toolbar = fixture.nativeElement.querySelector('mat-toolbar');
    expect(toolbar).toBeTruthy();
  });

  it('aplica sidenav--wide en mat-sidenav cuando hay cliente activo', () => {
    clientSubject.next({ id: '1', name: 'ACME Corp' });
    fixture.detectChanges();
    const sidenav = fixture.nativeElement.querySelector('mat-sidenav');
    expect(sidenav?.classList.contains('sidenav--wide')).toBeTrue();
  });

  it('muestra el botón de usuario en el toolbar', () => {
    const userBtn = fixture.nativeElement.querySelector('.toolbar__user-btn');
    expect(userBtn).toBeTruthy();
  });

  it('no muestra el botón de logout en el sidebar', () => {
    const logoutBtn = fixture.nativeElement.querySelector('.nav-item--logout');
    expect(logoutBtn).toBeFalsy();
  });

  it('goToProfile() navega a /profile', () => {
    const router = TestBed.inject(Router);
    fixture.componentInstance.goToProfile();
    expect(router.navigate).toHaveBeenCalledWith(['/profile']);
  });

  it('renderiza app-user-avatar con los datos del usuario autenticado', () => {
    const avatarEl = fixture.debugElement.query(By.css('app-user-avatar'));
    expect(avatarEl).toBeTruthy();
  });
});
