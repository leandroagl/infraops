const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const BULLET_PREFIX = '- ';

export function plainTextToHtml(text: string): string {
  const lines = text.split('\n').map(line => line.trim());

  const html: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      html.push(`<p>${paragraphLines.map(escapeHtml).join('<br>')}</p>`);
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      html.push(`<ul>${listItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };

  for (const line of lines) {
    if (line.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith(BULLET_PREFIX)) {
      flushParagraph();
      listItems.push(line.slice(BULLET_PREFIX.length));
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  flushList();

  return html.join('');
}
