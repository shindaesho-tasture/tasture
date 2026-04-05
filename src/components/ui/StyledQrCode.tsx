import { useMemo } from "react";
import QRCode from "qrcode";

interface StyledQrCodeProps {
  data: string;
  size?: number;
  /** Primary gradient color (dark end) */
  color?: string;
  /** Secondary gradient color (light end) */
  colorSecondary?: string;
  logo?: string | null;
  /** Single letter fallback when no logo */
  logoLetter?: string;
}

// Returns true if (row, col) is inside one of the 3 finder pattern regions
const isFinderZone = (row: number, col: number, sz: number) =>
  (row < 8 && col < 8) ||
  (row < 8 && col >= sz - 8) ||
  (row >= sz - 8 && col < 8);

// Returns true if (row, col) is the alignment pattern area (for version >= 2)
const isAlignmentZone = (row: number, col: number, sz: number) => {
  if (sz < 25) return false; // version 1 has no alignment pattern
  const ap = sz - 7;
  return row >= ap - 2 && row <= ap + 2 && col >= ap - 2 && col <= ap + 2;
};

export const StyledQrCode = ({
  data,
  size = 200,
  color = "#059669",
  colorSecondary = "#34d399",
  logo,
  logoLetter,
}: StyledQrCodeProps) => {
  const matrix = useMemo(() => {
    try {
      const qr = QRCode.create(data, { errorCorrectionLevel: "M" });
      return { data: qr.modules.data, size: qr.modules.size };
    } catch {
      return null;
    }
  }, [data]);

  if (!matrix) return null;

  const { data: modules, size: mSize } = matrix;
  const cellSize = size / mSize;
  const r = cellSize * 0.45; // dot radius — slightly smaller than half cell for spacing
  const gradId = `qrgrad-${data.slice(-6).replace(/\W/g, "")}`;

  // Finder pattern outer square (7x7 → rendered as a rounded rect)
  const renderFinderSquare = (row: number, col: number) => {
    const x = col * cellSize;
    const y = row * cellSize;
    const outerSize = cellSize * 7;
    const innerWhiteSize = cellSize * 5;
    const innerDotSize = cellSize * 3;
    const rOuter = cellSize * 1.2;
    const rInner = cellSize * 0.8;

    return (
      <g key={`finder-${row}-${col}`}>
        {/* Outer square */}
        <rect
          x={x} y={y}
          width={outerSize} height={outerSize}
          rx={rOuter} ry={rOuter}
          fill={`url(#${gradId})`}
        />
        {/* White gap */}
        <rect
          x={x + cellSize} y={y + cellSize}
          width={innerWhiteSize} height={innerWhiteSize}
          rx={rInner} ry={rInner}
          fill="white"
        />
        {/* Inner dot */}
        <rect
          x={x + cellSize * 2} y={y + cellSize * 2}
          width={innerDotSize} height={innerDotSize}
          rx={cellSize * 0.6} ry={cellSize * 0.6}
          fill={`url(#${gradId})`}
        />
      </g>
    );
  };

  const dots: React.ReactNode[] = [];
  let finderSquaresRendered = new Set<string>();

  for (let row = 0; row < mSize; row++) {
    for (let col = 0; col < mSize; col++) {
      const isDark = modules[row * mSize + col] === 1;

      // Skip finder zones — draw them separately as full squares
      if (isFinderZone(row, col, mSize)) {
        // Top-left, top-right, bottom-left corners: render once per finder
        const key =
          row < 8 && col < 8 ? "tl" :
          row < 8 && col >= mSize - 8 ? "tr" : "bl";

        if (!finderSquaresRendered.has(key)) {
          finderSquaresRendered.add(key);
          const startRow = key === "bl" ? mSize - 7 : 0;
          const startCol = key === "tr" ? mSize - 7 : 0;
          dots.push(renderFinderSquare(startRow, startCol));
        }
        continue;
      }

      if (!isDark) continue;

      const cx = col * cellSize + cellSize / 2;
      const cy = row * cellSize + cellSize / 2;

      // Alignment pattern: slightly larger rounded square
      if (isAlignmentZone(row, col, mSize)) {
        dots.push(
          <rect
            key={`${row}-${col}`}
            x={cx - r * 0.85} y={cy - r * 0.85}
            width={r * 1.7} height={r * 1.7}
            rx={r * 0.4} ry={r * 0.4}
            fill={`url(#${gradId})`}
          />
        );
      } else {
        // Regular dots: small circles
        dots.push(
          <circle
            key={`${row}-${col}`}
            cx={cx} cy={cy} r={r}
            fill={`url(#${gradId})`}
          />
        );
      }
    }
  }

  const logoSize = size * 0.18;
  const logoX = (size - logoSize) / 2;
  const logoY = (size - logoSize) / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={colorSecondary} />
        </linearGradient>
        <clipPath id={`logo-clip-${gradId}`}>
          <rect
            x={logoX - 2} y={logoY - 2}
            width={logoSize + 4} height={logoSize + 4}
            rx={logoSize * 0.25}
          />
        </clipPath>
      </defs>

      {/* White background */}
      <rect width={size} height={size} fill="white" />

      {/* QR dots */}
      {dots}

      {/* Logo in center */}
      {(logo || logoLetter) && (
        <g>
          {/* White backing */}
          <rect
            x={logoX - 4} y={logoY - 4}
            width={logoSize + 8} height={logoSize + 8}
            rx={logoSize * 0.3}
            fill="white"
          />
          {/* Gradient border */}
          <rect
            x={logoX - 2} y={logoY - 2}
            width={logoSize + 4} height={logoSize + 4}
            rx={logoSize * 0.27}
            fill={`url(#${gradId})`}
          />
          {/* White inner */}
          <rect
            x={logoX} y={logoY}
            width={logoSize} height={logoSize}
            rx={logoSize * 0.2}
            fill="white"
          />
          {logo ? (
            <image
              href={logo}
              x={logoX + 2} y={logoY + 2}
              width={logoSize - 4} height={logoSize - 4}
              clipPath={`url(#logo-clip-${gradId})`}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <text
              x={size / 2} y={size / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={logoSize * 0.55}
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              fill={color}
            >
              {logoLetter}
            </text>
          )}
        </g>
      )}
    </svg>
  );
};
