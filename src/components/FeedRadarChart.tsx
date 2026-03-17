import { cn } from "@/lib/utils";

export interface SatisfactionAxes {
  texture?: number;     // 1-5
  taste?: number;       // 1-5
  overall?: number;     // 1-5
  cleanliness?: number; // 1-5
}

const ALL_AXES = [
  { key: "texture" as const, label: "เท็กซ์เจอร์", icon: "🫧" },
  { key: "taste" as const, label: "รสชาติ", icon: "👅" },
  { key: "cleanliness" as const, label: "ความสะอาด", icon: "✨" },
  { key: "overall" as const, label: "ภาพรวมร้าน", icon: "🏪" },
];

interface FeedRadarChartProps {
  data: SatisfactionAxes;
  size?: number;
  dark?: boolean;
  className?: string;
}

const FeedRadarChart = ({ data, size = 160, className }: FeedRadarChartProps) => {
  // Filter to only axes that have data
  const activeAxes = ALL_AXES.filter((a) => data[a.key] != null && data[a.key]! > 0);

  if (activeAxes.length < 3) return null; // Need at least 3 axes to render

  // Recalculate angles evenly based on active axes count
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

  // Target zone at ring 3
  const targetPath = makePath(axes.map((a) => getPoint(a.angle, 3)));
  // Data shape
  const dataPoints = axes.map((a) => getPoint(a.angle, data[a.key]!));
  const dataPath = makePath(dataPoints);

  // Average of active axes
  const avg = axes.reduce((sum, a) => sum + (data[a.key] || 0), 0) / axes.length;

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* Grid rings 1-5 */}
        {[1, 2, 3, 4, 5].map((ring) => {
          const ringPath = makePath(axes.map((a) => getPoint(a.angle, ring)));
          return (
            <path
              key={ring}
              d={ringPath}
              fill="none"
              stroke={ring === 3 ? "hsl(163 78% 20% / 0.25)" : "hsl(0 0% 0% / 0.06)"}
              strokeWidth={ring === 3 ? 1.5 : 0.5}
              strokeDasharray={ring === 3 ? "3 2" : undefined}
            />
          );
        })}

        {/* Axis lines */}
        {axes.map((a, i) => {
          const outer = getPoint(a.angle, 5);
          return (
            <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y}
              stroke="hsl(0 0% 0% / 0.06)" strokeWidth={0.5} />
          );
        })}

        {/* Target zone fill */}
        <path d={targetPath} fill="hsl(163 78% 20% / 0.05)" stroke="none" />

        {/* Data shape */}
        <path d={dataPath}
          fill="hsl(163 78% 20% / 0.12)"
          stroke="hsl(163 78% 20% / 0.8)"
          strokeWidth={1.5} strokeLinejoin="round" />

        {/* Data points */}
        {dataPoints.map((p, i) => {
          const val = data[axes[i].key]!;
          const color = val >= 4 ? "hsl(163 78% 20%)" : val >= 3 ? "hsl(105 24% 70%)" : val >= 2 ? "hsl(32 95% 44%)" : "hsl(0 68% 35%)";
          return (
            <circle key={i} cx={p.x} cy={p.y} r={3}
              fill={color} stroke="white" strokeWidth={1.5} />
          );
        })}

        {/* Axis labels */}
        {axes.map((a, i) => {
          const labelPoint = getPoint(a.angle, 6.2);
          return (
            <text key={i} x={labelPoint.x} y={labelPoint.y}
              textAnchor="middle" dominantBaseline="middle"
              fill="hsl(0 0% 45%)" fontSize="7" fontWeight="500" fontFamily="Kanit, sans-serif">
              {a.icon} {a.label}
            </text>
          );
        })}

        {/* Center average */}
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
          fill="hsl(163 78% 20%)" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">
          {avg.toFixed(1)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle"
          fill="hsl(0 0% 45%)" fontSize="6" fontWeight="400" fontFamily="Kanit, sans-serif">
          คะแนนเฉลี่ย
        </text>
      </svg>
    </div>
  );
};

export default FeedRadarChart;
