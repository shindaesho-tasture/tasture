import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TasteDNA {
  salty: number; sweet: number; sour: number; spicy: number; umami: number;
}

interface Props {
  userA: TasteDNA;
  userB: TasteDNA;
  nameA: string;
  nameB: string;
  size?: number;
  className?: string;
}

const AXES = [
  { key: "salty" as const, label: "เค็ม", icon: "🧂" },
  { key: "sweet" as const, label: "หวาน", icon: "🍯" },
  { key: "sour" as const, label: "เปรี้ยว", icon: "🍋" },
  { key: "spicy" as const, label: "เผ็ด", icon: "🌶️" },
  { key: "umami" as const, label: "อูมามิ", icon: "🍄" },
];

const CompareRadarChart = ({ userA, userB, nameA, nameB, size = 260, className }: Props) => {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.32;
  const angleStep = 360 / AXES.length;

  const axes = AXES.map((a, i) => ({ ...a, angle: -90 + i * angleStep }));

  const getPoint = (angleDeg: number, value: number) => {
    const normalized = (Math.min(value, 5) / 5) * maxR;
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + normalized * Math.cos(rad), y: cy + normalized * Math.sin(rad) };
  };

  const makePath = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const targetPath = makePath(axes.map((a) => getPoint(a.angle, 3)));
  const pathA = makePath(axes.map((a) => getPoint(a.angle, userA[a.key])));
  const pathB = makePath(axes.map((a) => getPoint(a.angle, userB[a.key])));
  const pointsA = axes.map((a) => getPoint(a.angle, userA[a.key]));
  const pointsB = axes.map((a) => getPoint(a.angle, userB[a.key]));

  // Match score (0-100) — closer values = higher match
  const diffs = AXES.map((a) => Math.abs(userA[a.key] - userB[a.key]));
  const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const matchPct = Math.round(Math.max(0, 100 - avgDiff * 20));
  const matchColor = matchPct >= 75 ? "hsl(163 78% 20%)" : matchPct >= 50 ? "hsl(43 74% 49%)" : "hsl(0 68% 35%)";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <radialGradient id="compare-target" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(163 78% 20%)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Target zone fill */}
        <path d={targetPath} fill="url(#compare-target)" />

        {/* Grid rings */}
        {[1, 2, 3, 4, 5].map((ring) => {
          const ringPath = makePath(axes.map((a) => getPoint(a.angle, ring)));
          const isTarget = ring === 3;
          return (
            <path key={ring} d={ringPath} fill="none"
              stroke={isTarget ? "hsl(163 78% 20% / 0.3)" : "hsl(0 0% 0% / 0.05)"}
              strokeWidth={isTarget ? 1.5 : 0.5}
              strokeDasharray={isTarget ? "3 2" : undefined} />
          );
        })}

        {/* Axis lines */}
        {axes.map((a, i) => {
          const outer = getPoint(a.angle, 5);
          return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="hsl(0 0% 0% / 0.05)" strokeWidth={0.5} />;
        })}

        {/* User B shape (friend — amber) */}
        <motion.path
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          d={pathB} fill="hsl(43 74% 49% / 0.1)" stroke="hsl(43 74% 49% / 0.7)"
          strokeWidth={1.5} strokeLinejoin="round" strokeDasharray="4 2"
          style={{ transformOrigin: `${cx}px ${cy}px` }} />

        {/* User A shape (me — emerald) */}
        <motion.path
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          d={pathA} fill="hsl(163 78% 20% / 0.12)" stroke="hsl(163 78% 20% / 0.8)"
          strokeWidth={1.5} strokeLinejoin="round"
          style={{ transformOrigin: `${cx}px ${cy}px` }} />

        {/* Data dots A */}
        {pointsA.map((p, i) => (
          <motion.circle key={`a-${i}`} initial={{ r: 0 }} animate={{ r: 3 }}
            transition={{ delay: 0.2 + i * 0.04 }}
            cx={p.x} cy={p.y} fill="hsl(163 78% 20%)" stroke="white" strokeWidth={1.5} />
        ))}

        {/* Data dots B */}
        {pointsB.map((p, i) => (
          <motion.circle key={`b-${i}`} initial={{ r: 0 }} animate={{ r: 3 }}
            transition={{ delay: 0.3 + i * 0.04 }}
            cx={p.x} cy={p.y} fill="hsl(43 74% 49%)" stroke="white" strokeWidth={1.5} />
        ))}

        {/* Axis labels */}
        {axes.map((a, i) => {
          const labelPoint = getPoint(a.angle, 6.3);
          return (
            <text key={i} x={labelPoint.x} y={labelPoint.y}
              textAnchor="middle" dominantBaseline="middle"
              fill="hsl(0 0% 45%)" fontSize="7.5" fontWeight="600" fontFamily="Kanit, sans-serif">
              {a.icon} {a.label}
            </text>
          );
        })}

        {/* Center match score */}
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
          fill={matchColor} fontSize="16" fontWeight="800" fontFamily="Inter, sans-serif">
          {matchPct}%
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle"
          fill="hsl(0 0% 50%)" fontSize="6" fontWeight="400" fontFamily="Kanit, sans-serif">
          ความเข้ากัน
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-score-emerald" />
          <span className="text-[10px] font-semibold text-foreground">{nameA}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-gold" />
          <span className="text-[10px] font-semibold text-foreground">{nameB}</span>
        </div>
      </div>

      {/* Side-by-side bars */}
      <div className="mt-4 w-full space-y-2">
        {AXES.map((a) => {
          const vA = userA[a.key];
          const vB = userB[a.key];
          return (
            <div key={a.key} className="flex items-center gap-2">
              <span className="text-[10px] w-14 text-right text-muted-foreground truncate">{a.icon} {a.label}</span>
              <div className="flex-1 flex items-center gap-1">
                {/* Bar A */}
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(vA / 5) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full bg-score-emerald" />
                </div>
                {/* Bar B */}
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(vB / 5) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="h-full rounded-full bg-gold" />
                </div>
              </div>
              <div className="flex gap-1 w-12">
                <span className="text-[9px] font-bold text-score-emerald w-5 text-right">{vA.toFixed(1)}</span>
                <span className="text-[9px] font-bold text-gold w-5 text-right">{vB.toFixed(1)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompareRadarChart;
