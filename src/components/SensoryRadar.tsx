const traits = [
  { label: "Crunchy", value: 1.8, angle: -60 },
  { label: "Silky", value: 1.2, angle: 0 },
  { label: "Umami", value: 0.6, angle: 60 },
  { label: "Sweet", value: 1.5, angle: 120 },
  { label: "Bitter", value: -0.8, angle: 180 },
  { label: "Acidic", value: -0.3, angle: 240 },
];

const SensoryRadar = () => {
  const cx = 70;
  const cy = 70;
  const maxR = 50;

  const getPoint = (angle: number, value: number) => {
    const normalizedVal = ((value + 2) / 4) * maxR;
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + normalizedVal * Math.cos(rad),
      y: cy + normalizedVal * Math.sin(rad),
    };
  };

  const points = traits.map((t) => getPoint(t.angle, t.value));
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="absolute bottom-4 left-4 w-[160px] h-[160px] glass-effect rounded-xl p-2 glass-border">
      <svg viewBox="0 0 140 140" className="w-full h-full">
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <circle
            key={scale}
            cx={cx}
            cy={cy}
            r={maxR * scale}
            fill="none"
            stroke="hsla(0,0%,100%,0.2)"
            strokeWidth={0.5}
          />
        ))}

        {/* Data shape */}
        <path
          d={pathD}
          fill="hsla(43,74%,49%,0.2)"
          stroke="hsl(43,74%,49%)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="hsl(43,74%,49%)" />
        ))}

        {/* Labels */}
        {traits.map((t, i) => {
          const labelPoint = getPoint(t.angle, 2.6);
          return (
            <text
              key={i}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="7"
              fontWeight="500"
            >
              {t.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default SensoryRadar;
