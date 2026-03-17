import { cn } from "@/lib/utils";

export interface SatisfactionAxes {
  texture: number;   // 1-5
  taste: number;     // 1-5
  overall: number;   // 1-5
  cleanliness: number; // 1-5
  value: number;     // 1-5
}

const AXES = [
  { key: "texture" as const, label: "เท็กซ์เจอร์", icon: "🫧", angle: -90 },
  { key: "taste" as const, label: "รสชาติ", icon: "👅", angle: -18 },
  { key: "value" as const, label: "ความคุ้มค่า", icon: "💰", angle: 54 },
  { key: "cleanliness" as const, label: "ความสะอาด", icon: "✨", angle: 126 },
  { key: "overall" as const, label: "ภาพรวมร้าน", icon: "🏪", angle: 198 },
];

interface FeedRadarChartProps {
  data: SatisfactionAxes;
  size?: number;
  className?: string;
}

const FeedRadarChart = ({ data, size = 160, className }: FeedRadarChartProps) => {
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

  // Ring 3 (balanced) target zone
  const targetPoints = AXES.map((a) => getPoint(a.angle, 3));
  const targetPath = targetPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Data shape
  const dataPoints = AXES.map((a) => getPoint(a.angle, data[a.key]));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Average score for center label
  const avg = (data.texture + data.taste + data.overall + data.cleanliness + data.value) / 5;

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {/* Grid rings 1-5 */}
        {[1, 2, 3, 4, 5].map((ring) => {
          const ringPoints = AXES.map((a) => getPoint(a.angle, ring));
          const ringPath = ringPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
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
        {AXES.map((a, i) => {
          const outer = getPoint(a.angle, 5);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={outer.x}
              y2={outer.y}
              stroke="hsl(0 0% 0% / 0.06)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Target zone fill (ring 3) */}
        <path
          d={targetPath}
          fill="hsl(163 78% 20% / 0.05)"
          stroke="none"
        />

        {/* Data shape */}
        <path
          d={dataPath}
          fill="hsl(163 78% 20% / 0.12)"
          stroke="hsl(163 78% 20% / 0.8)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Data points with tier color */}
        {dataPoints.map((p, i) => {
          const val = data[AXES[i].key];
          const color = val >= 4 ? "hsl(163 78% 20%)" : val >= 3 ? "hsl(105 24% 70%)" : val >= 2 ? "hsl(32 95% 44%)" : "hsl(0 68% 35%)";
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={color}
              stroke="white"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Axis labels */}
        {AXES.map((a, i) => {
          const labelPoint = getPoint(a.angle, 6.2);
          return (
            <text
              key={i}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="hsl(0 0% 45%)"
              fontSize="7"
              fontWeight="500"
              fontFamily="Kanit, sans-serif"
            >
              {a.icon} {a.label}
            </text>
          );
        })}

        {/* Center average */}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="hsl(163 78% 20%)"
          fontSize="14"
          fontWeight="700"
          fontFamily="Inter, sans-serif"
        >
          {avg.toFixed(1)}
        </text>
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="hsl(0 0% 45%)"
          fontSize="6"
          fontWeight="400"
          fontFamily="Kanit, sans-serif"
        >
          คะแนนเฉลี่ย
        </text>
      </svg>
    </div>
  );
};

export default FeedRadarChart;
