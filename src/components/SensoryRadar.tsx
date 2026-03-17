import { motion } from "framer-motion";

const traits = [
  { label: "Crunchy", icon: "🥜", value: 1.8, angle: -60 },
  { label: "Silky", icon: "🫧", value: 1.2, angle: 0 },
  { label: "Umami", icon: "🍖", value: 0.6, angle: 60 },
  { label: "Sweet", icon: "🍯", value: 1.5, angle: 120 },
  { label: "Spicy", icon: "🌶️", value: -0.8, angle: 180 },
  { label: "Sour", icon: "🍋", value: -0.3, angle: 240 },
  { label: "Salty", icon: "🧂", value: 0.9, angle: 300 },
];

interface SensoryRadarProps {
  className?: string;
  data?: { label: string; icon?: string; value: number }[];
}

const SensoryRadar = ({ className, data }: SensoryRadarProps) => {
  const items = data && data.length >= 3 ? data.map((d, i) => ({
    ...d,
    icon: d.icon || "",
    angle: (360 / data.length) * i - 90,
  })) : traits;

  const cx = 80;
  const cy = 80;
  const maxR = 58;

  const getPoint = (angle: number, value: number) => {
    const normalizedVal = ((value + 2) / 4) * maxR;
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + normalizedVal * Math.cos(rad),
      y: cy + normalizedVal * Math.sin(rad),
    };
  };

  const points = items.map((t) => getPoint(t.angle, t.value));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  // Target zone (center at value 0)
  const targetPoints = items.map((t) => getPoint(t.angle, 0));
  const targetPath = targetPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className={className || "absolute bottom-4 left-4 w-[170px] h-[170px] glass-effect rounded-xl p-2 glass-border"}>
      <svg viewBox="0 0 160 160" className="w-full h-full">
        <defs>
          <radialGradient id="sensory-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(163,78%,20%)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background gradient */}
        <circle cx={cx} cy={cy} r={maxR} fill="url(#sensory-gradient)" />

        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle
            key={scale}
            cx={cx} cy={cy} r={maxR * scale}
            fill="none"
            stroke={scale === 0.5 ? "hsla(163,78%,50%,0.25)" : "hsla(0,0%,100%,0.15)"}
            strokeWidth={scale === 0.5 ? 1 : 0.5}
            strokeDasharray={scale === 0.5 ? "3 2" : undefined}
          />
        ))}

        {/* Axis lines */}
        {items.map((t, i) => {
          const outer = getPoint(t.angle, 2);
          return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="hsla(0,0%,100%,0.1)" strokeWidth={0.5} />;
        })}

        {/* Data shape */}
        <motion.path
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          d={pathD}
          fill="hsla(163,78%,40%,0.18)"
          stroke="hsl(163,78%,50%)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Data points with color coding */}
        {points.map((p, i) => {
          const v = items[i].value;
          const color = v >= 1 ? "hsl(163,78%,50%)" : v >= 0 ? "hsl(43,74%,49%)" : v >= -1 ? "hsl(32,95%,50%)" : "hsl(0,68%,45%)";
          return (
            <motion.circle
              key={i}
              initial={{ r: 0 }}
              animate={{ r: Math.abs(v) > 1 ? 3.5 : 2.5 }}
              transition={{ delay: 0.2 + i * 0.04 }}
              cx={p.x} cy={p.y}
              fill={color} stroke="white" strokeWidth={1}
            />
          );
        })}

        {/* Labels */}
        {items.map((t, i) => {
          const labelPoint = getPoint(t.angle, 2.6);
          return (
            <text
              key={i}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="6.5"
              fontWeight="500"
              fontFamily="Kanit, sans-serif"
            >
              {t.icon} {t.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default SensoryRadar;
