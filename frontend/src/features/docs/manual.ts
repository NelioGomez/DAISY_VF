/* Capítulos del manual de usuario (mejora n.° 64). Cada archivo de ./manual es un capítulo en
   Markdown con una cabecera (id, título, grupo, módulo y resumen); el orden lo da el número del
   nombre del archivo (01-…, 02-…). Para corregir o ampliar el manual basta con editar esos
   archivos; las imágenes van en frontend/public/manual. */
import type { ModuleId } from '../../types';
import { parse, plain, type Block } from './md';

export interface Seccion {
  /** Ancla del subtítulo (vacía = inicio del capítulo). */
  id: string;
  titulo: string;
  texto: string;
}

export interface Capitulo {
  id: string;
  titulo: string;
  grupo: string;
  /** Módulo del sistema que explica (para saber qué roles lo usan). */
  modulo: ModuleId | null;
  resumen: string;
  blocks: Block[];
  secciones: Seccion[];
}

const RAW = import.meta.glob('./manual/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function cabecera(raw: string): [Record<string, string>, string] {
  const text = raw.replace(/\r\n?/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!m) return [{}, text];
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return [meta, text.slice(m[0].length)];
}

/** Sin tildes y en minúsculas, para buscar "garantia" y encontrar "garantía". */
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function textoDe(b: Block): string {
  switch (b.t) {
    case 'p':
    case 'note':
      return b.text;
    case 'ul':
    case 'ol':
      return b.items.map((it) => [it.text, ...it.sub].join(' ')).join(' ');
    case 'table':
      return [...b.head, ...b.rows.flat()].join(' ');
    case 'h':
      return b.text;
    case 'img':
      return b.alt;
    default:
      return '';
  }
}

export const CAPITULOS: Capitulo[] = Object.keys(RAW)
  .sort()
  .map((path) => {
    const [meta, body] = cabecera(RAW[path]);
    const blocks = parse(body);
    const secciones: Seccion[] = [];
    let actual: Seccion = { id: '', titulo: meta.titulo ?? '', texto: meta.resumen ?? '' };
    // Cada subtítulo (## o ###) es una sección para la búsqueda: así se encuentra cada pregunta frecuente.
    for (const b of blocks) {
      if (b.t === 'h') {
        secciones.push(actual);
        actual = { id: b.id, titulo: plain(b.text), texto: '' };
        continue;
      }
      actual.texto += ' ' + plain(textoDe(b));
    }
    secciones.push(actual);
    return {
      id: meta.id ?? path,
      titulo: meta.titulo ?? path,
      grupo: meta.grupo ?? 'Manual',
      modulo: (meta.modulo || null) as ModuleId | null,
      resumen: meta.resumen ?? '',
      blocks,
      secciones,
    };
  });

/** Grupos del índice en el orden en que aparecen los capítulos. */
export const GRUPOS = [...new Set(CAPITULOS.map((c) => c.grupo))];

export interface Resultado {
  cap: Capitulo;
  seccion: Seccion;
  fragmento: string;
}

const veces = (texto: string, palabra: string) => texto.split(palabra).length - 1;

/** Busca todas las palabras (sin importar tildes ni mayúsculas) en cada sección del manual.
    Primero salen las secciones cuyo título contiene las palabras y después las que más las mencionan. */
export function buscar(q: string, max = 40): Resultado[] {
  const palabras = norm(q).split(/\s+/).filter((w) => w.length > 1);
  if (!palabras.length) return [];
  const hallados: Array<Resultado & { puntos: number; orden: number }> = [];
  for (const cap of CAPITULOS) {
    const tituloCap = norm(cap.titulo);
    for (const seccion of cap.secciones) {
      const texto = `${seccion.titulo} ${seccion.texto}`.replace(/\s+/g, ' ').trim();
      const n = norm(texto);
      if (!palabras.every((w) => n.includes(w))) continue;
      const titulo = norm(seccion.titulo);
      const puntos = palabras.reduce((t, w) => t + (titulo.includes(w) ? 10 : 0) + (tituloCap.includes(w) ? 3 : 0) + Math.min(veces(n, w), 5), 0);
      const at = n.indexOf(palabras[0]);
      const desde = Math.max(0, at - 50);
      const fragmento = (desde > 0 ? '…' : '') + texto.slice(desde, desde + 150).trim() + (desde + 150 < texto.length ? '…' : '');
      hallados.push({ cap, seccion, fragmento, puntos, orden: hallados.length });
    }
  }
  return hallados
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden)
    .slice(0, max)
    .map(({ cap, seccion, fragmento }) => ({ cap, seccion, fragmento }));
}
