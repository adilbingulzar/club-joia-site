'use client';
/*
 * The sales dashboard's charts: columns over time, ranked bars and a segmented bar.
 * Every mark shows its figures on hover and keyboard focus; each chart's card also has a table
 * view (app/admin/page.tsx), so no value is only in a tooltip.
 */
import { useEffect, useRef, useState } from 'react';
import { compact, count, money } from '@/lib/admin/format';

export type Point = { key: string; label: string; value: number; detail?: string };

function fmt(v: number, as: 'money' | 'count', currency: string): string {
  return as === 'money' ? money(v, currency) : count(v);
}

// a round top for the axis and 4 steps to it
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; }).find(function (s) { return s >= raw; }) || 10 * mag;
  const top = step * 4;
  return { top, ticks: [0, step, step * 2, step * 3, top] };
}

function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(function () {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(function (entries) { setWidth(Math.max(240, Math.floor(entries[0].contentRect.width))); });
    ro.observe(el);
    return function () { ro.disconnect(); };
  }, []);
  return { ref, width };
}

/* Columns, one per day (or week): a single series in the first data color, the peak labelled. */
export function ColumnChart({ points, as, currency, height = 220, label }: { points: Point[]; as: 'money' | 'count'; currency: string; height?: number; label: string }) {
  const { ref, width } = useWidth(640);
  const [on, setOn] = useState<number | null>(null);
  const left = 52;
  const right = 8;
  const top = 18;
  const bottom = 26;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const { top: max, ticks } = niceScale(Math.max(0, ...points.map(function (p) { return p.value; })));
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.max(1, Math.min(24, band - 2, band * 0.7));
  const y = function (v: number) { return top + plotH - (v / max) * plotH; };
  const peak = points.reduce(function (b, p, i) { return p.value > (b < 0 ? -1 : points[b].value) ? i : b; }, -1);
  // about six dates along the axis
  const every = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="adm-chart" ref={ref}>
      {/* drawn at the measured width; until it is measured the viewBox scales it into the card */}
      <svg width="100%" viewBox={'0 0 ' + width + ' ' + height} style={{ maxHeight: height }} role="img" aria-label={label}>
        {ticks.map(function (t) {
          return (
            <g key={t}>
              <line className={t === 0 ? 'base' : 'gl'} x1={left} x2={width - right} y1={y(t)} y2={y(t)} />
              <text className="tick" x={left - 8} y={y(t) + 4} textAnchor="end">{compact(t)}</text>
            </g>
          );
        })}
        {points.map(function (p, i) {
          const cx = left + band * i + band / 2;
          const h = Math.max(0, y(0) - y(p.value));
          const x = cx - barW / 2;
          const r = Math.min(4, barW / 2, h);
          const yTop = y(0) - h;
          // 4px round data-end, square on the baseline
          const d = h > 0
            ? `M${x},${y(0)} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${y(0)} Z`
            : '';
          return (
            <g key={p.key}>
              {d && <path className={'col' + (on === i ? ' on' : '')} d={d} />}
              {i % every === 0 && <text className="tick" x={cx} y={height - 6} textAnchor="middle">{p.label}</text>}
              {i === peak && p.value > 0 && points.length > 1 && <text className="peak" x={cx} y={yTop - 6} textAnchor="middle">{compact(p.value)}</text>}
              <rect
                className="hit" x={left + band * i} y={top} width={band} height={plotH} tabIndex={0}
                aria-label={p.label + ': ' + fmt(p.value, as, currency) + (p.detail ? ', ' + p.detail : '')}
                onPointerEnter={function () { setOn(i); }} onPointerLeave={function () { setOn(null); }}
                onFocus={function () { setOn(i); }} onBlur={function () { setOn(null); }}
              />
            </g>
          );
        })}
      </svg>
      {on !== null && points[on] && (
        <div className="adm-tip" style={{ left: Math.min(Math.max(left + band * on + band / 2, 70), width - 70), top: y(points[on].value) }}>
          <b>{fmt(points[on].value, as, currency)}</b>
          <span>{points[on].label}{points[on].detail ? ' · ' + points[on].detail : ''}</span>
        </div>
      )}
    </div>
  );
}

/* Ranked horizontal bars, largest first, one color, the value at each bar's tip. */
export function BarList({ rows, as, currency, label }: { rows: Point[]; as: 'money' | 'count'; currency: string; label: string }) {
  const [on, setOn] = useState<number | null>(null);
  const max = Math.max(0, ...rows.map(function (r) { return r.value; }));
  return (
    <div className="adm-bars" role="list" aria-label={label}>
      {rows.map(function (r, i) {
        return (
          <div
            key={r.key} className="adm-bar" role="listitem" tabIndex={0}
            aria-label={r.label + ': ' + fmt(r.value, as, currency) + (r.detail ? ', ' + r.detail : '')}
            onPointerEnter={function () { setOn(i); }} onPointerLeave={function () { setOn(null); }}
            onFocus={function () { setOn(i); }} onBlur={function () { setOn(null); }}
          >
            <span className="name" title={r.label}>{r.label}</span>
            <span className="track">
              <span className="fill" style={{ width: max ? Math.max(0.5, (r.value / max) * 82) + '%' : '0.5%' }} />
              <span className="v">{fmt(r.value, as, currency)}{r.detail && <small>{r.detail}</small>}</span>
            </span>
            {on === i && r.detail && (
              <div className="adm-tip" style={{ left: '60%', top: 0 }}>
                <b>{fmt(r.value, as, currency)}</b>
                <span>{r.label} · {r.detail}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* One whole split into parts: tall blocks with their share printed where it fits, legend below. */
export function SegmentedBar({ parts, as, currency, label }: { parts: (Point & { color: string })[]; as: 'money' | 'count'; currency: string; label: string }) {
  const [on, setOn] = useState<number | null>(null);
  const total = parts.reduce(function (s, p) { return s + p.value; }, 0);
  if (!total) return <p className="adm-empty">No paid tickets yet.</p>;
  return (
    <div className="adm-chart">
      <div className="adm-seg" role="list" aria-label={label}>
        {parts.map(function (p, i) {
          const share = p.value / total;
          if (!p.value) return null;
          const pct = Math.round(share * 100) + '%';
          return (
            <div
              key={p.key} className="blk" role="listitem" tabIndex={0}
              style={{ flex: share, background: p.color }}
              aria-label={p.label + ': ' + fmt(p.value, as, currency) + ', ' + pct}
              onPointerEnter={function () { setOn(i); }} onPointerLeave={function () { setOn(null); }}
              onFocus={function () { setOn(i); }} onBlur={function () { setOn(null); }}
            >
              {share >= 0.1 ? pct : ''}
            </div>
          );
        })}
        {on !== null && parts[on] && (
          <div className="adm-tip" style={{ left: (parts.slice(0, on).reduce(function (s, p) { return s + p.value; }, 0) + parts[on].value / 2) / total * 100 + '%', top: 0 }}>
            <b>{fmt(parts[on].value, as, currency)}</b>
            <span>{parts[on].label} · {Math.round((parts[on].value / total) * 100)}%{parts[on].detail ? ' · ' + parts[on].detail : ''}</span>
          </div>
        )}
      </div>
      <div className="adm-legend">
        {parts.map(function (p) {
          return <span key={p.key}><i style={{ background: p.color }} />{p.label}</span>;
        })}
      </div>
    </div>
  );
}
