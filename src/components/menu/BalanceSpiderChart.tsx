import { motion } from "framer-motion";
import type { SensoryAxis } from "@/lib/sensory-types";

interface BalanceSpiderChartProps {
  axes: SensoryAxis[];
  values: Record<string, number>; // axis name -> level 1-5
  founderWeight?: boolean;
}

const BalanceSpiderChart = ({ axes, values, founderWeight }: BalanceSpiderChartProps) => {
  const cx = 120;
  const cy = 120;
  const maxR = 90;
  const rings = 5;
  const n = axes.length;

  if (n < 3) return null;

  const angleStep = (2 * Math.PI) / n;

  const getPoint = (index: number, ringLevel: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (ringLevel / rings) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  // Build data polygon - values map 1-5 to rings 1-5
  const dataPoints = axes.map((axis, i) => {
    const level = values[axis.name] ?? 3;
    return getPoint(i, level);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Perfect balance polygon (all at ring 3)
  const perfectPoints = axes.map((_, i) => getPoint(i, 3));
  const perfectPath = perfectPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="relative">
      <svg viewBox="0 0 240 240" className="w-full max-w-[280px] mx-auto">
        {/* Grid rings */}
        {[1, 2, 3, 4, 5].map((ring) => {
          const pts = axes.map((_, i) => getPoint(i, ring));
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          return (
            <path
              key={ring}
              d={d}
              fill="none"
              stroke={ring === 3 ? "hsl(163,78%,20%)" : "hsl(0,0%,90%)"}
              strokeWidth={ring === 3 ? 1.5 : 0.5}
              opacity={ring === 3 ? 0.6 : 0.4}
            />
          );
        })}

        {/* Axis lines */}
        {axes.map((_, i) => {
          const outer = getPoint(i, 5);
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={outer.x} y2={outer.y}
              stroke="hsl(0,0%,90%)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Emerald ring 3 glow */}
        <path
          d={perfectPath}
          fill="none"
          stroke="hsl(163,78%,20%)"
          strokeWidth={2}
          opacity={0.15}
          filter="url(#glow)"
        />

        {/* Data shape */}
        <motion.path
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          d={dataPath}
          fill="hsla(163,78%,20%,0.12)"
          stroke="hsl(163,78%,20%)"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => {
          const level = values[axes[i].name] ?? 3;
          const color = level === 3 ? "hsl(163,78%,20%)" : level <= 2 || level >= 4 ? "hsl(32,95%,44%)" : "hsl(163,78%,20%)";
          const isExtreme = level === 1 || level === 5;
          return (
            <motion.circle
              key={i}
              initial={{ r: 0 }}
              animate={{ r: isExtreme ? 5 : 3.5 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              cx={p.x}
              cy={p.y}
              fill={isExtreme ? "hsl(0,68%,35%)" : color}
              stroke="white"
              strokeWidth={2}
            />
          );
        })}

        {/* Labels */}
        {axes.map((axis, i) => {
          const labelPt = getPoint(i, 5.8);
          return (
            <text
              key={i}
              x={labelPt.x}
              y={labelPt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="hsl(0,0%,30%)"
              fontSize="9"
              fontWeight="600"
            >
              {axis.icon} {axis.name}
            </text>
          );
        })}

        {/* Glow filter */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-score-emerald" />
          <span className="text-[9px] text-muted-foreground">สมดุล (Ring 3)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-score-ruby" />
          <span className="text-[9px] text-muted-foreground">เกินสมดุล</span>
        </div>
        {founderWeight && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-score-emerald font-bold">×20</span>
            <span className="text-[9px] text-muted-foreground">Founder</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceSpiderChart;
