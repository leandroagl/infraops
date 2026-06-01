import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientMantenimientosComponent } from './client-mantenimientos.component';

describe('ClientMantenimientosComponent', () => {
  let fixture: ComponentFixture<ClientMantenimientosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClientMantenimientosComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientMantenimientosComponent);
    fixture.detectChanges();
  });

  it('renderiza el placeholder de mantenimientos', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Mantenimientos');
  });
});
