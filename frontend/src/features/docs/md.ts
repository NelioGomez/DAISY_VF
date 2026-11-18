/* Lectura del Markdown del manual de usuario (mejora n.° 64): bloques, anclas y texto plano para
   la búsqueda. El dibujo de los bloques está en Markdown.tsx. */
/** Elemento de una lista; sub son las viñetas sangradas debajo de él (un solo nivel). */
export interface Item {
  text: string;
  sub: string[];
}

export type Block =
  | { t: 'h'; level: 2 | 3; text: string; id: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: Item[] }
  /** Pasos numerados; start permite seguir la numeración después de una imagen (4. …). */
  | { t: 'ol'; items: Item[]; start: number }
  | { t: 'note'; kind: 'nota' | 'importante' | 'consejo'; text: string }
  | { t: 'img'; alt: string; src: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'hr' };

/** "Órdenes de servicio" → "ordenes-de-servicio" (anclas y búsqueda sin tildes). */
export const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Texto plano (sin marcas) para buscar y para los títulos de las anclas. */
export const plain = (s: string) =>
  s
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/:ic-[a-z0-9-]+:/g, '')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const NOTE = /^\*\*(nota|importante|consejo):?\*\*:?\s*/i;

export function parse(md: string): Block[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const ids = new Map<string, number>();
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join(' ') });
    para = [];
  };
  const uniqueId = (text: string) => {
    const base = slug(plain(text)) || 'seccion';
    const n = ids.get(base) ?? 0;
    ids.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flush();
      blocks.push({ t: 'h', level: h[1].length as 2 | 3, text: h[2], id: uniqueId(h[2]) });
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      flush();
      blocks.push({ t: 'hr' });
      continue;
    }
    const img = IMG.exec(trimmed);
    if (img) {
      flush();
      blocks.push({ t: 'img', alt: img[1], src: img[2] });
      continue;
    }
    if (trimmed.startsWith('>')) {
      flush();
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        parts.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      i--;
      const text = parts.join(' ');
      const kind = (NOTE.exec(text)?.[1].toLowerCase() ?? 'nota') as 'nota' | 'importante' | 'consejo';
      blocks.push({ t: 'note', kind, text });
      continue;
    }
    if (trimmed.startsWith('|')) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      i--;
      const [head = [], ...rest] = rows;
      blocks.push({ t: 'table', head, rows: rest });
      continue;
    }
    const li = /^(-|\*|\d+\.)\s+(.*)$/.exec(trimmed);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1]);
      const start = ordered ? parseInt(li[1], 10) : 1;
      const items: Item[] = [{ text: li[2], sub: [] }];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        const m = /^(-|\*|\d+\.)\s+(.*)$/.exec(next.trim());
        const sangrada = /^\s{2,}\S/.test(next);
        const ultimo = items[items.length - 1];
        if (m && !sangrada && /\d/.test(m[1]) === ordered) items.push({ text: m[2], sub: [] });
        // Viñeta sangrada: va debajo del elemento anterior (p. ej. los campos de un paso).
        else if (sangrada && m && !/\d/.test(m[1])) ultimo.sub.push(m[2]);
        // Línea sangrada sin viñeta: continúa la última viñeta o el elemento.
        else if (sangrada && ultimo.sub.length) ultimo.sub[ultimo.sub.length - 1] += ' ' + next.trim();
        else if (sangrada) ultimo.text += ' ' + next.trim();
        else break;
        i++;
      }
      i--;
      blocks.push(ordered ? { t: 'ol', items, start } : { t: 'ul', items });
      continue;
    }
    para.push(trimmed);
  }
  flush();
  return blocks;
}
