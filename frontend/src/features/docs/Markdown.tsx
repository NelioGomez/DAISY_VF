/* Visor de Markdown del manual de usuario (mejora n.° 64). Convierte el texto de cada capítulo en
   elementos de React —nunca inserta HTML, así que es seguro— con lo que el manual necesita:
   títulos con ancla, párrafos, listas, pasos numerados, notas (> **Nota:** / **Importante:** /
   **Consejo:**), tablas, imágenes con pie (clic para ampliar), enlaces internos, teclas
   ([[Ctrl + K]]) e íconos del sistema (:ic-shopping-cart:). */
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/common/Icon';
import { IMAGENES } from './imagenes';
import type { Block, Item } from './md';

const TOKEN = /(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(`[^`]+`)|(\[\[[^\]]+\]\])|(\[[^\]]+\]\([^)\s]+\))|(:ic-[a-z0-9-]+:)/g;

function link(text: string, href: string, key: number): ReactNode {
  if (/^https?:\/\//.test(href)) {
    return (
      <a key={key} href={href} target="_blank" rel="noreferrer">
        {inline(text)}
      </a>
    );
  }
  // ?cap=ordenes o ?cap=ordenes#seccion: otro capítulo del manual.
  const to = href.startsWith('?') || href.startsWith('#') ? `/app/documentacion${href}` : href;
  return (
    <Link key={key} to={to}>
      {inline(text)}
    </Link>
  );
}

function inline(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const tok = m[0];
    if (m[1]) out.push(<strong key={k++}>{inline(tok.slice(2, -2))}</strong>);
    else if (m[2]) out.push(<em key={k++}>{inline(tok.slice(1, -1))}</em>);
    else if (m[3]) out.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    else if (m[4]) out.push(<kbd key={k++}>{tok.slice(2, -2)}</kbd>);
    else if (m[5]) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      out.push(link(lm[1], lm[2], k++));
    } else if (m[6]) {
      const name = tok.slice(4, -1);
      out.push(<Icon key={k++} name={name as IconName} size={15} className="md-ic" />);
    }
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length === 1 ? out[0] : <>{out.map((n, i) => (typeof n === 'string' ? <Fragment key={`t${i}`}>{n}</Fragment> : n))}</>;
}

const NOTE_ICON: Record<'nota' | 'importante' | 'consejo', IconName> = { nota: 'info', importante: 'triangle-alert', consejo: 'lightbulb' };

/** Texto de una línea con negritas, enlaces, teclas e íconos (resúmenes, pies de imagen). */
/** Elemento de lista con sus viñetas sangradas (un nivel). */
function ListItem({ item }: { item: Item }) {
  return (
    <li>
      {inline(item.text)}
      {item.sub.length > 0 && (
        <ul className="md-sub">
          {item.sub.map((t, k) => (
            <li key={k}>{inline(t)}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Inline({ text }: { text: string }) {
  return <>{inline(text)}</>;
}

export function Markdown({ blocks, onZoom }: { blocks: Block[]; onZoom?: (img: { src: string; alt: string }) => void }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h':
            return b.level === 2 ? (
              <h2 key={i} id={b.id} tabIndex={-1}>
                {inline(b.text)}
              </h2>
            ) : (
              <h3 key={i} id={b.id} tabIndex={-1}>
                {inline(b.text)}
              </h3>
            );
          case 'p':
            return <p key={i}>{inline(b.text)}</p>;
          case 'ul':
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <ListItem key={j} item={it} />
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="md-steps" start={b.start} style={b.start > 1 ? { counterReset: `paso ${b.start - 1}` } : undefined}>
                {b.items.map((it, j) => (
                  <ListItem key={j} item={it} />
                ))}
              </ol>
            );
          case 'note':
            return (
              <div key={i} className={`md-note is-${b.kind}`} role="note">
                <Icon name={NOTE_ICON[b.kind]} size={18} />
                <div>{inline(b.text)}</div>
              </div>
            );
          case 'img': {
            // Con el tamaño conocido, la página reserva el espacio y no salta mientras carga la imagen.
            const [w, h] = IMAGENES[b.src.replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '')] ?? [];
            return (
              <figure key={i} className="md-fig">
                <button type="button" className="md-fig-btn" onClick={() => onZoom?.({ src: b.src, alt: b.alt })} title="Ampliar la imagen">
                  <img src={b.src} alt={b.alt} width={w} height={h} loading="lazy" decoding="async" />
                </button>
                {b.alt && <figcaption>{inline(b.alt)}</figcaption>}
              </figure>
            );
          }
          case 'table':
            return (
              <div key={i} className="md-table">
                <table>
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j}>{inline(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, x) => (
                          <td key={x}>{inline(c)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'hr':
            return <hr key={i} />;
        }
      })}
    </>
  );
}
