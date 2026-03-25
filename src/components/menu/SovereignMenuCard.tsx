import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import { getIntensityOpacity } from "@/lib/scoring";
import { Flame, TrendingUp, Star } from "lucide-react";
import { classifyTag, CATEGORY_CONFIG } from "@/lib/sensory-classifier";

/** HSL values for each score tier */
const tierHsl: Record<ScoreTier, string> = {
  emerald: "163,78%,20%",
  mint: "105,24%,70%",
  slate: "215,16%,47%",
  amber: "32,95%,44%",
  ruby: "0,68%,35%",
};

const tierGlow: Record<ScoreTier, string> = {
  emerald: "shadow-[0_2px_8px_hsla(163,78%,20%,0.2)]",
  mint: "shadow-[0_2px_6px_hsla(105,24%,70%,0.15)]",
  slate: "",
  amber: "shadow-[0_2px_6px_hsla(32,95%,44%,0.15)]",
  ruby: "shadow-[0_2px_8px_hsla(0,68%,35%,0.2)]",
};

export type TagType = "score" | "price" | "popularity" | "recommendation" | "texture";

export interface IntensityTag {
  icon: string;
  label: string;
  score: number; // -2 to +2
  count: number; // review count for opacity
  type?: TagType;
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
  popularityRank?: number;
  avgSatisfaction?: number;
  userPhotos?: string[]; // top user-posted photo URLs (sorted by likes)
}

/** Format compact review count */
const formatCount = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

const SovereignMenuCard = ({
  name,
  price,
  priceSpecial,
  imageUrl,
  tags,
  totalReviews,
  onPress,
  index = 0,
  popularityRank,
  avgSatisfaction,
  userPhotos,
}: SovereignMenuCardProps) => {
  const { t } = useLanguage();
  // Build enriched tags: score tags first, then auto-generated meta tags
  const enrichedTags: IntensityTag[] = [...tags];

  // Auto-add popularity tag if high reviews
  if (totalReviews >= 20 && popularityRank && popularityRank <= 3) {
    enrichedTags.push({
      icon: "🔥",
      label: popularityRank === 1 ? t("common.popular") : `#${popularityRank}`,
      score: 2,
      count: totalReviews,
      type: "popularity",
    });
  }

  // Auto-add recommendation tag if avg satisfaction is high
  if (avgSatisfaction && avgSatisfaction >= 4) {
    enrichedTags.push({
      icon: "⭐",
      label: avgSatisfaction >= 4.5 ? t("common.highlyRecommended") : t("common.recommended"),
      score: 2,
      count: totalReviews,
      type: "recommendation",
    });
  }

  // Auto-add price tag if special price exists
  if (priceSpecial != null && priceSpecial < price) {
    const discount = Math.round(((price - priceSpecial) / price) * 100);
    enrichedTags.push({
      icon: "💰",
      label: `${t("common.discount")} ${discount}%`,
      score: 1,
      count: 100,
      type: "price",
    });
  }

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
      className="w-full rounded-2xl bg-surface-elevated shadow-luxury border border-border/40 text-left transition-shadow hover:shadow-card-elevated active:shadow-none overflow-hidden"
    >
      <div className="flex gap-3.5 p-3">
        {/* Left: Food image 1:1 */}
        <div className="w-[88px] h-[88px] rounded-xl overflow-hidden flex-shrink-0 bg-secondary relative">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl bg-gradient-to-br from-secondary to-muted">🍽️</div>
          )}
          {/* Review count badge */}
          {totalReviews > 0 && (
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-lg bg-foreground/70 backdrop-blur-sm">
              <span className="text-[8px] font-semibold text-background">{formatCount(totalReviews)} รีวิว</span>
            </div>
          )}
        </div>

        {/* Right: Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <h3 className="text-[15px] font-bold text-foreground leading-tight truncate">{name}</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-sm font-semibold text-score-emerald">฿{price}</span>
              {priceSpecial != null && (
                <span className="text-[11px] font-light text-muted-foreground line-through">฿{priceSpecial}</span>
              )}
            </div>
          </div>

          {/* Intensity Tags */}
          {enrichedTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {enrichedTags.slice(0, 4).map((tag) => {
                const isMetaTag = tag.type && !["score", "texture"].includes(tag.type);

                // Texture tags: neutral style, show popularity count
                if (tag.type === "texture") {
                  const tier = getScoreTier(tag.score);
                  const hsl = tierHsl[tier];
                  const opacity = getIntensityOpacity(tag.count);
                  const bgOpacity = Math.max(0.45, opacity);
                  const classified = classifyTag(tag.label);
                  return (
                    <span
                      key={`${tag.icon}-${tag.label}`}
                      className={cn(
                        "inline-flex items-center gap-0.5 px-2 py-[3px] rounded-full text-[9px] font-bold leading-none text-white transition-shadow",
                        tierGlow[tier]
                      )}
                      style={{ backgroundColor: `hsla(${hsl},${bgOpacity})` }}
                    >
                      <span>{classified.icon}</span>
                      <span className="truncate max-w-[72px]">{tag.label}</span>
                      {tag.count >= 2 && (
                        <span className="opacity-50 text-[7px] ml-0.5">({formatCount(tag.count)})</span>
                      )}
                    </span>
                  );
                }

                if (isMetaTag) {
                  const metaStyles: Record<string, string> = {
                    popularity: "bg-gradient-to-r from-score-amber/90 to-score-ruby/80",
                    recommendation: "bg-gradient-to-r from-score-emerald/90 to-score-mint/80",
                    price: "bg-gradient-to-r from-primary/80 to-primary/60",
                  };
                  return (
                    <span
                      key={`${tag.type}-${tag.label}`}
                      className={cn(
                        "inline-flex items-center gap-0.5 px-2 py-[3px] rounded-full text-[9px] font-bold leading-none text-white",
                        metaStyles[tag.type!] || "bg-primary/80"
                      )}
                    >
                      <span>{tag.icon}</span>
                      <span>{tag.label}</span>
                    </span>
                  );
                }

                const tier = getScoreTier(tag.score);
                const opacity = getIntensityOpacity(tag.count);
                const hsl = tierHsl[tier];
                const bgOpacity = Math.max(0.45, opacity);

                return (
                  <span
                    key={`${tag.icon}-${tag.label}`}
                    className={cn(
                      "inline-flex items-center gap-0.5 px-2 py-[3px] rounded-full text-[9px] font-bold leading-none text-white transition-shadow",
                      tierGlow[tier]
                    )}
                    style={{ backgroundColor: `hsla(${hsl},${bgOpacity})` }}
                  >
                    <span>{tag.icon}</span>
                    <span className="truncate max-w-[72px]">{tag.label}</span>
                    {tag.count >= 10 && (
                      <span className="opacity-50 text-[7px] ml-0.5">({formatCount(tag.count)})</span>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User-posted photos strip at bottom */}
      {userPhotos && userPhotos.length > 0 && (
        <div className="px-3 pb-3 pt-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground font-medium mr-0.5">📸</span>
            <div className="flex -space-x-1.5">
              {userPhotos.slice(0, 4).map((url, idx) => (
                <div
                  key={idx}
                  className="w-8 h-8 rounded-lg overflow-hidden border-2 border-background flex-shrink-0 shadow-sm"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
            {userPhotos.length > 4 && (
              <span className="text-[9px] text-muted-foreground font-medium ml-1">
                +{userPhotos.length - 4}
              </span>
            )}
            <span className="text-[9px] text-muted-foreground ml-auto">จากผู้ใช้</span>
          </div>
        </div>
      )}
    </motion.button>
  );
};

export default SovereignMenuCard;
