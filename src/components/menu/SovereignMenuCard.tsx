import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import { getIntensityOpacity } from "@/lib/scoring";

/** HSL values for each score tier */
const tierHsl: Record<ScoreTier, string> = {
  emerald: "163,78%,20%",
  mint: "105,24%,70%",
  slate: "215,16%,47%",
  amber: "32,95%,44%",
  ruby: "0,68%,35%",
};

interface IntensityTag {
  icon: string;
  label: string;
  score: number; // -2 to +2
  count: number; // review count for opacity
}

interface SovereignMenuCardProps {
  name: string;
  price: number;
  priceSpecial?: number | null;
  imageUrl?: string;
  tags: IntensityTag[];
  totalReviews: number;
  onPress: () => void;
  index?: number;
}

const SovereignMenuCard = ({
  name,
  price,
  priceSpecial,
  imageUrl,
  tags,
  totalReviews,
  onPress,
  index = 0,
}: SovereignMenuCardProps) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileTap={{ scale: 0.97 }}
      onClick={() => {
        navigator.vibrate?.(8);
        onPress();
      }}
      className="w-full flex gap-3.5 p-3 rounded-2xl bg-surface-elevated shadow-luxury border border-border/40 text-left transition-shadow hover:shadow-card-elevated active:shadow-none"
    >
      {/* Left: Food image 1:1 */}
      <div className="w-[88px] h-[88px] rounded-xl overflow-hidden flex-shrink-0 bg-secondary">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-secondary to-muted">
            🍽️
          </div>
        )}
      </div>

      {/* Right: Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="text-[15px] font-bold text-foreground leading-tight truncate">
            {name}
          </h3>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-sm font-semibold text-score-emerald">
              ฿{price}
            </span>
            {priceSpecial != null && (
              <span className="text-[11px] font-light text-muted-foreground">
                พิเศษ ฿{priceSpecial}
              </span>
            )}
          </div>
        </div>

        {/* Intensity Tags (pill shape) */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.slice(0, 3).map((tag) => {
              const isPositive = tag.score >= 1;
              const isNegative = tag.score <= -1;
              const opacity = tagOpacity(tag.count);

              return (
                <span
                  key={`${tag.icon}-${tag.label}`}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-semibold leading-none",
                    isPositive && "text-white",
                    isNegative && "text-white",
                    !isPositive && !isNegative && "text-white"
                  )}
                  style={{
                    backgroundColor: isPositive
                      ? `hsla(163,78%,20%,${opacity})`
                      : isNegative
                        ? `hsla(0,68%,35%,${opacity})`
                        : `hsla(215,16%,47%,${opacity})`,
                  }}
                >
                  <span>{tag.icon}</span>
                  <span className="truncate max-w-[80px]">{tag.label}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.button>
  );
};

export default SovereignMenuCard;
