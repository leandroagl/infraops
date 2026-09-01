import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { UserAvatarComponent } from './user-avatar.component';

describe('UserAvatarComponent', () => {
  let fixture: ComponentFixture<UserAvatarComponent>;
  let component: UserAvatarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, CommonModule],
      declarations: [UserAvatarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(UserAvatarComponent);
    component = fixture.componentInstance;
  });

  it('muestra <img> cuando avatarUrl está definida', () => {
    component.name = 'Leandro';
    component.avatarUrl = '/avatars/photo.jpg';
    fixture.detectChanges();

    const img = fixture.debugElement.query(By.css('img'));
    expect(img).toBeTruthy();
    expect(img.nativeElement.src).toContain('/avatars/photo.jpg');
  });

  it('muestra inicial cuando avatarUrl es null', () => {
    component.name = 'Valentín';
    component.avatarUrl = null;
    fixture.detectChanges();

    const span = fixture.debugElement.query(By.css('.av__initial'));
    expect(span).toBeTruthy();
    expect(span.nativeElement.textContent.trim()).toBe('V');
  });

  it('muestra inicial cuando la imagen falla al cargar', () => {
    component.name = 'Test';
    component.avatarUrl = '/avatars/broken.jpg';
    fixture.detectChanges();

    component.onImageError();
    fixture.detectChanges();

    const img = fixture.debugElement.query(By.css('img'));
    const span = fixture.debugElement.query(By.css('.av__initial'));
    expect(img).toBeNull();
    expect(span).toBeTruthy();
  });

  it('aplica la clase de tamaño correcta', () => {
    component.name = 'X';
    component.avatarUrl = null;
    component.size = 'md';
    fixture.detectChanges();

    const el = fixture.debugElement.query(By.css('.av'));
    expect(el.nativeElement.classList).toContain('av--md');
  });

  it('genera la misma clase de color para el mismo nombre', () => {
    component.name = 'Leandro';
    fixture.detectChanges();
    const firstColor = component.colorClass;

    component.name = 'Leandro';
    expect(component.colorClass).toBe(firstColor);
  });

  it('retorna ? como inicial cuando name está vacío', () => {
    component.name = '';
    component.avatarUrl = null;
    fixture.detectChanges();

    expect(component.initials).toBe('?');
  });
});
