import type { CSSProperties } from 'react';
import {
  FRAME_BAR_W, FRAME_CELL_PAD, FRAME_COLHEAD_H, FRAME_HEAD_H, FRAME_LABEL_W, FRAME_PAD, FRAME_ROW_PAD,
  type FrameCell, type FrameModel,
} from '@/lib/frame';

// The picture behind /frame.png. It is drawn by next/og (Satori), not a
// browser: every element is a flexbox, there are no tables, grids or floats,
// and any element with more than one child must say display: flex.

const PAPER = '#f6f2e9';
const INK = '#26241f';
const MUTED = '#7b756a';
const RULE = '#d8d1c2';
const TODAY_BG = '#fffdf7';
const ACCENT = '#b4532a';
const PAST_INK = '#b3ada0';

// Events that are over are faded by blending their colours towards the paper.
//
// Three things are deliberately absent from this file, because each makes the
// rasteriser crawl at 4K: opacity, overflow: hidden and one-sided borders
// (borderLeft and friends took a render from under a second to ten). Faded
// colours are blended by hand and every rule is a thin filled box.
function fade(hex: string, bg: string, amount = 0.65): string {
  const rgb = (h: string) => /^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) : null;
  const a = rgb(hex), b = rgb(bg);
  if (!a || !b) return hex;
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
}

function Cell({ m, cell, today }: { m: FrameModel; cell: FrameCell; today: boolean }) {
  const box: CSSProperties = {
    display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 0, flexBasis: 0,
    padding: `${FRAME_ROW_PAD}px ${FRAME_CELL_PAD}px`,
    backgroundColor: today ? TODAY_BG : PAPER,
  };
  return (
    <div style={{ display: 'flex', flexGrow: 1, flexShrink: 0, flexBasis: 0 }}>
     <div style={{ display: 'flex', width: 2, flexShrink: 0, backgroundColor: RULE }} />
     <div style={box}>
      {cell.items.map(it => (
        <div key={it.key} style={{ display: 'flex', marginBottom: m.itemGap, color: it.past ? PAST_INK : INK }}>
          <div style={{ display: 'flex', width: FRAME_BAR_W, borderRadius: FRAME_BAR_W / 2, backgroundColor: it.past ? fade(it.color, today ? TODAY_BG : PAPER) : it.color, marginRight: 14, flexShrink: 0 }} />
          {it.time && (
            <div style={{ display: 'flex', width: m.timeWidth, flexShrink: 0, fontSize: m.timeFontSize, fontWeight: 700, color: it.past ? PAST_INK : MUTED, lineHeight: `${Math.round(m.fontSize * m.lineHeight)}px` }}>
              {it.time}
            </div>
          )}
          <div style={{ display: 'block', flexGrow: 1, flexShrink: 1, flexBasis: 0, lineClamp: 2, fontWeight: it.time ? 400 : 700, wordBreak: 'break-word', lineHeight: `${Math.round(m.fontSize * m.lineHeight)}px` } as CSSProperties}>
            {it.title}
          </div>
        </div>
      ))}
      {cell.hidden > 0 && (
        <div style={{ display: 'flex', fontSize: m.timeFontSize, fontWeight: 700, color: MUTED }}>{`+${cell.hidden}`}</div>
      )}
     </div>
    </div>
  );
}

export default function FrameImage({ m }: { m: FrameModel }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: FRAME_PAD,
      backgroundColor: PAPER, color: INK, fontFamily: 'Noto Sans', fontSize: m.fontSize, lineHeight: m.lineHeight,
    }}>
      <div style={{ display: 'flex', height: FRAME_HEAD_H, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', fontSize: 124, fontWeight: 700, lineHeight: 1.1 }}>{m.title}</div>
        <div style={{ display: 'flex', fontSize: 60, color: MUTED, lineHeight: 1.1, marginTop: 44 }}>{m.subtitle}</div>
      </div>

      {/* one column per person */}
      <div style={{ display: 'flex', height: FRAME_COLHEAD_H }}>
        <div style={{ display: 'flex', width: FRAME_LABEL_W, flexShrink: 0 }} />
        {m.people.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'flex-end', flexGrow: 1, flexShrink: 0, flexBasis: 0,
            padding: `0 ${FRAME_CELL_PAD}px 14px ${FRAME_CELL_PAD + 2}px`,
          }}>
            <div style={{ display: 'flex', width: 28, height: 28, borderRadius: 14, backgroundColor: p.color, marginRight: 20, marginBottom: 24, flexShrink: 0 }} />
            <div style={{ display: 'block', flexGrow: 1, flexShrink: 1, flexBasis: 0, lineClamp: 1, fontSize: 64, fontWeight: 700, lineHeight: 1.15 } as CSSProperties}>{p.name}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', height: 4, flexShrink: 0, backgroundColor: INK }} />

      {/* one row per day, running down the page */}
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {m.people.length === 0 && (
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', fontSize: 96, color: MUTED }}>{m.emptyText}</div>
        )}
        {m.people.length > 0 && m.rows.map(r => (
          <div key={r.day.key} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 0, flexBasis: `${r.height}px` }}>
           <div style={{ display: 'flex', flexGrow: 1, flexShrink: 0, flexBasis: 0, backgroundColor: r.day.isToday ? TODAY_BG : PAPER }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: FRAME_LABEL_W, flexShrink: 0, padding: `${FRAME_ROW_PAD - 6}px 16px ${FRAME_ROW_PAD}px ${r.day.isToday ? 20 : 0}px` }}>
              <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.15, color: r.day.isToday || r.day.isWeekend || r.day.holiday ? ACCENT : INK }}>
                {r.day.label}
              </div>
              {r.day.holiday && (
                <div style={{ display: 'block', lineClamp: 1, fontSize: 34, color: ACCENT, lineHeight: 1.2 } as CSSProperties}>{r.day.holiday}</div>
              )}
            </div>
            {r.cells.map((cell, i) => (
              <Cell key={m.people[i].id} m={m} cell={cell} today={r.day.isToday} />
            ))}
           </div>
           <div style={{ display: 'flex', height: 2, flexShrink: 0, backgroundColor: RULE }} />
          </div>
        ))}
      </div>
    </div>
  );
}
