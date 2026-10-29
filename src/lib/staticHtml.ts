import type { ReactNode } from 'react';

// Minimal static renderer for React elements, used by the lite route.
//
// Next.js forbids react-dom/server inside app-dir route handlers, and a page
// would ship the whole Next/React runtime to the browser. The lite views use
// only host elements and plain function components — no hooks, no context,
// no portals — so a ~60-line serializer is all that's needed to turn JSX into
// an HTML string with zero client JavaScript.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ATTR_NAMES: Record<string, string> = {
  className: 'class',
  htmlFor: 'for',
  httpEquiv: 'http-equiv',
  charSet: 'charset',
  acceptCharset: 'accept-charset',
  tabIndex: 'tabindex',
};
const FRAGMENT = Symbol.for('react.fragment');

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  ));
}

function styleToString(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${String(v)}`)
    .join(';');
}

function attrs(props: Record<string, unknown>): string {
  let out = '';
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || key === 'dangerouslySetInnerHTML' || key === 'key' || key === 'ref') continue;
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') continue;
    const name = ATTR_NAMES[key] ?? key;
    if (key === 'style' && typeof value === 'object') {
      const css = styleToString(value as Record<string, unknown>);
      if (css) out += ` style="${escapeHtml(css)}"`;
      continue;
    }
    if (value === true) { out += ` ${name}`; continue; }
    out += ` ${name}="${escapeHtml(String(value))}"`;
  }
  return out;
}

export function renderStatic(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string') return escapeHtml(node);
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(renderStatic).join('');

  // From here on it is a React element: { type, props }.
  const el = node as unknown as { type: unknown; props: Record<string, unknown> };
  const { type, props } = el;

  if (type === FRAGMENT) return renderStatic(props.children as ReactNode);
  if (typeof type === 'function') {
    return renderStatic((type as (p: Record<string, unknown>) => ReactNode)(props));
  }
  if (typeof type !== 'string') {
    throw new Error(`renderStatic: unsupported element type ${String(type)}`);
  }

  const open = `<${type}${attrs(props)}>`;
  if (VOID.has(type)) return open;

  const raw = props.dangerouslySetInnerHTML as { __html?: string } | undefined;
  const inner = raw?.__html !== undefined ? String(raw.__html) : renderStatic(props.children as ReactNode);
  return `${open}${inner}</${type}>`;
}
