import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';

import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';
import { AuthUser } from '../../core/models/auth.models';

const mockUser: AuthUser = {
  id: '1', email: 'v@ondra.com.ar', role: 'TECHNICIAN', technicianId: null,
};

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    const authService = jasmine.createSpyObj('AuthService', ['getCurrentUser']);
    authService.getCurrentUser.and.returnValue(mockUser);

    await TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      imports: [CommonModule],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture   = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga el usuario desde AuthService al inicializar', () => {
    expect(component.user).toEqual(mockUser);
  });
});
