import type { CSSProperties } from 'react';
import {
  FRAME_BAR_W, FRAME_CELL_PAD, FRAME_HEAD_H, FRAME_PAD, FRAME_ROW_PAD, FRAME_SUBCOL_GAP,
  type FrameCell, type FrameDay, type FrameModel,
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

// Three things are deliberately absent from this file, because each makes the
// rasteriser crawl at 4K: opacity, overflow: hidden and one-sided borders
// (borderLeft and friends took a render from under a second to ten). Every
// rule is a thin filled box.

function Cell({ m, cell, weight, today }: { m: FrameModel; cell: FrameCell; weight: number; today: boolean }) {
  const line = `${Math.round(m.fontSize * m.lineHeight)}px`;
  return (
    <div style={{ display: 'flex', flexGrow: weight, flexShrink: 0, flexBasis: 0 }}>
     <div style={{ display: 'flex', width: 2, flexShrink: 0, backgroundColor: RULE }} />
     <div style={{
       display: 'flex', flexGrow: 1, flexShrink: 0, flexBasis: 0,
       padding: `${FRAME_ROW_PAD}px ${FRAME_CELL_PAD}px`, backgroundColor: today ? TODAY_BG : PAPER,
     }}>
      {cell.columns.map((items, c) => (
        <div key={c} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 0, flexBasis: 0, marginLeft: c > 0 ? FRAME_SUBCOL_GAP : 0 }}>
          {items.map(it => (
            <div key={it.key} style={{ display: 'flex', marginBottom: m.itemGap }}>
              <div style={{ display: 'flex', width: FRAME_BAR_W, borderRadius: FRAME_BAR_W / 2, backgroundColor: it.color, marginRight: 14, flexShrink: 0 }} />
              {it.time && (
                <div style={{ display: 'flex', width: m.timeWidth, flexShrink: 0, fontSize: m.timeFontSize, fontWeight: 700, color: MUTED, lineHeight: line }}>
                  {it.time}
                </div>
              )}
              <div style={{ display: 'block', flexGrow: 1, flexShrink: 1, flexBasis: 0, lineClamp: 2, fontWeight: it.time ? 400 : 700, wordBreak: 'break-word', lineHeight: line } as CSSProperties}>
                {it.title}
              </div>
            </div>
          ))}
          {cell.hidden > 0 && c === cell.columns.length - 1 && (
            <div style={{ display: 'flex', fontSize: m.timeFontSize, fontWeight: 700, color: MUTED }}>{`+${cell.hidden}`}</div>
          )}
        </div>
      ))}
     </div>
    </div>
  );
}

const dayColor = (d: FrameDay) => (d.isToday || d.isWeekend || d.holiday ? ACCENT : INK);

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

      {/* column headings: people in the vertical layout, days in the horizontal one */}
      <div style={{ display: 'flex', height: m.colHeadHeight }}>
        <div style={{ display: 'flex', width: m.labelWidth, flexShrink: 0 }} />
        {m.cols.map((c, i) => c.person ? (
          <div key={c.person.id} style={{
            display: 'flex', alignItems: 'flex-end', flexGrow: m.colWeights[i], flexShrink: 0, flexBasis: 0,
            padding: `0 ${FRAME_CELL_PAD}px 14px ${FRAME_CELL_PAD + 2}px`,
          }}>
            <div style={{ display: 'flex', width: 28, height: 28, borderRadius: 14, backgroundColor: c.person.color, marginRight: 20, marginBottom: 24, flexShrink: 0 }} />
            <div style={{ display: 'block', flexGrow: 1, flexShrink: 1, flexBasis: 0, lineClamp: 1, fontSize: 64, fontWeight: 700, lineHeight: 1.15 } as CSSProperties}>{c.person.name}</div>
          </div>
        ) : (
          <div key={c.day.key} style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', flexGrow: m.colWeights[i], flexShrink: 0, flexBasis: 0,
            padding: `0 ${FRAME_CELL_PAD}px 14px ${FRAME_CELL_PAD + 2}px`,
            backgroundColor: c.day.isToday ? TODAY_BG : PAPER,
          }}>
            {c.day.holiday && (
              <div style={{ display: 'block', lineClamp: 1, fontSize: 34, color: ACCENT, lineHeight: 1.2 } as CSSProperties}>{c.day.holiday}</div>
            )}
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, lineHeight: 1.15, color: dayColor(c.day) }}>{c.day.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', height: 4, flexShrink: 0, backgroundColor: INK }} />

      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        {m.empty && (
          <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', fontSize: 96, color: MUTED }}>{m.emptyText}</div>
        )}
        {!m.empty && m.rows.map(r => {
          const d = r.head.day;
          return (
          <div key={d ? d.key : r.head.person.id} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 0, flexBasis: `${r.height}px` }}>
           <div style={{ display: 'flex', flexGrow: 1, flexShrink: 0, flexBasis: 0, backgroundColor: d?.isToday ? TODAY_BG : PAPER }}>
            {d ? (
              <div style={{ display: 'flex', flexDirection: 'column', width: m.labelWidth, flexShrink: 0, padding: `${FRAME_ROW_PAD - 6}px 16px ${FRAME_ROW_PAD}px ${d.isToday ? 20 : 0}px` }}>
                <div style={{ display: 'flex', fontSize: m.labelFontSize, fontWeight: 700, lineHeight: 1.15, color: dayColor(d) }}>{d.label}</div>
                {d.holiday && (
                  <div style={{ display: 'block', lineClamp: 1, fontSize: 34, color: ACCENT, lineHeight: 1.2 } as CSSProperties}>{d.holiday}</div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', width: m.labelWidth, flexShrink: 0, alignItems: 'flex-start', padding: `${FRAME_ROW_PAD}px 16px ${FRAME_ROW_PAD}px 0` }}>
                <div style={{ display: 'flex', width: 28, height: 28, borderRadius: 14, backgroundColor: r.head.person.color, marginRight: 20, marginTop: Math.round(m.labelFontSize * 0.44), flexShrink: 0 }} />
                <div style={{ display: 'block', lineClamp: 1, fontSize: m.labelFontSize, fontWeight: 700, lineHeight: 1.3 } as CSSProperties}>{r.head.person.name}</div>
              </div>
            )}
            {r.cells.map((cell, i) => (
              <Cell key={i} m={m} cell={cell} weight={m.colWeights[i]} today={r.today[i]} />
            ))}
           </div>
           <div style={{ display: 'flex', height: 2, flexShrink: 0, backgroundColor: RULE }} />
          </div>
          );
        })}
      </div>
    </div>
  );
}
