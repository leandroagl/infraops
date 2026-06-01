import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClientOverviewComponent } from './client-overview.component';

describe('ClientOverviewComponent', () => {
  let fixture: ComponentFixture<ClientOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ClientOverviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientOverviewComponent);
    fixture.detectChanges();
  });

  it('renderiza el placeholder de overview', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Overview');
  });
});
