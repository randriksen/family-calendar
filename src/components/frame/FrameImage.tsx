import type { CSSProperties } from 'react';
import {
  FRAME_BAR_W, FRAME_CELL_PAD, FRAME_DAYHEAD_H, FRAME_HEAD_H, FRAME_LABEL_W, FRAME_PAD, FRAME_ROW_PAD,
  FRAME_TODAY_WEIGHT, type FrameCell, type FrameModel,
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

function Cell({ m, cell, weight, today }: { m: FrameModel; cell: FrameCell; weight: number; today: boolean }) {
  const box: CSSProperties = {
    display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 0, flexBasis: 0,
    padding: `${FRAME_ROW_PAD}px ${FRAME_CELL_PAD}px`,
    backgroundColor: today ? TODAY_BG : PAPER,
  };
  return (
    <div style={{ display: 'flex', flexGrow: weight, flexShrink: 0, flexBasis: 0 }}>
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
  const weights = m.days.map(d => (d.isToday ? FRAME_TODAY_WEIGHT : 1));
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: FRAME_PAD,
      backgroundColor: PAPER, color: INK, fontFamily: 'Noto Sans', fontSize: m.fontSize, lineHeight: m.lineHeight,
    }}>
      <div style={{ display: 'flex', height: FRAME_HEAD_H, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', fontSize: 124, fontWeight: 700, lineHeight: 1.1 }}>{m.title}</div>
        <div style={{ display: 'flex', fontSize: 60, color: MUTED, lineHeight: 1.1, marginTop: 44 }}>{m.subtitle}</div>
      </div>

      <div style={{ display: 'flex', height: FRAME_DAYHEAD_H }}>
        <div style={{ display: 'flex', width: FRAME_LABEL_W, flexShrink: 0 }} />
        {m.days.map((d, i) => (
          <div key={d.key} style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flexGrow: weights[i], flexShrink: 0, flexBasis: 0,
            padding: `0 ${FRAME_CELL_PAD}px 14px ${FRAME_CELL_PAD + 2}px`,
            backgroundColor: d.isToday ? TODAY_BG : PAPER,
          }}>
            {d.holiday && (
              <div style={{ display: 'block', lineClamp: 1, fontSize: 34, color: ACCENT, lineHeight: 1.2 } as CSSProperties}>{d.holiday}</div>
            )}
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.15, color: d.isToday || d.isWeekend || d.holiday ? ACCENT : INK }}>
              {d.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', height: 4, flexShrink: 0, backgroundColor: INK }} />

      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {m.rows.length === 0 && (
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', fontSize: 96, color: MUTED }}>{m.emptyText}</div>
        )}
        {m.rows.map(r => (
          <div key={r.person.id} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 0, flexBasis: `${r.height}px` }}>
           <div style={{ display: 'flex', flexGrow: 1, flexShrink: 0, flexBasis: 0 }}>
            <div style={{ display: 'flex', width: FRAME_LABEL_W, flexShrink: 0, alignItems: 'flex-start', padding: `${FRAME_ROW_PAD}px 16px ${FRAME_ROW_PAD}px 0` }}>
              <div style={{ display: 'flex', width: 28, height: 28, borderRadius: 14, backgroundColor: r.person.color, marginRight: 20, marginTop: 28, flexShrink: 0 }} />
              <div style={{ display: 'block', lineClamp: 1, fontSize: 64, fontWeight: 700, lineHeight: 1.3 } as CSSProperties}>{r.person.name}</div>
            </div>
            {r.cells.map((cell, i) => (
              <Cell key={m.days[i].key} m={m} cell={cell} weight={weights[i]} today={m.days[i].isToday} />
            ))}
           </div>
           <div style={{ display: 'flex', height: 2, flexShrink: 0, backgroundColor: RULE }} />
          </div>
        ))}
      </div>
    </div>
  );
}
