import { plainTextToHtml } from './plain-text-to-html';

describe('plainTextToHtml', () => {
  it('convierte un párrafo simple en <p>', () => {
    expect(plainTextToHtml('Texto simple.')).toBe('<p>Texto simple.</p>');
  });

  it('convierte saltos de línea simples dentro de un párrafo en <br>', () => {
    expect(plainTextToHtml('Línea uno\nLínea dos')).toBe(
      '<p>Línea uno<br>Línea dos</p>',
    );
  });

  it('convierte bloques separados por línea en blanco en párrafos independientes', () => {
    expect(plainTextToHtml('Párrafo uno.\n\nPárrafo dos.')).toBe(
      '<p>Párrafo uno.</p><p>Párrafo dos.</p>',
    );
  });

  it('convierte líneas que empiezan con "- " en una lista', () => {
    expect(plainTextToHtml('- Uno\n- Dos\n- Tres')).toBe(
      '<ul><li>Uno</li><li>Dos</li><li>Tres</li></ul>',
    );
  });

  it('mezcla párrafo seguido de lista sin línea en blanco entre ambos', () => {
    const input = 'Se verifican los siguientes puntos:\n- Uno\n- Dos';
    expect(plainTextToHtml(input)).toBe(
      '<p>Se verifican los siguientes puntos:</p><ul><li>Uno</li><li>Dos</li></ul>',
    );
  });

  it('reproduce la descripción default de QNAP_MAINTENANCE con el formato esperado', () => {
    const input = `Control mensual preventivo sobre el repositorio de backups QNAP/NAS.

Se verifican los siguientes puntos:
- Estado de los discos físicos: cantidad instalada y detección de fallas o alertas por unidad
- Estado del volumen RAID: degradación, falta de sincronización o error crítico
- Capacidad de almacenamiento: espacio utilizado sobre el total disponible
- Versión de firmware del dispositivo y aplicación de actualizaciones disponibles

Ante cualquier anomalía detectada, se creará un ticket de soporte para su seguimiento y resolución.`;

    expect(plainTextToHtml(input)).toBe(
      '<p>Control mensual preventivo sobre el repositorio de backups QNAP/NAS.</p>' +
        '<p>Se verifican los siguientes puntos:</p>' +
        '<ul>' +
        '<li>Estado de los discos físicos: cantidad instalada y detección de fallas o alertas por unidad</li>' +
        '<li>Estado del volumen RAID: degradación, falta de sincronización o error crítico</li>' +
        '<li>Capacidad de almacenamiento: espacio utilizado sobre el total disponible</li>' +
        '<li>Versión de firmware del dispositivo y aplicación de actualizaciones disponibles</li>' +
        '</ul>' +
        '<p>Ante cualquier anomalía detectada, se creará un ticket de soporte para su seguimiento y resolución.</p>',
    );
  });

  it('escapa caracteres especiales de HTML', () => {
    expect(plainTextToHtml('Uso de CPU < 80% && memoria > 50%')).toBe(
      '<p>Uso de CPU &lt; 80% &amp;&amp; memoria &gt; 50%</p>',
    );
  });

  it('ignora líneas en blanco al inicio, al final y repetidas entre bloques', () => {
    expect(plainTextToHtml('\n\nTexto.\n\n\n\nOtro texto.\n\n')).toBe(
      '<p>Texto.</p><p>Otro texto.</p>',
    );
  });

  it('retorna string vacío para input vacío o solo espacios', () => {
    expect(plainTextToHtml('')).toBe('');
    expect(plainTextToHtml('   \n  \n')).toBe('');
  });
});
