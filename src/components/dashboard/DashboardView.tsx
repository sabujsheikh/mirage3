import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { InvoiceModal } from '../orders/InvoiceModal';
import { Order } from '../../types';

// ============================================================================
// MIRAGE SVG INTERACTIVE LINE CHART (Interactive crosshairs, highlight dots & tooltips)
// ============================================================================
interface SvgLineProps {
  labels: string[];
  seriesA: number[];
  seriesB: number[];
  max: number;
  colorA?: string;
  colorB?: string;
  strokeWidthA?: number;
  strokeWidthB?: number;
  labelA?: string;
  labelB?: string;
  formatA?: (v: number) => string;
  formatB?: (v: number) => string;
}

const MirageInteractiveLineChart: React.FC<SvgLineProps> = ({
  labels,
  seriesA,
  seriesB,
  max,
  colorA = '#16324F',
  colorB = '#B8860B',
  strokeWidthA = 2.5,
  strokeWidthB = 2,
  labelA = 'Series A',
  labelB = 'Series B',
  formatA,
  formatB,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartWidth, setChartWidth] = useState<number>(800);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 50) {
          setChartWidth(Math.round(rect.width));
        }
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const w = chartWidth;
  const h = 240;
  const p = { l: 52, r: 24, t: 18, b: 28 };
  const iw = Math.max(10, w - p.l - p.r);
  const ih = Math.max(10, h - p.t - p.b);

  const x = (i: number) => p.l + (iw * i) / Math.max(1, labels.length - 1);
  const y = (v: number) => p.t + ih - (v / (max || 1)) * ih;

  const gridLines = [];
  for (let i = 0; i < 5; i++) {
    const yy = p.t + (ih * i) / 4;
    const val = max * (1 - i / 4);
    gridLines.push({
      y: yy,
      label: val >= 1000 ? `৳${Math.round(val / 1000)}k` : `৳${Math.round(val)}`,
    });
  }

  const dA = seriesA.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join(' ');
  const dB = seriesB.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join(' ');

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const plotWidth = iw;
    if (plotWidth <= 0) return;

    const clampedX = Math.max(0, Math.min(plotWidth, clientX - p.l));
    const ratio = clampedX / plotWidth;
    const idx = Math.round(ratio * (labels.length - 1));
    setHoveredIndex(idx);
  };

  const defaultFormat = (v: number) => `৳${v.toLocaleString()}`;
  const fmtA = formatA || defaultFormat;
  const fmtB = formatB || defaultFormat;

  return (
    <div
      ref={containerRef}
      className="mirage-chart"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoveredIndex(null)}
      style={{ cursor: 'crosshair', position: 'relative' }}
    >
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full block">
        {gridLines.map((g, idx) => (
          <React.Fragment key={idx}>
            <line x1={p.l} x2={w - p.r} y1={g.y} y2={g.y} stroke="#F1F5F9" strokeWidth="1" />
            <text x={p.l - 8} y={g.y + 3.5} textAnchor="end" fontSize="10" fill="#64748B" fontFamily="Inter, sans-serif" fontWeight="500">
              {g.label}
            </text>
          </React.Fragment>
        ))}
        {labels.map((l, i) => (
          <text
            key={i}
            x={x(i)}
            y={h - 6}
            textAnchor="middle"
            fontSize="10"
            fill={hoveredIndex === i ? '#0F172A' : '#64748B'}
            fontWeight={hoveredIndex === i ? '700' : '400'}
            fontFamily="Inter, sans-serif"
          >
            {l}
          </text>
        ))}
        <path
          d={dA}
          fill="none"
          stroke={colorA}
          strokeWidth={strokeWidthA}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={dB}
          fill="none"
          stroke={colorB}
          strokeWidth={strokeWidthB}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dynamic vertical guideline and highlight circles on hover */}
        {hoveredIndex !== null && (
          <g>
            <line
              x1={x(hoveredIndex)}
              x2={x(hoveredIndex)}
              y1={p.t}
              y2={p.t + ih}
              stroke="#64748B"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {/* Circle highlight for Series A */}
            <circle
              cx={x(hoveredIndex)}
              cy={y(seriesA[hoveredIndex])}
              r="7"
              fill={colorA}
              fillOpacity="0.25"
            />
            <circle
              cx={x(hoveredIndex)}
              cy={y(seriesA[hoveredIndex])}
              r="4"
              fill="#FFFFFF"
              stroke={colorA}
              strokeWidth="2.5"
            />
            {/* Circle highlight for Series B */}
            <circle
              cx={x(hoveredIndex)}
              cy={y(seriesB[hoveredIndex])}
              r="7"
              fill={colorB}
              fillOpacity="0.25"
            />
            <circle
              cx={x(hoveredIndex)}
              cy={y(seriesB[hoveredIndex])}
              r="4"
              fill="#FFFFFF"
              stroke={colorB}
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>

      {/* Floating interactive tooltip */}
      {hoveredIndex !== null && (
        <div
          className="mirage-chart-tooltip"
          style={{
            left: `${x(hoveredIndex)}px`,
            top: `${Math.max(12, Math.min(68, (Math.min(y(seriesA[hoveredIndex]), y(seriesB[hoveredIndex])) / h) * 100))}%`,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '4px', color: '#F1F5F9', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '3px' }}>
            {labels[hoveredIndex]}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '10.5px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#E2E8F0' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorA, display: 'inline-block' }} />
              {labelA}:
            </span>
            <b style={{ color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
              {fmtA(seriesA[hoveredIndex])}
            </b>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '10.5px', marginTop: '3px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#E2E8F0' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorB, display: 'inline-block' }} />
              {labelB}:
            </span>
            <b style={{ color: '#FDE047', fontVariantNumeric: 'tabular-nums' }}>
              {fmtB(seriesB[hoveredIndex])}
            </b>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DAILY INCOME & CASH COLLECTION CHART (15/30 Days Interactive Inflow Map)
// ============================================================================
interface DailyIncomeProps {
  onNavigateToTill: () => void;
  embedded?: boolean;
}

const DailyIncomeCollectionChart: React.FC<DailyIncomeProps> = ({ onNavigateToTill, embedded }) => {
  const [range, setRange] = useState<'15D' | '30D'>('15D');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(900);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 50) {
          setChartWidth(Math.round(rect.width));
        }
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const data15 = useMemo(() => [
    { date: '23 Aug', total: 28400, bkash: 14200, cash: 8200, cod: 6000 },
    { date: '24 Aug', total: 32150, bkash: 16800, cash: 9350, cod: 6000 },
    { date: '25 Aug', total: 26800, bkash: 13400, cash: 7900, cod: 5500 },
    { date: '26 Aug', total: 22500, bkash: 11500, cash: 6500, cod: 4500 },
    { date: '27 Aug', total: 36400, bkash: 18200, cash: 10400, cod: 7800 },
    { date: '28 Aug', total: 31200, bkash: 15600, cash: 9100, cod: 6500 },
    { date: '29 Aug', total: 41500, bkash: 21200, cash: 12300, cod: 8000 },
    { date: '30 Aug', total: 38900, bkash: 19800, cash: 11100, cod: 8000 },
    { date: '31 Aug', total: 46200, bkash: 23500, cash: 14200, cod: 8500 },
    { date: '01 Sep', total: 39800, bkash: 20400, cash: 11400, cod: 8000 },
    { date: '02 Sep', total: 34600, bkash: 17800, cash: 9800, cod: 7000 },
    { date: '03 Sep', total: 29500, bkash: 15200, cash: 8300, cod: 6000 },
    { date: '04 Sep', total: 37200, bkash: 19100, cash: 10600, cod: 7500 },
    { date: '05 Sep', total: 43800, bkash: 22400, cash: 12900, cod: 8500 },
    { date: '06 Sep', total: 35400, bkash: 18200, cash: 10200, cod: 7000 },
  ], []);

  const data30 = useMemo(() => [
    { date: '08 Aug', total: 24200, bkash: 12100, cash: 7100, cod: 5000 },
    { date: '09 Aug', total: 26800, bkash: 13500, cash: 7800, cod: 5500 },
    { date: '10 Aug', total: 31500, bkash: 16000, cash: 9500, cod: 6000 },
    { date: '11 Aug', total: 29400, bkash: 14800, cash: 8600, cod: 6000 },
    { date: '12 Aug', total: 34200, bkash: 17500, cash: 10200, cod: 6500 },
    { date: '13 Aug', total: 37800, bkash: 19400, cash: 11400, cod: 7000 },
    { date: '14 Aug', total: 42100, bkash: 21500, cash: 12600, cod: 8000 },
    { date: '15 Aug', total: 48500, bkash: 25000, cash: 14500, cod: 9000 },
    { date: '16 Aug', total: 36200, bkash: 18400, cash: 10800, cod: 7000 },
    { date: '17 Aug', total: 30100, bkash: 15300, cash: 8800, cod: 6000 },
    { date: '18 Aug', total: 33400, bkash: 17100, cash: 9800, cod: 6500 },
    { date: '19 Aug', total: 39600, bkash: 20200, cash: 11900, cod: 7500 },
    { date: '20 Aug', total: 35800, bkash: 18200, cash: 10600, cod: 7000 },
    { date: '21 Aug', total: 28900, bkash: 14700, cash: 8700, cod: 5500 },
    { date: '22 Aug', total: 31000, bkash: 15800, cash: 9200, cod: 6000 },
    ...data15,
  ], [data15]);

  const rawActiveData = range === '15D' ? data15 : data30;
  const activeData = useMemo(() => (Array.isArray(rawActiveData) ? rawActiveData : []), [rawActiveData]);
  const totalPeriod = useMemo(() => activeData.reduce((acc, d) => acc + (d?.total || 0), 0), [activeData]);
  const avgPeriod = useMemo(() => Math.round(totalPeriod / Math.max(1, activeData.length)), [totalPeriod, activeData]);
  const maxVal = useMemo(() => (activeData.length > 0 ? Math.max(...activeData.map(d => d?.total || 0)) : 1000), [activeData]);
  const codTotal = useMemo(() => activeData.reduce((acc, d) => acc + (d?.cod || 0), 0), [activeData]);
  const peakItem = useMemo(() => activeData.reduce((max, d) => ((d?.total || 0) > (max?.total || 0) ? d : max), activeData[0] || { total: 0, cod: 0, bkash: 0, cash: 0, date: '' }), [activeData]);

  const w = chartWidth;
  const h = 240;
  const p = { l: 52, r: 24, t: 20, b: 28 };
  const iw = Math.max(10, w - p.l - p.r);
  const ih = Math.max(10, h - p.t - p.b);

  const maxChart = Math.ceil((maxVal * 1.15) / 10000) * 10000;

  const x = (i: number) => p.l + (iw * i) / Math.max(1, activeData.length - 1);
  const y = (v: number) => p.t + ih - (v / maxChart) * ih;

  const gridLines = [];
  for (let i = 0; i < 5; i++) {
    const yy = p.t + (ih * i) / 4;
    const val = maxChart * (1 - i / 4);
    gridLines.push({
      y: yy,
      label: `৳${Math.round(val / 1000)}k`,
    });
  }

  const linePath = activeData.map((d, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(d.total)).join(' ');
  const areaPath = linePath + ` L${x(activeData.length - 1)} ${p.t + ih} L${x(0)} ${p.t + ih} Z`;
  const bkashLine = activeData.map((d, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(d.bkash)).join(' ');

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const plotWidth = iw;
    if (plotWidth <= 0) return;

    const clampedX = Math.max(0, Math.min(plotWidth, clientX - p.l));
    const ratio = clampedX / plotWidth;
    const idx = Math.round(ratio * (activeData.length - 1));
    setHoveredIdx(idx);
  };

  const currentHover = hoveredIdx !== null ? activeData[hoveredIdx] : null;

  return (
    <div className={embedded ? "" : "mirage-card mirage-pad"} style={{ marginBottom: embedded ? '0' : '14px' }}>
      {!embedded ? (
        <div className="mirage-cardhead" style={{ marginBottom: '10px' }}>
          <div>
            <div className="mirage-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Daily income & cash collection</span>
              <span className="mirage-pill green" style={{ fontSize: '9.5px', padding: '3px 8px' }}>Active Liquid Inflow</span>
            </div>
            <div className="mirage-subtitle">
              Actual cash, bKash/Nagad and Steadfast courier COD settlements received daily
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="mirage-tabs" style={{ margin: 0, border: 0, gap: '4px' }}>
              <button
                className={`mirage-tab ${range === '15D' ? 'active' : ''}`}
                onClick={() => setRange('15D')}
                style={{ padding: '4px 10px', borderRadius: '5px', border: range === '15D' ? '1px solid #16324F' : '1px solid #E5E5E5' }}
              >
                15 Days
              </button>
              <button
                className={`mirage-tab ${range === '30D' ? 'active' : ''}`}
                onClick={() => setRange('30D')}
                style={{ padding: '4px 10px', borderRadius: '5px', border: range === '30D' ? '1px solid #16324F' : '1px solid #E5E5E5' }}
              >
                30 Days
              </button>
            </div>
            <button className="mirage-link" onClick={onNavigateToTill}>
              Daily till →
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Daily Liquid Inflow Trends (Cash, MFS & COD Settlements)</span>
            <span className="mirage-pill green" style={{ fontSize: '9px', padding: '2px 7px' }}>Live Till Inflows</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="mirage-tabs" style={{ margin: 0, border: 0, gap: '4px' }}>
              <button
                type="button"
                className={`mirage-tab ${range === '15D' ? 'active' : ''}`}
                onClick={() => setRange('15D')}
                style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10.5px', border: range === '15D' ? '1px solid #16324F' : '1px solid #E2E8F0' }}
              >
                15 Days
              </button>
              <button
                type="button"
                className={`mirage-tab ${range === '30D' ? 'active' : ''}`}
                onClick={() => setRange('30D')}
                style={{ padding: '3px 8px', borderRadius: '5px', fontSize: '10.5px', border: range === '30D' ? '1px solid #16324F' : '1px solid #E2E8F0' }}
              >
                30 Days
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mini metric strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
        <div className="mirage-miniStat">
          <strong>৳{totalPeriod.toLocaleString()}</strong>
          <span>Total received ({range})</span>
        </div>
        <div className="mirage-miniStat">
          <strong>৳{avgPeriod.toLocaleString()}</strong>
          <span>Daily average inflow</span>
        </div>
        <div className="mirage-miniStat">
          <strong style={{ color: '#16A34A' }}>৳{peakItem.total.toLocaleString()}</strong>
          <span>Peak day ({peakItem.date})</span>
        </div>
        <div className="mirage-miniStat">
          <strong style={{ color: '#0891B2' }}>৳{codTotal.toLocaleString()}</strong>
          <span>Steadfast COD settled</span>
        </div>
      </div>

      {/* Interactive Chart */}
      <div
        ref={containerRef}
        className="mirage-chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredIdx(null)}
        style={{ height: '240px', cursor: 'crosshair', position: 'relative' }}
      >
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full block">
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16324F" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#16324F" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {gridLines.map((g, idx) => (
            <React.Fragment key={idx}>
              <line x1={p.l} x2={w - p.r} y1={g.y} y2={g.y} stroke="#F1F5F9" strokeWidth="1" />
              <text x={p.l - 8} y={g.y + 3.5} textAnchor="end" fontSize="10" fill="#64748B" fontFamily="Inter, sans-serif" fontWeight="500">
                {g.label}
              </text>
            </React.Fragment>
          ))}

          {activeData.map((d, i) => {
            const showLabel = range === '15D' ? true : i % 3 === 0 || i === activeData.length - 1;
            if (!showLabel) return null;
            return (
              <text
                key={i}
                x={x(i)}
                y={h - 6}
                textAnchor="middle"
                fontSize="10"
                fill={hoveredIdx === i ? '#0F172A' : '#64748B'}
                fontWeight={hoveredIdx === i ? '700' : '400'}
                fontFamily="Inter, sans-serif"
              >
                {d.date}
              </text>
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#incomeGradient)" />

          {/* Total Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#16324F"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* bKash secondary line */}
          <path
            d={bkashLine}
            fill="none"
            stroke="#0891B2"
            strokeWidth={1.8}
            strokeDasharray="4 3"
            strokeLinecap="round"
          />

          {/* Hover Crosshair & Dots */}
          {hoveredIdx !== null && currentHover && (
            <g>
              <line
                x1={x(hoveredIdx)}
                x2={x(hoveredIdx)}
                y1={p.t}
                y2={p.t + ih}
                stroke="#64748B"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
              <circle
                cx={x(hoveredIdx)}
                cy={y(currentHover.total)}
                r="7"
                fill="#16324F"
                fillOpacity="0.25"
              />
              <circle
                cx={x(hoveredIdx)}
                cy={y(currentHover.total)}
                r="4"
                fill="#FFFFFF"
                stroke="#16324F"
                strokeWidth="2.5"
              />
              <circle
                cx={x(hoveredIdx)}
                cy={y(currentHover.bkash)}
                r="3.5"
                fill="#FFFFFF"
                stroke="#0891B2"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoveredIdx !== null && currentHover && (
          <div
            className="mirage-chart-tooltip"
            style={{
              left: `${x(hoveredIdx)}px`,
              top: `${Math.max(12, (y(currentHover.total) / h) * 100)}%`,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '5px', color: '#F8FAFC', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '3px' }}>
              {currentHover.date} 2026 Collection
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '11px', fontWeight: 700 }}>
              <span style={{ color: '#E2E8F0' }}>Total Received:</span>
              <b style={{ color: '#38BDF8' }}>৳{currentHover.total.toLocaleString()}</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '10px', marginTop: '4px', color: '#CBD5E1' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0891B2' }} />
                bKash / Nagad:
              </span>
              <span>৳{currentHover.bkash.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '10px', marginTop: '2px', color: '#CBD5E1' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A' }} />
                Cash Till / Delivery:
              </span>
              <span>৳{currentHover.cash.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', fontSize: '10px', marginTop: '2px', color: '#CBD5E1' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#B8860B' }} />
                Steadfast COD Payout:
              </span>
              <span>৳{currentHover.cod.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mirage-legend" style={{ marginTop: '10px', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>
            <i style={{ background: '#16324F' }}></i>Total Daily Inflow
          </span>
          <span>
            <i style={{ background: '#0891B2' }}></i>bKash / MFS (Online)
          </span>
          <span>
            <i style={{ background: '#16A34A' }}></i>Cash (Shop + Hand-delivery)
          </span>
          <span>
            <i style={{ background: '#B8860B' }}></i>Courier COD Settlement
          </span>
        </div>
        <div style={{ fontSize: '9.5px', color: '#6B6B6B' }}>
          Updated with every confirmed till settlement & courier bank payout
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MIRAGE SVG DONUT CHART (100% fidelity to demo SVG donut geometry)
// ============================================================================
interface SvgDonutProps {
  values: number[];
  colors: string[];
  total: number;
  label: string;
  size?: number;
}

const MirageDonutChart: React.FC<SvgDonutProps> = ({ values, colors, total, label, size = 100 }) => {
  const r = 42;
  const c = 2 * Math.PI * r;
  let off = 0;

  const circles = values.map((v, i) => {
    const len = (c * v) / (total || 1);
    const strokeDasharray = `${len} ${c - len}`;
    const strokeDashoffset = -off;
    off += len;
    return (
      <circle
        key={i}
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={colors[i]}
        strokeWidth="15"
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        transform="rotate(-90 60 60)"
      />
    );
  });

  return (
    <div style={{ height: `${size + 10}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg viewBox="0 0 120 120" style={{ width: `${size}px`, height: `${size}px` }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F0F0EE" strokeWidth="15" />
        {circles}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fontSize="13"
          fontWeight="800"
          fill="#222"
          fontFamily="Inter, sans-serif"
        >
          {label}
        </text>
        <text
          x="60"
          y="70"
          textAnchor="middle"
          fontSize="8"
          fill="#6B6B6B"
          fontFamily="Inter, sans-serif"
        >
          {total} total
        </text>
      </svg>
    </div>
  );
};

// ============================================================================
// DASHBOARD PERIOD CONFIGURATION (15D Default, 7D, 30D, 90D, 1Y, Lifetime)
// ============================================================================
export type DashboardPeriodKey = '15D' | '7D' | '30D' | '90D' | '1Y' | 'ALL';

interface PeriodDetail {
  key: DashboardPeriodKey;
  label: string;
  badge?: string;
  desc: string;
  revenue: number;
  revenueGrowth: string;
  grossProfit: number;
  grossMargin: string;
  netProfit: number;
  netMargin: string;
  ordersCount: number;
  ordersGrowth: string;
  chartLabels: string[];
  chartRevenueSeries: number[];
  chartOrderSeries: number[];
  chartGrossProfitSeries: number[];
  chartNetProfitSeries: number[];
  chartMaxRevenue: number;
  chartMaxProfit: number;
  chartSubtitleRevenue: string;
  chartSubtitleProfit: string;
}

const DASHBOARD_PERIODS: Record<DashboardPeriodKey, PeriodDetail> = {
  '15D': {
    key: '15D',
    label: '15 Days',
    badge: 'Default',
    desc: 'Last 15 days operational trend',
    revenue: 398500,
    revenueGrowth: '▲ 14.2%',
    grossProfit: 143060,
    grossMargin: '35.9%',
    netProfit: 91250,
    netMargin: '22.9%',
    ordersCount: 138,
    ordersGrowth: '▲ 11.5%',
    chartLabels: ['18 Aug', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '01 Sep'],
    chartRevenueSeries: [24500, 29800, 26400, 21200, 23800, 28400, 32150, 26800, 22500, 36400, 31200, 41500, 38900, 46200, 39800],
    chartOrderSeries: [16000, 19000, 17000, 14000, 15000, 18000, 21000, 17000, 15000, 23000, 20000, 27000, 25000, 30000, 26000],
    chartGrossProfitSeries: [8800, 10700, 9500, 7600, 8500, 10200, 11500, 9600, 8100, 13100, 11200, 14900, 14000, 16600, 14300],
    chartNetProfitSeries: [5600, 6800, 6000, 4900, 5400, 6500, 7400, 6100, 5100, 8300, 7100, 9500, 8900, 10600, 9100],
    chartMaxRevenue: 50000,
    chartMaxProfit: 20000,
    chartSubtitleRevenue: '৳398,500 booked revenue · 138 orders confirmed (Last 15 Days)',
    chartSubtitleProfit: '৳143,060 gross profit (35.9%) · ৳91,250 net profit (22.9%)',
  },
  '7D': {
    key: '7D',
    label: '7 Days',
    desc: 'Last 7 days (Past week)',
    revenue: 186420,
    revenueGrowth: '▲ 12.8%',
    grossProfit: 66940,
    grossMargin: '35.9%',
    netProfit: 42680,
    netMargin: '22.9%',
    ordersCount: 64,
    ordersGrowth: '▲ 9.3%',
    chartLabels: ['26 Aug', '27', '28', '29', '30', '31', '01 Sep'],
    chartRevenueSeries: [22000, 28000, 25000, 36000, 31000, 45000, 39000],
    chartOrderSeries: [14000, 18000, 16000, 22000, 20000, 26000, 24000],
    chartGrossProfitSeries: [7900, 10050, 8970, 12900, 11130, 16150, 14000],
    chartNetProfitSeries: [5000, 6400, 5700, 8200, 7100, 10300, 8900],
    chartMaxRevenue: 50000,
    chartMaxProfit: 18000,
    chartSubtitleRevenue: '৳186,420 booked revenue · 64 orders confirmed (Last 7 Days)',
    chartSubtitleProfit: '৳66,940 gross profit (35.9%) · ৳42,680 net profit (22.9%)',
  },
  '30D': {
    key: '30D',
    label: '30 Days',
    desc: 'Last 30 days (Past month)',
    revenue: 782400,
    revenueGrowth: '▲ 16.4%',
    grossProfit: 280880,
    grossMargin: '35.9%',
    netProfit: 179170,
    netMargin: '22.9%',
    ordersCount: 272,
    ordersGrowth: '▲ 12.8%',
    chartLabels: ['03 Aug', '05', '07', '09', '11', '13', '15', '17', '19', '21', '23', '25', '27', '29', '01 Sep'],
    chartRevenueSeries: [24000, 28500, 31000, 27000, 34000, 39000, 48000, 32000, 39000, 30000, 28400, 26800, 36400, 41500, 39800],
    chartOrderSeries: [15000, 18000, 20000, 17000, 22000, 25000, 31000, 21000, 25000, 19000, 18000, 17000, 23000, 27000, 26000],
    chartGrossProfitSeries: [8600, 10200, 11100, 9700, 12200, 14000, 17200, 11500, 14000, 10800, 10200, 9600, 13100, 14900, 14300],
    chartNetProfitSeries: [5500, 6500, 7100, 6200, 7800, 8900, 11000, 7300, 8900, 6900, 6500, 6100, 8300, 9500, 9100],
    chartMaxRevenue: 55000,
    chartMaxProfit: 20000,
    chartSubtitleRevenue: '৳782,400 booked revenue · 272 orders confirmed (Last 30 Days)',
    chartSubtitleProfit: '৳280,880 gross profit (35.9%) · ৳179,170 net profit (22.9%)',
  },
  '90D': {
    key: '90D',
    label: '90 Days',
    desc: 'Past 3 months quarterly view',
    revenue: 2340000,
    revenueGrowth: '▲ 18.5%',
    grossProfit: 840060,
    grossMargin: '35.9%',
    netProfit: 535860,
    netMargin: '22.9%',
    ordersCount: 815,
    ordersGrowth: '▲ 15.2%',
    chartLabels: ['W1 Jun', 'W2 Jun', 'W3 Jun', 'W4 Jun', 'W1 Jul', 'W2 Jul', 'W3 Jul', 'W4 Jul', 'W1 Aug', 'W2 Aug', 'W3 Aug', 'W4 Aug'],
    chartRevenueSeries: [165000, 182000, 174000, 195000, 190000, 212000, 205000, 225000, 218000, 230000, 248000, 262000],
    chartOrderSeries: [105000, 118000, 112000, 128000, 122000, 136000, 132000, 145000, 140000, 148000, 160000, 170000],
    chartGrossProfitSeries: [59000, 65300, 62500, 70000, 68200, 76100, 73600, 80800, 78300, 82600, 89000, 94000],
    chartNetProfitSeries: [37800, 41700, 39800, 44600, 43500, 48500, 46900, 51500, 49900, 52600, 56800, 60000],
    chartMaxRevenue: 300000,
    chartMaxProfit: 110000,
    chartSubtitleRevenue: '৳2,340,000 booked revenue · 815 orders confirmed (Last 90 Days)',
    chartSubtitleProfit: '৳840,060 gross profit (35.9%) · ৳535,860 net profit (22.9%)',
  },
  '1Y': {
    key: '1Y',
    label: '1 Year',
    desc: 'Trailing 12 months annual view',
    revenue: 8950000,
    revenueGrowth: '▲ 24.8%',
    grossProfit: 3213050,
    grossMargin: '35.9%',
    netProfit: 2049550,
    netMargin: '22.9%',
    ordersCount: 3120,
    ordersGrowth: '▲ 21.0%',
    chartLabels: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    chartRevenueSeries: [620000, 690000, 860000, 740000, 670000, 790000, 880000, 850000, 790000, 860000, 950000, 1020000],
    chartOrderSeries: [400000, 440000, 550000, 470000, 430000, 510000, 560000, 540000, 510000, 550000, 610000, 650000],
    chartGrossProfitSeries: [222000, 247000, 308000, 265000, 240000, 283000, 315000, 305000, 283000, 308000, 341000, 366000],
    chartNetProfitSeries: [142000, 158000, 197000, 169000, 153000, 181000, 201000, 195000, 181000, 197000, 218000, 234000],
    chartMaxRevenue: 1200000,
    chartMaxProfit: 400000,
    chartSubtitleRevenue: '৳8,950,000 booked revenue · 3,120 orders confirmed (1 Year)',
    chartSubtitleProfit: '৳3,213,050 gross profit (35.9%) · ৳2,049,550 net profit (22.9%)',
  },
  'ALL': {
    key: 'ALL',
    label: 'All Time',
    desc: 'All historical business records',
    revenue: 16420000,
    revenueGrowth: 'Lifetime',
    grossProfit: 5894780,
    grossMargin: '35.9%',
    netProfit: 3760180,
    netMargin: '22.9%',
    ordersCount: 5740,
    ordersGrowth: 'Cumulative',
    chartLabels: ['Q4 24', 'Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26', 'Q3 26'],
    chartRevenueSeries: [1450000, 1750000, 1980000, 2200000, 2450000, 2620000, 2780000, 3190000],
    chartOrderSeries: [930000, 1120000, 1270000, 1410000, 1570000, 1680000, 1780000, 2040000],
    chartGrossProfitSeries: [520000, 628000, 710000, 790000, 879000, 940000, 998000, 1145000],
    chartNetProfitSeries: [332000, 401000, 453000, 504000, 561000, 600000, 637000, 730000],
    chartMaxRevenue: 3500000,
    chartMaxProfit: 1300000,
    chartSubtitleRevenue: '৳16,420,000 booked revenue · 5,740 orders confirmed (All Time)',
    chartSubtitleProfit: '৳5,894,780 gross profit (35.9%) · ৳3,760,180 net profit (22.9%)',
  },
};

// ============================================================================
// MAIN DASHBOARD VIEW
// ============================================================================
export const DashboardView: React.FC = () => {
  const { orders, setActivePath } = useApp();
  const { currentUser } = useAuth();

  const [activePeriod, setActivePeriod] = useState<DashboardPeriodKey>('15D');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState<boolean>(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);

  const [chartView, setChartView] = useState<'REVENUE' | 'PROFIT' | 'DAILY_INFLOW' | 'SPLIT'>('REVENUE');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<boolean>(false);
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState<Order | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const curPeriod = DASHBOARD_PERIODS[activePeriod];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  const go = (path: string) => {
    setActivePath(path);
  };

  // Recent orders list - seeded from live orders if present or default demo fixtures
  const recentOrdersData = useMemo(() => {
    const defaultData = [
      {
        id: 'MP-260901-064',
        customer: 'Arif Islam',
        phone: '01999033027',
        channel: 'Messenger',
        status: 'Packing',
        statusPill: 'amber',
        payment: 'Cash on delivery',
        total: '6,220',
        deliveryCharge: '70',
        fulfillment: 'Steadfast',
        initials: 'AI',
      },
      {
        id: 'MP-260901-063',
        customer: 'Nusrat Jahan',
        phone: '01712021891',
        channel: 'Walk-in',
        status: 'Delivered',
        statusPill: 'green',
        payment: 'bKash',
        total: '4,850',
        deliveryCharge: '0',
        fulfillment: 'Walk-in handoff',
        initials: 'NJ',
      },
      {
        id: 'MP-260901-062',
        customer: 'Tanvir Ahmed',
        phone: '01844123302',
        channel: 'Messenger',
        status: 'Dispatched',
        statusPill: 'teal',
        payment: 'Cash on delivery',
        total: '3,400',
        deliveryCharge: '70',
        fulfillment: 'Steadfast',
        initials: 'TA',
      },
      {
        id: 'MP-260901-061',
        customer: 'Maliha Rahman',
        phone: '01671022441',
        channel: 'Messenger',
        status: 'Delivered',
        statusPill: 'green',
        payment: 'Cash on delivery',
        total: '7,120',
        deliveryCharge: '70',
        fulfillment: 'In-house',
        initials: 'MR',
      },
    ];

    if (orders && orders.length > 0) {
      // Map up to 4 real orders, falling back to defaults if sparse
      const mapped = orders.slice(0, 4).map(o => {
        let pill = 'amber';
        if (o.status === 'delivered') pill = 'green';
        else if (o.status === 'dispatched') pill = 'teal';
        else if (o.status === 'cancelled' || o.status === 'rto') pill = 'red';

        const nameParts = (o.customer_name || 'Customer').split(' ');
        const initials = nameParts.map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'CU';

        const paymentMethod = o.payments?.[0]?.method;
        const paymentLabel = paymentMethod === 'cash' ? 'Cash' : paymentMethod === 'bkash' ? 'bKash' : paymentMethod === 'cod_pending' ? 'Cash on delivery' : 'Cash on delivery';

        return {
          id: o.invoice_number || o.id,
          customer: o.customer_name || 'Walk-in Customer',
          phone: o.customer_phone || '—',
          channel: o.channel === 'messenger' ? 'Messenger' : 'Walk-in',
          status: o.status.charAt(0).toUpperCase() + o.status.slice(1),
          statusPill: pill,
          payment: paymentLabel,
          total: Number(o.total || 0).toLocaleString(),
          deliveryCharge: String(o.delivery_charge || 0),
          fulfillment: o.fulfillment_method === 'steadfast' ? 'Steadfast' : o.fulfillment_method === 'in_house' ? 'In-house' : 'Self-pickup',
          initials,
          raw: o,
        };
      });

      return mapped.length >= 4 ? mapped : [...mapped, ...defaultData.slice(mapped.length)];
    }

    return defaultData;
  }, [orders]);

  const handleOrderRowClick = (orderItem: any) => {
    setSelectedOrder(orderItem);
  };

  const handlePrintInvoice = () => {
    if (selectedOrder?.raw) {
      setActiveInvoiceOrder(selectedOrder.raw);
    } else {
      // Build a synthetic Order object for the invoice modal
      const syntheticOrder: Order = {
        id: selectedOrder.id,
        invoice_number: selectedOrder.id,
        customer_id: 'cust_sample_1',
        customer_name: selectedOrder.customer,
        customer_phone: selectedOrder.phone,
        channel: selectedOrder.channel === 'Walk-in' ? 'walk-in' : 'messenger',
        fulfillment_method: selectedOrder.fulfillment === 'Steadfast' ? 'steadfast' : 'in_house',
        delivery_address_text: 'House 47, Road 27, Banani, Dhaka',
        status: (selectedOrder.status.toLowerCase() as any) || 'confirmed',
        subtotal: Number(selectedOrder.total.replace(/,/g, '')) - Number(selectedOrder.deliveryCharge),
        delivery_charge: Number(selectedOrder.deliveryCharge),
        discount_amount: 0,
        total: Number(selectedOrder.total.replace(/,/g, '')),
        order_barcode: selectedOrder.id,
        created_by: currentUser?.id || 'usr_admin',
        created_by_name: currentUser?.name || 'Admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payments: [
          {
            id: 'pay_1',
            order_id: selectedOrder.id,
            amount: Number(selectedOrder.total.replace(/,/g, '')),
            method: selectedOrder.payment === 'bKash' ? 'bkash' : 'cod_pending',
            payment_account_id: 'acc_cash',
            received_by: currentUser?.name || 'Admin',
            status: 'completed',
            created_at: new Date().toISOString(),
          },
        ],
        items: [
          {
            id: 'item_1',
            order_id: selectedOrder.id,
            product_id: 'prod_1',
            product_name: 'Khadlaj Karus Gold Absolu EDP 100ML',
            sku: 'KDL006',
            barcode: '6291107452319',
            quantity: 1,
            unit_price: 2750,
            discount_amount: 0,
            total_price: 2750,
            unit_cost_at_sale: 1850,
          },
          {
            id: 'item_2',
            order_id: selectedOrder.id,
            product_id: 'prod_2',
            product_name: 'Armaf Dunescape EDP 100ML',
            sku: 'AMF002',
            barcode: '6294015132809',
            quantity: 1,
            unit_price: 3400,
            discount_amount: 0,
            total_price: 3400,
            unit_cost_at_sale: 2350,
          },
        ],
      };
      setActiveInvoiceOrder(syntheticOrder);
    }
    setShowInvoiceModal(true);
  };

  return (
    <div className="mirage-shell">
      {/* ====================================================================
       * MINIMALIST EXECUTIVE HEADER
       * ==================================================================== */}
      <div className="mirage-head" style={{ marginBottom: '22px', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: '#0F172A', margin: 0 }}>
            Performance Overview
          </h1>
          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
            Executive business pulse · BDT (৳) · Real-time operational data
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Period Dropdown replacing wide segmented buttons */}
          <div style={{ position: 'relative' }} ref={periodDropdownRef}>
            <button
              type="button"
              onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '7px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#0F172A',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
              title="Select performance timeframe"
            >
              <Calendar style={{ width: '14px', height: '14px', color: '#64748B' }} />
              <span>{curPeriod.label}</span>
              {curPeriod.key === '15D' && (
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: '#ECFDF5',
                    color: '#059669',
                    border: '1px solid #A7F3D0',
                  }}
                >
                  Default
                </span>
              )}
              <ChevronDown
                style={{
                  width: '13px',
                  height: '13px',
                  color: '#94A3B8',
                  transition: 'transform 0.15s ease',
                  transform: isPeriodDropdownOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>

            {isPeriodDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 4px)',
                  width: '220px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
                  zIndex: 60,
                  padding: '4px',
                }}
              >
                <div
                  style={{
                    padding: '6px 10px 4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#64748B',
                    borderBottom: '1px solid #F1F5F9',
                    marginBottom: '4px',
                  }}
                >
                  Select Timeframe
                </div>
                {(['15D', '7D', '30D', '90D', '1Y', 'ALL'] as const).map(pKey => {
                  const item = DASHBOARD_PERIODS[pKey];
                  const isSelected = activePeriod === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => {
                        setActivePeriod(pKey);
                        setIsPeriodDropdownOpen(false);
                        showToast(`Filter period set to ${item.label}`);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isSelected ? '#F1F5F9' : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.12s ease',
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#F8FAFC';
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#0F172A' : '#334155' }}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                background: '#ECFDF5',
                                color: '#059669',
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>{item.desc}</div>
                      </div>
                      {isSelected && <Check style={{ width: '14px', height: '14px', color: '#0F172A', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button
            className="mirage-btn"
            style={{ fontWeight: 600, color: '#0F172A', borderColor: '#CBD5E1', fontSize: '12px', padding: '6px 12px' }}
            onClick={() => go('/reports')}
          >
            Full Reports →
          </button>
        </div>
      </div>

      {/* ====================================================================
       * TOP METRIC STRIP (Seamless, borderless, typography-first)
       * ==================================================================== */}
      <div className="mirage-minimal-strip">
        {/* Metric 1: Booked revenue */}
        <div
          className="mirage-minimal-metric"
          role="button"
          tabIndex={0}
          title="Click to view Sales & P&L Statement"
          onClick={() => {
            showToast('Opening Sales & P&L report...');
            go('/accounting/pnl');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') go('/accounting/pnl');
          }}
        >
          <div className="mirage-minimal-metric-label">
            <span>Booked revenue</span>
            <span style={{ color: '#CBD5E1', fontSize: '12px' }}>↗</span>
          </div>
          <div className="mirage-minimal-metric-val">৳{curPeriod.revenue.toLocaleString()}</div>
          <div className="mirage-minimal-metric-foot">
            <span className="mirage-minimal-badge-up">{curPeriod.revenueGrowth}</span>
            <span>vs previous</span>
          </div>
        </div>

        {/* Metric 2: Gross profit */}
        <div
          className="mirage-minimal-metric"
          role="button"
          tabIndex={0}
          title="Click to view Gross Profit details"
          onClick={() => {
            showToast('Opening Profitability report...');
            go('/accounting/pnl');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') go('/accounting/pnl');
          }}
        >
          <div className="mirage-minimal-metric-label">
            <span>Gross profit</span>
            <span style={{ color: '#CBD5E1', fontSize: '12px' }}>↗</span>
          </div>
          <div className="mirage-minimal-metric-val">৳{curPeriod.grossProfit.toLocaleString()}</div>
          <div className="mirage-minimal-metric-foot">
            <span className="mirage-minimal-badge-up">{curPeriod.grossMargin}</span>
            <span>margin</span>
          </div>
        </div>

        {/* Metric 3: Net profit */}
        <div
          className="mirage-minimal-metric"
          role="button"
          tabIndex={0}
          title="Click to view Net Profit & Expenses"
          onClick={() => {
            showToast('Opening Net Profit Breakdown...');
            go('/accounting/pnl');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') go('/accounting/pnl');
          }}
        >
          <div className="mirage-minimal-metric-label">
            <span>Net profit</span>
            <span style={{ color: '#CBD5E1', fontSize: '12px' }}>↗</span>
          </div>
          <div className="mirage-minimal-metric-val">৳{curPeriod.netProfit.toLocaleString()}</div>
          <div className="mirage-minimal-metric-foot">
            <span className="mirage-minimal-badge-up">{curPeriod.netMargin}</span>
            <span>margin</span>
          </div>
        </div>

        {/* Metric 4: Orders received */}
        <div
          className="mirage-minimal-metric"
          role="button"
          tabIndex={0}
          title="Click to view all Orders received"
          onClick={() => {
            showToast("Opening Today's Orders...");
            go('/orders/today');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') go('/orders/today');
          }}
        >
          <div className="mirage-minimal-metric-label">
            <span>Orders received</span>
            <span style={{ color: '#CBD5E1', fontSize: '12px' }}>↗</span>
          </div>
          <div className="mirage-minimal-metric-val">{curPeriod.ordersCount.toLocaleString()}</div>
          <div className="mirage-minimal-metric-foot">
            <span className="mirage-minimal-badge-up">{curPeriod.ordersGrowth}</span>
            <span>this period</span>
          </div>
        </div>

        {/* Metric 5: Inventory value */}
        <div
          className="mirage-minimal-metric"
          role="button"
          tabIndex={0}
          title="Click to view Inventory & Stock Valuation"
          onClick={() => {
            showToast('Opening Inventory Valuation...');
            go('/inventory');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') go('/inventory');
          }}
        >
          <div className="mirage-minimal-metric-label">
            <span>Inventory value</span>
            <span style={{ color: '#CBD5E1', fontSize: '12px' }}>↗</span>
          </div>
          <div className="mirage-minimal-metric-val">৳1.24M</div>
          <div className="mirage-minimal-metric-foot">
            <span>428 available</span>
            <span>· 36 reserved</span>
          </div>
        </div>

        {/* Metric 6: Net liquid position */}
        <div
          className="mirage-minimal-metric"
          role="button"
          tabIndex={0}
          title="Click to view Daily Till & Cash Balances"
          onClick={() => {
            showToast('Opening Cash & Bank Ledger...');
            go('/accounting/daily-till');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') go('/accounting/daily-till');
          }}
        >
          <div className="mirage-minimal-metric-label">
            <span>Liquid cash</span>
            <span style={{ color: '#CBD5E1', fontSize: '12px' }}>↗</span>
          </div>
          <div className="mirage-minimal-metric-val">৳596,950</div>
          <div className="mirage-minimal-metric-foot">
            <span>Till, Bank, bKash</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
       * PERFORMANCE & CASH ANALYTICS HERO
       * ==================================================================== */}
      <div className="mirage-minimal-card">
        <div className="mirage-minimal-cardhead">
          <div>
            <div className="mirage-minimal-title">
              {chartView === 'REVENUE' && 'Revenue & Order Volume'}
              {chartView === 'PROFIT' && 'Profit Margins'}
              {chartView === 'DAILY_INFLOW' && 'Daily Cash & Payment Collections'}
              {chartView === 'SPLIT' && 'Performance & Inflow Overview'}
            </div>
            <div className="mirage-minimal-subtitle">
              {chartView === 'REVENUE' && curPeriod.chartSubtitleRevenue}
              {chartView === 'PROFIT' && curPeriod.chartSubtitleProfit}
              {chartView === 'DAILY_INFLOW' && 'Real-time liquid cash receipts and Steadfast COD settlements'}
              {chartView === 'SPLIT' && 'Consolidated split view across revenue, margins, and cash collections'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="mirage-segmented-group">
              <button
                type="button"
                className={`mirage-segmented-btn ${chartView === 'REVENUE' ? 'active' : ''}`}
                onClick={() => setChartView('REVENUE')}
              >
                Revenue
              </button>
              <button
                type="button"
                className={`mirage-segmented-btn ${chartView === 'PROFIT' ? 'active' : ''}`}
                onClick={() => setChartView('PROFIT')}
              >
                Profit
              </button>
              <button
                type="button"
                className={`mirage-segmented-btn ${chartView === 'DAILY_INFLOW' ? 'active' : ''}`}
                onClick={() => setChartView('DAILY_INFLOW')}
              >
                Cash Inflow
              </button>
              <button
                type="button"
                className={`mirage-segmented-btn ${chartView === 'SPLIT' ? 'active' : ''}`}
                onClick={() => setChartView('SPLIT')}
              >
                Split
              </button>
            </div>
            {(chartView === 'REVENUE' || chartView === 'PROFIT') && (
              <button className="mirage-link" onClick={() => go('/accounting/pnl')}>
                P&L Report →
              </button>
            )}
            {chartView === 'DAILY_INFLOW' && (
              <button className="mirage-link" onClick={() => go('/accounting/daily-till')}>
                Daily Till →
              </button>
            )}
          </div>
        </div>

        {/* View 1: Revenue & Orders */}
        {chartView === 'REVENUE' && (
          <div>
            <MirageInteractiveLineChart
              labels={curPeriod.chartLabels}
              seriesA={curPeriod.chartRevenueSeries}
              seriesB={curPeriod.chartOrderSeries}
              max={curPeriod.chartMaxRevenue}
              colorA="#0F172A"
              colorB="#B45309"
              strokeWidthA={2.5}
              strokeWidthB={2}
              labelA="Booked revenue"
              labelB="Order volume"
              formatA={(v) => `৳${v.toLocaleString()}`}
              formatB={(v) => `৳${v.toLocaleString()}`}
            />
            <div className="mirage-legend" style={{ marginTop: '8px' }}>
              <span>
                <i style={{ background: '#0F172A' }}></i>Booked revenue
              </span>
              <span>
                <i style={{ background: '#B45309' }}></i>Orders volume
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>
                Hover crosshair over any point to inspect values ({curPeriod.label})
              </span>
            </div>
          </div>
        )}

        {/* View 2: Profit Margins */}
        {chartView === 'PROFIT' && (
          <div>
            <MirageInteractiveLineChart
              labels={curPeriod.chartLabels}
              seriesA={curPeriod.chartGrossProfitSeries}
              seriesB={curPeriod.chartNetProfitSeries}
              max={curPeriod.chartMaxProfit}
              colorA="#0F172A"
              colorB="#10B981"
              strokeWidthA={2.5}
              strokeWidthB={2}
              labelA="Gross profit"
              labelB="Net profit"
              formatA={(v) => `৳${v.toLocaleString()}`}
              formatB={(v) => `৳${v.toLocaleString()}`}
            />
            <div className="mirage-legend" style={{ marginTop: '8px' }}>
              <span>
                <i style={{ background: '#0F172A' }}></i>Gross profit
              </span>
              <span>
                <i style={{ background: '#10B981' }}></i>Net profit
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>
                Hover crosshair over any point to inspect margins ({curPeriod.label})
              </span>
            </div>
          </div>
        )}

        {/* View 3: Daily Inflow */}
        {chartView === 'DAILY_INFLOW' && (
          <div style={{ marginTop: '4px' }}>
            <DailyIncomeCollectionChart onNavigateToTill={() => go('/accounting/daily-till')} embedded={true} />
          </div>
        )}

        {/* View 4: Split / All Views */}
        {chartView === 'SPLIT' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="mirage-cols2" style={{ marginBottom: 0 }}>
              <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: '#0F172A' }}>
                  Revenue vs order volume ({curPeriod.label})
                </div>
                <MirageInteractiveLineChart
                  labels={curPeriod.chartLabels}
                  seriesA={curPeriod.chartRevenueSeries}
                  seriesB={curPeriod.chartOrderSeries}
                  max={curPeriod.chartMaxRevenue}
                  colorA="#0F172A"
                  colorB="#B45309"
                  strokeWidthA={2.5}
                  strokeWidthB={2}
                  labelA="Booked revenue"
                  labelB="Order volume"
                  formatA={(v) => `৳${v.toLocaleString()}`}
                  formatB={(v) => `৳${v.toLocaleString()}`}
                />
              </div>

              <div style={{ border: '1px solid #F1F5F9', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: '#0F172A' }}>
                  Gross vs net profit ({curPeriod.label})
                </div>
                <MirageInteractiveLineChart
                  labels={curPeriod.chartLabels}
                  seriesA={curPeriod.chartGrossProfitSeries}
                  seriesB={curPeriod.chartNetProfitSeries}
                  max={curPeriod.chartMaxProfit}
                  colorA="#0F172A"
                  colorB="#10B981"
                  strokeWidthA={2.5}
                  strokeWidthB={2}
                  labelA="Gross profit"
                  labelB="Net profit"
                  formatA={(v) => `৳${v.toLocaleString()}`}
                  formatB={(v) => `৳${v.toLocaleString()}`}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
              <DailyIncomeCollectionChart onNavigateToTill={() => go('/accounting/daily-till')} embedded={true} />
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
       * TWO-COLUMN EXECUTIVE WORKSPACE (Clean, Quiet, Balanced)
       * ==================================================================== */}
      <div className="mirage-minimal-workspace">
        {/* LEFT COLUMN: FINANCE, LIQUIDITY & RECENT TRANSACTIONS */}
        <div>
          {/* Card 1: Liquidity & Account Balances */}
          <div className="mirage-minimal-card">
            <div className="mirage-minimal-cardhead">
              <div>
                <div className="mirage-minimal-title">Cash & Liquidity Position</div>
                <div className="mirage-minimal-subtitle">All active shop tills, bank balances, and receivables</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>৳594.9k</span>
                <button className="mirage-link" onClick={() => go('/accounting/daily-till')}>
                  Daily till →
                </button>
              </div>
            </div>

            <div className="mirage-minimal-row clickable" onClick={() => go('/accounting/daily-till')}>
              <span style={{ color: '#475569' }}>Cash in shop till</span>
              <span style={{ fontWeight: 700, color: '#0F172A' }}>৳158,500</span>
            </div>
            <div className="mirage-minimal-row clickable" onClick={() => go('/accounting/ledger')}>
              <span style={{ color: '#475569' }}>Bank accounts (BRAC / City Bank)</span>
              <span style={{ fontWeight: 700, color: '#0F172A' }}>৳350,000</span>
            </div>
            <div className="mirage-minimal-row clickable" onClick={() => go('/accounting/daily-till')}>
              <span style={{ color: '#475569' }}>bKash / Nagad merchant till</span>
              <span style={{ fontWeight: 700, color: '#0F172A' }}>৳86,400</span>
            </div>
            <div className="mirage-minimal-row clickable" onClick={() => go('/courier')}>
              <span style={{ color: '#475569' }}>Steadfast courier receivable (COD)</span>
              <span style={{ fontWeight: 700, color: '#0F172A' }}>৳74,900</span>
            </div>
            <div className="mirage-minimal-row clickable" onClick={() => go('/accounting/ledger')}>
              <span style={{ color: '#475569' }}>Supplier payables due</span>
              <span style={{ fontWeight: 700, color: '#DC2626' }}>−৳91,200</span>
            </div>

            {/* Quiet Expense Bar */}
            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Operating Expenses (৳63.7k)
                </span>
                <button className="mirage-link" onClick={() => go('/accounting/expenses')} style={{ fontSize: '11px' }}>
                  Expenses →
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div className="clickable" onClick={() => go('/accounting/expenses')} style={{ padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Advertising</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>৳25.1k</div>
                </div>
                <div className="clickable" onClick={() => go('/accounting/expenses')} style={{ padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Transport</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>৳16.0k</div>
                </div>
                <div className="clickable" onClick={() => go('/accounting/expenses')} style={{ padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Packaging</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>৳10.2k</div>
                </div>
                <div className="clickable" onClick={() => go('/accounting/expenses')} style={{ padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Other</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>৳12.4k</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Recent Orders & Invoices */}
          <div className="mirage-minimal-card">
            <div className="mirage-minimal-cardhead">
              <div>
                <div className="mirage-minimal-title">Recent Orders</div>
                <div className="mirage-minimal-subtitle">Click any row to open customer invoice</div>
              </div>
              <button className="mirage-link" onClick={() => go('/orders')}>
                All orders →
              </button>
            </div>
            <div className="mirage-tablewrap">
              <table className="mirage-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Channel</th>
                    <th className="mirage-money">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrdersData.map((order, idx) => (
                    <tr
                      key={idx}
                      tabIndex={0}
                      role="button"
                      className="clickable"
                      onClick={() => handleOrderRowClick(order)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') handleOrderRowClick(order);
                      }}
                    >
                      <td className="mirage-code" style={{ fontSize: '11px' }}>{order.id}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{order.customer}</span>
                      </td>
                      <td>
                        <span className={`mirage-pill ${order.statusPill}`}>{order.status}</span>
                      </td>
                      <td style={{ color: '#64748B' }}>{order.channel}</td>
                      <td className="mirage-money" style={{ color: '#0F172A' }}>৳{order.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: FULFILLMENT, NEEDS ATTENTION & PRODUCTS */}
        <div>
          {/* Card 1: Fulfillment & Logistics Pipeline */}
          <div className="mirage-minimal-card">
            <div className="mirage-minimal-cardhead">
              <div>
                <div className="mirage-minimal-title">Fulfillment Pipeline</div>
                <div className="mirage-minimal-subtitle">64 orders currently in process</div>
              </div>
              <button className="mirage-link" onClick={() => go('/orders/today')}>
                Today's orders →
              </button>
            </div>

            <div className="mirage-minimal-row clickable" onClick={() => go('/orders')}>
              <span style={{ color: '#475569' }}>Confirmed (Awaiting Packing)</span>
              <span className="mirage-pill gray">8 orders</span>
            </div>
            <div className="mirage-minimal-row clickable" onClick={() => go('/orders/today')}>
              <span style={{ color: '#475569' }}>Packing Queue</span>
              <span className="mirage-pill amber">5 orders</span>
            </div>
            <div className="mirage-minimal-row clickable" onClick={() => go('/courier')}>
              <span style={{ color: '#475569' }}>Dispatched with Steadfast</span>
              <span className="mirage-pill teal">11 parcels</span>
            </div>
            <div className="mirage-minimal-row clickable" onClick={() => go('/orders')}>
              <span style={{ color: '#475569' }}>Delivered Successfully</span>
              <span className="mirage-pill green">36 completed</span>
            </div>
            <div className="mirage-minimal-row clickable" onClick={() => go('/courier')}>
              <span style={{ color: '#475569' }}>Returned (RTO)</span>
              <span className="mirage-pill red">2 returns</span>
            </div>

            {/* Courier Performance Summary */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Steadfast Delivery Performance
                </span>
                <button className="mirage-link" onClick={() => go('/courier')} style={{ fontSize: '11px' }}>
                  Courier →
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div className="clickable" onClick={() => go('/courier')} style={{ padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Success Rate</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#10B981' }}>94.2%</div>
                </div>
                <div className="clickable" onClick={() => go('/courier')} style={{ padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>RTO Rate</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>5.8%</div>
                </div>
                <div className="clickable" onClick={() => go('/courier')} style={{ padding: '6px 8px', background: '#F8FAFC', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748B' }}>Same-day</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>72.5%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Needs Attention (Action Items) */}
          <div className="mirage-minimal-card">
            <div className="mirage-minimal-cardhead">
              <div>
                <div className="mirage-minimal-title">Needs Attention</div>
                <div className="mirage-minimal-subtitle">Operational items requiring immediate review</div>
              </div>
              <button className="mirage-link" onClick={() => go('/audit-logs')}>
                Audit log →
              </button>
            </div>

            <div
              className="mirage-minimal-row clickable"
              role="button"
              tabIndex={0}
              onClick={() => {
                showToast('Navigating to stock reorder list...');
                go('/inventory');
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#0F172A' }}>3 products out of stock</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>Reorder before taking new customer demand</div>
              </div>
              <span className="mirage-link" style={{ color: '#DC2626' }}>Reorder →</span>
            </div>

            <div
              className="mirage-minimal-row clickable"
              role="button"
              tabIndex={0}
              onClick={() => {
                showToast('Opening packing queue...');
                go('/orders/today');
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#0F172A' }}>5 orders in packing queue</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>Stock allocated, awaiting barcode verification</div>
              </div>
              <span className="mirage-link" style={{ color: '#D97706' }}>Pack →</span>
            </div>

            <div
              className="mirage-minimal-row clickable"
              role="button"
              tabIndex={0}
              onClick={() => {
                showToast('Opening courier reconciliation...');
                go('/courier');
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#0F172A' }}>Courier payout variance</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>−৳3,240 delivery charge variance to reconcile</div>
              </div>
              <span className="mirage-link" style={{ color: '#0284C7' }}>Reconcile →</span>
            </div>

            <div
              className="mirage-minimal-row clickable"
              role="button"
              tabIndex={0}
              onClick={() => {
                showToast('Opening supplier payables in ledger...');
                go('/accounting/ledger');
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '12px', color: '#0F172A' }}>Supplier payment due</div>
                <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>৳91,200 outstanding supplier balance</div>
              </div>
              <span className="mirage-link" style={{ color: '#D97706' }}>Pay →</span>
            </div>
          </div>

          {/* Card 3: Top Profitable Perfumes */}
          <div className="mirage-minimal-card">
            <div className="mirage-minimal-cardhead">
              <div>
                <div className="mirage-minimal-title">Top Perfume Performers</div>
                <div className="mirage-minimal-subtitle">Ranked by gross profit this period</div>
              </div>
              <button className="mirage-link" onClick={() => go('/inventory')}>
                Catalog →
              </button>
            </div>

            {[
              { name: 'Khadlaj Karus Gold Absolu EDP 100ML', code: 'KDL006', profit: '12,480', sold: '18 sold', pct: '93%' },
              { name: 'Armaf Dunescape EDP 100ML', code: 'AMF002', profit: '9,860', sold: '14 sold', pct: '77%' },
              { name: 'Rasasi Hawas EDP 100ML', code: 'RAS014', profit: '8,140', sold: '11 sold', pct: '64%' },
              { name: 'Afnan 9PM EDP 100ML', code: 'AFN003', profit: '6,520', sold: '9 sold', pct: '51%' },
            ].map((r, idx) => (
              <div
                key={idx}
                className="mirage-minimal-row clickable"
                role="button"
                tabIndex={0}
                onClick={() => {
                  showToast(`Viewing ${r.code} in inventory...`);
                  go('/inventory');
                }}
              >
                <div style={{ flex: 1, paddingRight: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{r.name}</div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '1px' }}>
                    {r.code} · {r.sold}
                  </div>
                  <div style={{ height: '3px', background: '#F1F5F9', borderRadius: '99px', marginTop: '5px' }}>
                    <div style={{ width: r.pct, height: '100%', background: '#0F172A', borderRadius: '99px' }}></div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                  ৳{r.profit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====================================================================
       * DRAWER: ORDER VIEW / EDIT (100% fidelity to demo openOrder modal)
       * ==================================================================== */}
      {selectedOrder && (
        <div
          className="mirage-drawer open"
          role="dialog"
          aria-modal="true"
          onClick={e => {
            if (e.target === e.currentTarget) setSelectedOrder(null);
          }}
        >
          <div className="mirage-drawerpanel">
            <div className="mirage-drawerhead">
              <div className="mirage-title">Order {selectedOrder.id}</div>
              <button
                className="mirage-close"
                onClick={() => setSelectedOrder(null)}
                title="Close record"
              >
                ×
              </button>
            </div>
            <div className="mirage-drawerbody">
              <div className="mirage-inlineAlert info">
                <b>Demo order detail.</b> Customer, items, payment(s), lifecycle, invoice and audit are represented here.
              </div>
              <div className="mirage-profile">
                <div className="mirage-profilephoto">{selectedOrder.initials || 'CU'}</div>
                <div>
                  <b style={{ fontSize: '14px', color: '#222' }}>{selectedOrder.customer}</b>
                  <div className="mirage-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                    {selectedOrder.phone}
                  </div>
                  <div style={{ marginTop: '7px', display: 'flex', gap: '6px' }}>
                    <span className={`mirage-pill ${selectedOrder.statusPill}`}>
                      {selectedOrder.status}
                    </span>
                    <span className="mirage-pill gray">{selectedOrder.channel}</span>
                  </div>
                </div>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--border, #E5E5E5)', margin: '16px 0' }} />

              <div className="mirage-row">
                <span>Total</span>
                <span className="value">৳{selectedOrder.total}</span>
              </div>
              <div className="mirage-row">
                <span>Delivery charge</span>
                <span className="value">৳{selectedOrder.deliveryCharge}</span>
              </div>
              <div className="mirage-row">
                <span>Fulfillment</span>
                <span className="value">{selectedOrder.fulfillment}</span>
              </div>

              <div style={{ marginTop: '15px', fontSize: '11px', fontWeight: 800, color: '#222' }}>
                Lifecycle
              </div>
              <div className="mirage-timeline" style={{ marginTop: '10px' }}>
                <div className="mirage-event">
                  <strong>Confirmed</strong>
                  <p>01 Sep · 10:42 · reserved 2 units</p>
                </div>
                <div className="mirage-event">
                  <strong>Packing</strong>
                  <p>Queued for barcode verification</p>
                </div>
                <div className="mirage-event">
                  <strong>Dispatch</strong>
                  <p>Pending Steadfast booking</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  className="mirage-btn"
                  onClick={handlePrintInvoice}
                >
                  Print invoice
                </button>
                <button
                  className="mirage-btn"
                  style={{ borderColor: '#f1b8b8', color: '#b91c1c', background: '#fff' }}
                  onClick={() => {
                    showToast(`Order ${selectedOrder.id} cancelled`);
                    setSelectedOrder(null);
                  }}
                >
                  Cancel order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
       * INVOICE MODAL (Branded thermal / A4 printable invoice)
       * ==================================================================== */}
      {activeInvoiceOrder && (
        <InvoiceModal
          order={activeInvoiceOrder}
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
        />
      )}

      {/* ====================================================================
       * TOAST NOTIFICATION (Exact demo toast)
       * ==================================================================== */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            right: '18px',
            bottom: '18px',
            background: 'var(--navy, #16324F)',
            color: '#fff',
            padding: '11px 14px',
            borderRadius: '7px',
            fontSize: '10px',
            boxShadow: '0 10px 30px rgba(0,0,0,.18)',
            zIndex: 100,
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
};
