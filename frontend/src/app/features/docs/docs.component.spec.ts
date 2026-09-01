import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MatButtonModule } from '@angular/material/button';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { DocsComponent } from './docs.component';
import { AuthService } from '../../core/services/auth.service';
import { DOCS_SECTIONS } from './data/docs-sections';
import { UserRole } from '../../core/models/auth.models';

function buildAuthSpy(role: UserRole) {
  const spy = jasmine.createSpyObj<AuthService>('AuthService', ['getCurrentUser']);
  spy.getCurrentUser.and.returnValue({ id: '1', name: 'Test User', email: 'test@ondra.com', role, technicianId: null, avatarUrl: null });
  return spy;
}

async function setup(role: UserRole): Promise<{ component: DocsComponent; fixture: ComponentFixture<DocsComponent> }> {
  await TestBed.configureTestingModule({
    declarations: [DocsComponent],
    imports: [
      CommonModule,
      NoopAnimationsModule,
      HttpClientTestingModule,
      MarkdownModule.forRoot(),
      MatButtonModule,
    ],
    providers: [{ provide: AuthService, useValue: buildAuthSpy(role) }],
  }).compileComponents();

  const fixture = TestBed.createComponent(DocsComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return { component, fixture };
}

describe('DocsComponent — filtrado por rol', () => {
  it('TECHNICIAN ve solo secciones universales', async () => {
    const { component } = await setup('TECHNICIAN');
    const ids = component.visibleSections.map(s => s.id);
    expect(ids).toContain('que-es');
    expect(ids).toContain('tareas');
    expect(ids).not.toContain('asignacion');
    expect(ids).not.toContain('visitas');
    expect(ids).not.toContain('usuarios');
  });

  it('ADMIN ve todas las secciones', async () => {
    const { component } = await setup('ADMIN');
    expect(component.visibleSections.length).toBe(DOCS_SECTIONS.length);
  });

  it('TL ve secciones propias pero no gestión de usuarios', async () => {
    const { component } = await setup('TL');
    const ids = component.visibleSections.map(s => s.id);
    expect(ids).toContain('asignacion');
    expect(ids).toContain('visitas');
    expect(ids).not.toContain('usuarios');
  });

  it('COORDINATOR ve visitas pero no asignacion ni usuarios', async () => {
    const { component } = await setup('COORDINATOR');
    const ids = component.visibleSections.map(s => s.id);
    expect(ids).toContain('visitas');
    expect(ids).not.toContain('asignacion');
    expect(ids).not.toContain('usuarios');
  });
});

describe('DocsComponent — navegación', () => {
  it('activeSection inicia en la primera sección visible', async () => {
    const { component } = await setup('TECHNICIAN');
    expect(component.activeSection.id).toBe(component.visibleSections[0].id);
  });

  it('goNext() avanza a la siguiente sección', async () => {
    const { component } = await setup('ADMIN');
    const second = component.visibleSections[1];
    component.goNext();
    expect(component.activeSection.id).toBe(second.id);
  });

  it('goPrev() vuelve a la sección anterior', async () => {
    const { component } = await setup('ADMIN');
    component.goNext();
    component.goPrev();
    expect(component.activeSection.id).toBe(component.visibleSections[0].id);
  });

  it('goPrev() en el primer elemento es no-op', async () => {
    const { component } = await setup('ADMIN');
    const first = component.visibleSections[0];
    component.goPrev();
    expect(component.activeSection.id).toBe(first.id);
  });

  it('goNext() en el último elemento es no-op', async () => {
    const { component } = await setup('TECHNICIAN');
    const last = component.visibleSections[component.visibleSections.length - 1];
    for (let i = 0; i < component.visibleSections.length + 2; i++) {
      component.goNext();
    }
    expect(component.activeSection.id).toBe(last.id);
  });

  it('hasPrev es false en la primera sección', async () => {
    const { component } = await setup('ADMIN');
    expect(component.hasPrev).toBeFalse();
  });

  it('hasNext es false en la última sección', async () => {
    const { component } = await setup('TECHNICIAN');
    const last = component.visibleSections[component.visibleSections.length - 1];
    component.selectSection(last);
    expect(component.hasNext).toBeFalse();
  });

  it('selectSection() cambia la sección activa', async () => {
    const { component } = await setup('ADMIN');
    const target = component.visibleSections[3];
    component.selectSection(target);
    expect(component.activeSection.id).toBe(target.id);
  });
});

describe('DocsComponent — activeAssetPath', () => {
  it('construye la ruta correcta para la sección activa', async () => {
    const { component } = await setup('ADMIN');
    expect(component.activeAssetPath).toBe('assets/docs/' + component.activeSection.file);
  });
});

describe('DocsComponent — groupedSections', () => {
  it('agrupa secciones por group sin duplicados', async () => {
    const { component } = await setup('ADMIN');
    const groups = component.groupedSections();
    const groupNames = groups.map(g => g.group);
    const unique = new Set(groupNames);
    expect(unique.size).toBe(groupNames.length);
  });

  it('cada sección aparece exactamente una vez', async () => {
    const { component } = await setup('ADMIN');
    const all = component.groupedSections().flatMap(g => g.sections);
    expect(all.length).toBe(component.visibleSections.length);
  });
});
