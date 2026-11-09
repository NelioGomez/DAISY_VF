/* Descarga del manual en PDF (mejora n.° 64): convierte los capítulos (ya analizados en bloques) a un
   documento de pdfmake, con las imágenes del manual, y lo descarga sin abrir la impresión.
   pdfmake y sus fuentes se cargan solo al pedir la descarga, para no hacer más pesada la página. */
import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import { IMAGENES } from './imagenes';
import type { Capitulo } from './manual';
import type { Block, Item } from './md';

const TOKEN = /(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(`[^`]+`)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)\s]+\))|(:ic-[a-z0-9-]+:)/g;
const ANCHO = 532; // ancho útil de una hoja carta con márgenes de 40 pt
const COLOR = { tinta: '#1f2937', suave: '#5b6675', linea: '#d8dee6', fondo: '#f1f4f7', ambar: '#b45309' };
const AVISO = {
  nota: { fondo: '#eaf2fb', borde: '#9cc0e8' },
  importante: { fondo: '#fff4e0', borde: '#f0c26b' },
  consejo: { fondo: '#e9f6ee', borde: '#93d1a9' },
} as const;

/** La fuente del PDF no trae flechas ni símbolos: se cambian por equivalentes o se quitan. */
const SIMBOLOS: Record<string, string> = { '←': '‹', '→': '›', '↑': 'Flecha arriba', '↓': 'Flecha abajo', '✕': '×', '⠿': '(asa de arrastre)' };
const limpio = (t: string) =>
  t
    .replace(/[←→↑↓✕⠿]/g, (c) => SIMBOLOS[c])
    .replace(/[↧⇄⇩▲▶▼◆⚖⚠✓⬇]\s?/g, '')
    .replace(/ {2,}/g, ' ');

/** Texto con **negrita**, *cursiva*, `código`, [[teclas]] y [enlaces](…) a fragmentos de pdfmake. */
function inline(texto: string): ContentText['text'] {
  const text = limpio(texto);
  const out: Array<string | ContentText> = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (m[1]) out.push({ text: t.slice(2, -2), bold: true });
    else if (m[2]) out.push({ text: t.slice(1, -1), italics: true });
    else if (m[3]) out.push({ text: ` ${t.slice(1, -1)} `, background: COLOR.fondo, color: '#374151' });
    else if (m[4]) out.push({ text: ` ${t.slice(2, -2)} `, background: COLOR.fondo, bold: true, fontSize: 9 });
    else if (m[5]) {
      const [, etiqueta, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t) ?? [];
      out.push(href?.startsWith('http') ? { text: etiqueta, link: href, color: '#1d4ed8' } : { text: etiqueta, color: COLOR.ambar });
    }
    // :ic-nombre: (íconos del menú) no se dibujan en el PDF.
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 && typeof out[0] === 'string' ? out[0] : (out as ContentText['text']);
}

const item = (it: Item): Content => (it.sub.length ? { stack: [{ text: inline(it.text) }, { ul: it.sub.map((s) => ({ text: inline(s) })), margin: [0, 2, 0, 0] }] } : { text: inline(it.text) });

/** Las imágenes son WebP; pdfmake necesita JPEG o PNG, así que se convierten en el navegador. */
const cache = new Map<string, Promise<string | null>>();
function imagen(src: string): Promise<string | null> {
  if (!cache.has(src)) {
    cache.set(
      src,
      (async () => {
        try {
          const blob = await (await fetch(src)).blob();
          const bmp = await createImageBitmap(blob);
          const canvas = document.createElement('canvas');
          canvas.width = bmp.width;
          canvas.height = bmp.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(bmp, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.86);
        } catch {
          return null;
        }
      })(),
    );
  }
  return cache.get(src)!;
}

async function bloques(blocks: Block[]): Promise<Content[]> {
  const out: Content[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'h':
        out.push(
          b.level === 2
            ? { text: inline(b.text), style: 'h2', headlineLevel: 2 }
            : { text: inline(b.text), style: 'h3', headlineLevel: 3 },
        );
        break;
      case 'p':
        out.push({ text: inline(b.text), style: 'p' });
        break;
      case 'ul':
        out.push({ ul: b.items.map(item), style: 'lista' });
        break;
      case 'ol':
        out.push({ ol: b.items.map(item), start: b.start, style: 'lista' });
        break;
      case 'note': {
        const c = AVISO[b.kind];
        out.push({
          table: { widths: ['*'], body: [[{ text: inline(b.text), fillColor: c.fondo, margin: [8, 6, 8, 6] }]] },
          layout: { hLineColor: () => c.borde, vLineColor: () => c.borde, hLineWidth: () => 0.8, vLineWidth: () => 0.8 },
          margin: [0, 2, 0, 10],
          unbreakable: true,
        });
        break;
      }
      case 'img': {
        const data = await imagen(b.src);
        if (!data) break;
        const [w] = IMAGENES[b.src.replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '')] ?? [ANCHO];
        out.push({
          stack: [
            { image: data, width: Math.min(ANCHO, w * 0.62), alignment: 'center' },
            ...(b.alt ? [{ text: inline(b.alt), style: 'pie' }] : []),
          ],
          margin: [0, 4, 0, 12],
          unbreakable: true,
        });
        break;
      }
      case 'table':
        out.push({
          table: {
            headerRows: 1,
            widths: b.head.map(() => '*'),
            body: [b.head.map((h) => ({ text: inline(h), style: 'th' })), ...b.rows.map((r) => b.head.map((_, i) => ({ text: inline(r[i] ?? ''), style: 'td' })))],
          },
          layout: {
            fillColor: (fila: number) => (fila === 0 ? COLOR.fondo : null),
            hLineColor: () => COLOR.linea,
            vLineColor: () => COLOR.linea,
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
          },
          margin: [0, 2, 0, 12],
        });
        break;
      case 'hr':
        out.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: ANCHO, y2: 0, lineWidth: 0.6, lineColor: COLOR.linea }], margin: [0, 6, 0, 10] });
        break;
    }
  }
  return out;
}

async function capitulo(cap: Capitulo, n: number, total: number, nuevaPagina: boolean): Promise<Content[]> {
  return [
    { text: `${cap.grupo.toUpperCase()} · CAPÍTULO ${n} DE ${total}`, style: 'kicker', pageBreak: nuevaPagina ? 'before' : undefined },
    { text: cap.titulo, style: 'h1', headlineLevel: 1 },
    ...(cap.resumen ? [{ text: inline(cap.resumen), style: 'lead' } as Content] : []),
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: ANCHO, y2: 0, lineWidth: 0.6, lineColor: COLOR.linea }], margin: [0, 2, 0, 12] },
    ...(await bloques(cap.blocks)),
  ];
}

function portada(todos: Capitulo[]): Content[] {
  const grupos = [...new Set(todos.map((c) => c.grupo))];
  const columna = (gs: string[]): Content => ({
    stack: gs.flatMap((g) => [
      { text: g.toUpperCase(), style: 'kicker', margin: [0, 10, 0, 3] },
      ...todos.filter((c) => c.grupo === g).map((c) => ({ text: `${todos.indexOf(c) + 1}. ${c.titulo}`, fontSize: 10, margin: [0, 1, 0, 1] }) as Content),
    ]),
  });
  const mitad = Math.ceil(grupos.length / 2);
  return [
    { text: 'NORCOR FUELING SYSTEM', style: 'kicker', margin: [0, 60, 0, 6] },
    { text: 'Manual de usuario de SIVEN', fontSize: 28, bold: true, color: COLOR.tinta },
    { text: 'Sistema de Inventario y Ventas: qué hace cada parte del sistema y cómo usarla, paso a paso y con imágenes.', style: 'lead', margin: [0, 8, 0, 4] },
    { text: `Versión descargada el ${new Date().toLocaleDateString('es-NI', { day: 'numeric', month: 'long', year: 'numeric' })}.`, fontSize: 9, color: COLOR.suave, margin: [0, 0, 0, 22] },
    { text: 'Contenido', style: 'h2' },
    { columns: [columna(grupos.slice(0, mitad)), columna(grupos.slice(mitad))], columnGap: 28 },
  ];
}

/** Genera y descarga el PDF de uno o de todos los capítulos. */
export async function descargarPdf(caps: Capitulo[], todos: Capitulo[], archivo: string): Promise<void> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
  pdfMake.addVirtualFileSystem(vfs);
  const completo = caps.length > 1;
  const content: Content[] = completo ? portada(todos) : [];
  for (const cap of caps) content.push(...(await capitulo(cap, todos.indexOf(cap) + 1, todos.length, completo)));

  const doc: TDocumentDefinitions = {
    pageSize: 'LETTER',
    pageMargins: [40, 46, 40, 50],
    info: { title: completo ? 'Manual de usuario de SIVEN' : `SIVEN — ${caps[0].titulo}`, author: 'NORCOR Fueling System', subject: 'Manual de usuario' },
    content,
    footer: (pagina, paginas) => ({
      columns: [
        { text: 'Manual de usuario de SIVEN · NORCOR Fueling System', fontSize: 8, color: COLOR.suave },
        { text: `Página ${pagina} de ${paginas}`, fontSize: 8, color: COLOR.suave, alignment: 'right' },
      ],
      margin: [40, 18, 40, 0],
    }),
    // Que un subtítulo no quede solo al final de una página.
    pageBreakBefore: (nodo, q) => !!nodo.headlineLevel && nodo.headlineLevel > 1 && q.getFollowingNodesOnPage().length === 0,
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: COLOR.tinta },
    styles: {
      kicker: { fontSize: 8, bold: true, color: COLOR.suave, characterSpacing: 0.6 },
      h1: { fontSize: 22, bold: true, margin: [0, 2, 0, 6] },
      lead: { fontSize: 11.5, color: COLOR.suave, margin: [0, 0, 0, 8] },
      h2: { fontSize: 15, bold: true, margin: [0, 12, 0, 6] },
      h3: { fontSize: 12, bold: true, margin: [0, 8, 0, 4] },
      p: { margin: [0, 0, 0, 7] },
      lista: { margin: [0, 0, 0, 8] },
      pie: { fontSize: 8.5, color: COLOR.suave, alignment: 'center', margin: [30, 4, 30, 0] },
      th: { bold: true, fontSize: 8.5, color: COLOR.suave, margin: [4, 4, 4, 4] },
      td: { fontSize: 9, margin: [4, 4, 4, 4] },
    },
  };
  await pdfMake.createPdf(doc).download(archivo);
}
