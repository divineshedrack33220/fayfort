import { useId } from "react";
import { cn } from "@/lib/utils";

export interface TrendPoint {
  label: string;
  value: number;
}

const W = 600;
const H = 200;
const PX = 26;
const PB = 12;
const GRID_LINES = 4;

function niceTop(max: number): number {
  if (max <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const factor of [1, 2, 2.5, 4, 5, 10]) {
    const candidate = mag * factor;
    if (candidate >= max) return candidate;
  }
  return mag * 10;
}

function abbreviate(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(Math.round(value));
}

function makePaths(data: TrendPoint[], top: number) {
  const innerW = W - PX * 2;
  const innerH = H - PB * 2 - 16;
  const points = data.map((point, index) => [
    PX + (innerW * index) / Math.max(data.length - 1, 1),
    PB + 16 + innerH - (point.value / top) * innerH,
  ] as const);

  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // With no data points there is no `line` to weave into a closed area, and
  // interpolating it would emit a malformed `d` (a bare `L  L`) that the SVG
  // parser rejects.
  const area = line
    ? `M ${PX},${PB + 16 + innerH} L ${line} L ${PX + innerW},${PB + 16 + innerH} Z`
    : "";
  return { points, line, area, innerH };
}

/**
 * Dependency-free SVG area/line chart used across the staff console.
 * Scales to its container and degrades gracefully to the raw numbers.
 */
export function TrendChart({
  data,
  formatValue = (value) => abbreviate(value),
  ariaLabel,
  className,
}: {
  data: TrendPoint[];
  formatValue?: (value: number) => string;
  ariaLabel?: string;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const top = niceTop(Math.max(...data.map((point) => point.value), 1));
  const { points, line, area, innerH } = makePaths(data, top);
  const leftPadPct = `${(PX / W) * 100}%`;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-44 w-full"
          role="img"
          aria-label={ariaLabel ?? `${data.map((p) => `${p.label}: ${p.value}`).join(", ")}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1648a8" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#1648a8" stopOpacity={0} />
            </linearGradient>
          </defs>
          {Array.from({ length: GRID_LINES + 1 }, (_, index) => {
            const y = PB + 16 + innerH - (innerH * index) / GRID_LINES;
            const value = top - (top * index) / GRID_LINES;
            return (
              <g key={index}>
                <line
                  x1={PX}
                  x2={W - PX}
                  y1={y}
                  y2={y}
                  stroke="#d9d6d0"
                  strokeWidth={1}
                  strokeDasharray={index === GRID_LINES ? undefined : "3 4"}
                />
                <text
                  x={PX - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={10}
                  fill="#8f8980"
                >
                  {formatValue(value)}
                </text>
              </g>
            );
          })}
          {area ? <path d={area} fill={`url(#${gradientId})`} /> : null}
          {line ? (
            <path
              d={`M ${line}`}
              fill="none"
              stroke="#1648a8"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {points.map(([x, y], index) => (
            <circle key={index} cx={x} cy={y} r={3.5} fill="#06265F" stroke="#fff" strokeWidth={1.5} />
          ))}
        </svg>
      </div>
      <div
        className="flex justify-between"
        style={{ paddingLeft: leftPadPct, paddingRight: leftPadPct }}
      >
        {data.map((point) => (
          <span key={point.label} className="text-[11px] text-sand-500 first:pl-0 last:pr-0">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}