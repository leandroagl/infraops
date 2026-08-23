import { DOCS_SECTIONS, DocSection } from './docs-sections';

describe('DOCS_SECTIONS', () => {
  it('es un array no vacío', () => {
    expect(Array.isArray(DOCS_SECTIONS)).toBeTrue();
    expect(DOCS_SECTIONS.length).toBeGreaterThan(0);
  });

  it('cada sección tiene los campos requeridos', () => {
    DOCS_SECTIONS.forEach((s: DocSection) => {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.file).toBeTruthy();
      expect(s.group).toBeTruthy();
      expect(Array.isArray(s.roles)).toBeTrue();
      expect(s.roles.length).toBeGreaterThan(0);
    });
  });

  it('no hay ids duplicados', () => {
    const ids = DOCS_SECTIONS.map(s => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('los archivos siguen el patrón NN-nombre.md', () => {
    const pattern = /^\d{2}-.+\.md$/;
    DOCS_SECTIONS.forEach(s => {
      expect(pattern.test(s.file))
        .withContext(`archivo "${s.file}" no cumple el patrón`)
        .toBeTrue();
    });
  });

  it('los roles solo contienen valores válidos', () => {
    const valid = new Set(['ADMIN', 'TL', 'COORDINATOR', 'TECHNICIAN', '*']);
    DOCS_SECTIONS.forEach(s => {
      s.roles.forEach(r => {
        expect(valid.has(r))
          .withContext(`rol "${r}" en sección "${s.id}" no es válido`)
          .toBeTrue();
      });
    });
  });

  it('las secciones universales tienen roles ["*"]', () => {
    const universal = ['que-es', 'acceso', 'tareas', 'ejecucion', 'estados'];
    universal.forEach(id => {
      const section = DOCS_SECTIONS.find(s => s.id === id);
      expect(section).toBeTruthy(`sección "${id}" no encontrada`);
      expect(section!.roles).toContain('*');
    });
  });

  it('la sección gestión-usuarios solo es visible para ADMIN', () => {
    const section = DOCS_SECTIONS.find(s => s.id === 'usuarios');
    expect(section).toBeTruthy();
    expect(section!.roles).toEqual(['ADMIN']);
  });
});
