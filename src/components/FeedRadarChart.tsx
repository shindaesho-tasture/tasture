import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface SatisfactionAxes {
  texture?: number;     // 1-5
  taste?: number;       // 1-5
  overall?: number;     // 1-5
  cleanliness?: number; // 1-5
  value?: number;       // 1-5 (ความคุ้มค่า)
  spiciness?: number;   // 1-5 (ระดับเผ็ด)
  sweetness?: number;   // 1-5 (ความหวาน)
  saltiness?: number;   // 1-5 (ความเค็ม)
}

const ALL_AXES = [
  { key: "texture" as const, label: "เท็กซ์เจอร์", icon: "🫧" },
  { key: "taste" as const, label: "รสชาติ", icon: "👅" },
  { key: "cleanliness" as const, label: "ความสะอาด", icon: "✨" },
  { key: "overall" as const, label: "ภาพรวมร้าน", icon: "🏪" },
  { key: "value" as const, label: "คุ้มค่า", icon: "💰" },
  { key: "spiciness" as const, label: "เผ็ด", icon: "🌶️" },
  { key: "sweetness" as const, label: "หวาน", icon: "🍯" },
  { key: "saltiness" as const, label: "เค็ม", icon: "🧂" },
];

interface FeedRadarChartProps {
  data: SatisfactionAxes;
  size?: number;
  dark?: boolean;
  className?: string;
  showBarBreakdown?: boolean;
}

const FeedRadarChart = ({ data, size = 160, dark = false, className, showBarBreakdown = false }: FeedRadarChartProps) => {
  const activeAxes = ALL_AXES.filter((a) => data[a.key] != null && data[a.key]! > 0);
  if (activeAxes.length < 3) return null;

  const angleStep = 360 / activeAxes.length;
  const axes = activeAxes.map((a, i) => ({
    ...a,
    angle: -90 + i * angleStep,
  }));

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.32;

  const getPoint = (angleDeg: number, value: number) => {
    const normalized = (value / 5) * maxR;
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + normalized * Math.cos(rad),
      y: cy + normalized * Math.sin(rad),
    };
  };

  const makePath = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const targetPath = makePath(axes.map((a) => getPoint(a.angle, 3)));
  const dataPoints = axes.map((a) => getPoint(a.angle, data[a.key]!));
  const dataPath = makePath(dataPoints);

  const avg = axes.reduce((sum, a) => sum + (data[a.key] || 0), 0) / axes.length;
  const avgColor = avg >= 4 ? "hsl(163 78% 20%)" : avg >= 3 ? "hsl(105 24% 50%)" : avg >= 2 ? "hsl(32 95% 44%)" : "hsl(0 68% 35%)";

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <defs>
          <radialGradient id={`feed-target-${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(163 78% 20%)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Target zone */}
        <path d={targetPath} fill={`url(#feed-target-${size})`} />

        {/* Grid rings 1-5 */}
        {[1, 2, 3, 4, 5].map((ring) => {
          const ringPath = makePath(axes.map((a) => getPoint(a.angle, ring)));
          const isTarget = ring === 3;
          return (
            <path
              key={ring}
              d={ringPath}
              fill="none"
              stroke={isTarget ? "hsl(163 78% 20% / 0.3)" : dark ? "hsl(0 0% 100% / 0.08)" : "hsl(0 0% 0% / 0.05)"}
              strokeWidth={isTarget ? 1.5 : 0.5}
              strokeDasharray={isTarget ? "3 2" : undefined}
            />
          );
        })}

        {/* Axis lines */}
        {axes.map((a, i) => {
          const outer = getPoint(a.angle, 5);
          return (
            <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y}
              stroke={dark ? "hsl(0 0% 100% / 0.08)" : "hsl(0 0% 0% / 0.05)"} strokeWidth={0.5} />
          );
        })}

        {/* Data shape */}
        <motion.path
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          d={dataPath}
          fill={dark ? "hsl(163 78% 40% / 0.18)" : "hsl(163 78% 20% / 0.1)"}
          stroke={dark ? "hsl(163 78% 50% / 0.9)" : "hsl(163 78% 20% / 0.8)"}
          strokeWidth={1.5} strokeLinejoin="round"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => {
          const val = data[axes[i].key]!;
          const color = val >= 4 ? "hsl(163 78% 20%)"
            : val >= 3 ? "hsl(105 24% 60%)"
            : val >= 2 ? "hsl(32 95% 44%)"
            : "hsl(0 68% 35%)";
          return (
            <motion.circle
              key={i}
              initial={{ r: 0 }}
              animate={{ r: val >= 4 || val <= 1 ? 3.5 : 2.5 }}
              transition={{ delay: 0.2 + i * 0.04 }}
              cx={p.x} cy={p.y}
              fill={color} stroke="white" strokeWidth={1.5}
            />
          );
        })}

        {/* Axis labels */}
        {axes.map((a, i) => {
          const labelPoint = getPoint(a.angle, 6.2);
          const val = data[a.key]!;
          const labelColor = val >= 4 ? (dark ? "hsl(163 78% 50%)" : "hsl(163 78% 25%)")
            : val <= 2 ? (dark ? "hsl(0 68% 55%)" : "hsl(0 68% 40%)")
            : dark ? "hsl(0 0% 100% / 0.6)" : "hsl(0 0% 45%)";
          return (
            <text key={i} x={labelPoint.x} y={labelPoint.y}
              textAnchor="middle" dominantBaseline="middle"
              fill={labelColor} fontSize={size <= 110 ? "5.5" : "7"} fontWeight="600" fontFamily="Kanit, sans-serif">
              {a.icon} {size <= 110 ? "" : a.label}
            </text>
          );
        })}

        {/* Center score */}
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
          fill={avgColor} fontSize={size <= 110 ? "11" : "15"} fontWeight="800" fontFamily="Inter, sans-serif">
          {avg.toFixed(1)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle"
          fill={dark ? "hsl(0 0% 100% / 0.4)" : "hsl(0 0% 50%)"} fontSize={size <= 110 ? "5" : "6"} fontWeight="400" fontFamily="Kanit, sans-serif">
          คะแนนเฉลี่ย
        </text>
      </svg>

      {/* Bar breakdown */}
      {showBarBreakdown && (
        <div className="mt-3 space-y-1.5 px-1">
          {axes.map((a) => {
            const val = data[a.key]!;
            const pct = (val / 5) * 100;
            const barColor = val >= 4 ? "bg-score-emerald" : val >= 3 ? "bg-score-mint" : val >= 2 ? "bg-score-amber" : "bg-score-ruby";
            return (
              <div key={a.key} className="flex items-center gap-1.5">
                <span className="text-[8px] w-12 truncate text-right text-muted-foreground">{a.icon}{a.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full rounded-full ${barColor}`}
                  />
                </div>
                <span className="text-[8px] font-semibold w-3 text-muted-foreground">{val}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FeedRadarChart;
