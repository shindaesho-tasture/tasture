import { motion } from "framer-motion";
import type { SensoryAxis } from "@/lib/sensory-types";

interface BalanceSpiderChartProps {
  axes: SensoryAxis[];
  values: Record<string, number>; // axis name -> level 1-5
  founderWeight?: boolean;
  size?: number;
  showBarChart?: boolean; // show additional horizontal bar breakdown
}

const BalanceSpiderChart = ({ axes, values, founderWeight, size = 240, showBarChart = true }: BalanceSpiderChartProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.375;
  const rings = 5;
  const n = axes.length;

  if (n < 3) return null;

  const angleStep = (2 * Math.PI) / n;

  const getPoint = (index: number, ringLevel: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (ringLevel / rings) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const dataPoints = axes.map((axis, i) => {
    const level = values[axis.name] ?? 3;
    return getPoint(i, level);
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const perfectPoints = axes.map((_, i) => getPoint(i, 3));
  const perfectPath = perfectPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Calculate balance score
  const avgDeviation = axes.reduce((sum, axis) => sum + Math.abs((values[axis.name] ?? 3) - 3), 0) / n;
  const balanceScore = Math.max(0, 100 - avgDeviation * 25);
  const scoreColor = balanceScore >= 80 ? "hsl(163,78%,20%)" : balanceScore >= 50 ? "hsl(32,95%,44%)" : "hsl(0,68%,35%)";

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
        <defs>
          <filter id="spider-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="target-zone" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(163,78%,20%)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(163,78%,20%)" stopOpacity="0.02" />
          </radialGradient>
        </defs>

        {/* Target zone fill */}
        <path d={perfectPath} fill="url(#target-zone)" />

        {/* Grid rings */}
        {[1, 2, 3, 4, 5].map((ring) => {
          const pts = axes.map((_, i) => getPoint(i, ring));
          const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
          const isTarget = ring === 3;
          return (
            <path
              key={ring}
              d={d}
              fill="none"
              stroke={isTarget ? "hsl(163,78%,20%)" : "hsl(0,0%,88%)"}
              strokeWidth={isTarget ? 2 : 0.5}
              opacity={isTarget ? 0.5 : 0.35}
              strokeDasharray={isTarget ? "4 3" : undefined}
            />
          );
        })}

        {/* Axis lines */}
        {axes.map((_, i) => {
          const outer = getPoint(i, 5);
          return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="hsl(0,0%,88%)" strokeWidth={0.5} opacity={0.4} />;
        })}

        {/* Emerald ring glow */}
        <path d={perfectPath} fill="none" stroke="hsl(163,78%,20%)" strokeWidth={3} opacity={0.1} filter="url(#spider-glow)" />

        {/* Data shape with gradient */}
        <motion.path
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          d={dataPath}
          fill="hsla(163,78%,20%,0.1)"
          stroke="hsl(163,78%,20%)"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Data points with color-coded indicators */}
        {dataPoints.map((p, i) => {
          const level = values[axes[i].name] ?? 3;
          const isBalanced = level === 3;
          const isExtreme = level === 1 || level === 5;
          const isSlightOff = level === 2 || level === 4;
          const color = isBalanced
            ? "hsl(163,78%,20%)"
            : isExtreme
              ? "hsl(0,68%,35%)"
              : "hsl(32,95%,44%)";
          return (
            <motion.circle
              key={i}
              initial={{ r: 0 }}
              animate={{ r: isExtreme ? 5.5 : isSlightOff ? 4 : 3.5 }}
              transition={{ delay: 0.3 + i * 0.06 }}
              cx={p.x} cy={p.y}
              fill={color} stroke="white" strokeWidth={2}
            />
          );
        })}

        {/* Axis labels with level indicator */}
        {axes.map((axis, i) => {
          const labelPt = getPoint(i, 6);
          const level = values[axis.name] ?? 3;
          const labelColor = level === 3 ? "hsl(163,78%,20%)" : level <= 2 || level >= 4 ? "hsl(0,0%,35%)" : "hsl(0,0%,45%)";
          return (
            <g key={i}>
              <text x={labelPt.x} y={labelPt.y - 5} textAnchor="middle" dominantBaseline="middle"
                fill={labelColor} fontSize="8.5" fontWeight="600" fontFamily="Kanit, sans-serif">
                {axis.icon} {axis.name}
              </text>
              <text x={labelPt.x} y={labelPt.y + 6} textAnchor="middle" dominantBaseline="middle"
                fill="hsl(0,0%,60%)" fontSize="7" fontWeight="400" fontFamily="Kanit, sans-serif">
                {axis.labels[level - 1]}
              </text>
            </g>
          );
        })}

        {/* Center balance score */}
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
          fill={scoreColor} fontSize="16" fontWeight="800" fontFamily="Inter, sans-serif">
          {balanceScore.toFixed(0)}
        </text>
        <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="middle"
          fill="hsl(0,0%,55%)" fontSize="6.5" fontWeight="500" fontFamily="Kanit, sans-serif">
          สมดุล
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-score-emerald" />
          <span className="text-[9px] text-muted-foreground">สมดุล (3)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-score-amber" />
          <span className="text-[9px] text-muted-foreground">เบี่ยง (2,4)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-score-ruby" />
          <span className="text-[9px] text-muted-foreground">วิกฤต (1,5)</span>
        </div>
        {founderWeight && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-score-emerald font-bold">×20</span>
            <span className="text-[9px] text-muted-foreground">Founder</span>
          </div>
        )}
      </div>

      {/* Horizontal Bar Breakdown */}
      {showBarChart && (
        <div className="mt-4 space-y-2 px-2">
          {axes.map((axis) => {
            const level = values[axis.name] ?? 3;
            const pct = (level / 5) * 100;
            const isBalanced = level === 3;
            const isExtreme = level === 1 || level === 5;
            const barColor = isBalanced
              ? "bg-score-emerald"
              : isExtreme
                ? "bg-score-ruby"
                : "bg-score-amber";
            return (
              <div key={axis.name} className="flex items-center gap-2">
                <span className="text-[9px] w-16 truncate text-muted-foreground text-right">{axis.icon} {axis.name}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className={`h-full rounded-full ${barColor}`}
                  />
                </div>
                <span className="text-[9px] font-semibold w-4 text-right text-muted-foreground">{level}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BalanceSpiderChart;
