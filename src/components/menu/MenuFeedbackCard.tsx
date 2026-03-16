import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Dna } from "lucide-react";
import { cn } from "@/lib/utils";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";

interface MenuFeedbackItem {
  id: string;
  name: string;
  type: string;
  price: number;
  price_special: number | null;
  avg_score: number | null;
  review_count: number;
}

interface MenuFeedbackCardProps {
  item: MenuFeedbackItem;
  myScore: number | null;
  onRate: (value: number) => void;
  index?: number;
}

interface DnaTag {
  component_icon: string;
  selected_tag: string;
  selected_score: number;
}

const tierColorMap: Record<ScoreTier, string> = {
  emerald: "text-score-emerald",
  mint: "text-score-mint",
  slate: "text-score-slate",
  amber: "text-score-amber",
  ruby: "text-score-ruby",
};

const tierStrokeMap: Record<ScoreTier, string> = {
  emerald: "stroke-score-emerald",
  mint: "stroke-score-mint",
  slate: "stroke-score-slate",
  amber: "stroke-score-amber",
  ruby: "stroke-score-ruby",
};

const typeConfig: Record<string, { icon: string; accent: string }> = {
  noodle: { icon: "🍜", accent: "bg-score-emerald/8" },
  dual_price: { icon: "💰", accent: "bg-gold/8" },
  standard: { icon: "🍽️", accent: "bg-score-slate/8" },
};

const ratingOptions = [
  {
    value: -2,
    emoji: "😔",
    label: "ไม่โอเค",
    color: "bg-score-ruby",
    ring: "ring-score-ruby/30",
    glow: "shadow-[0_0_20px_hsla(0,68%,35%,0.25)]",
  },
  {
    value: 0,
    emoji: "😐",
    label: "ปกติ",
    color: "bg-score-slate",
    ring: "ring-score-slate/30",
    glow: "shadow-[0_0_20px_hsla(215,16%,47%,0.2)]",
  },
  {
    value: 2,
    emoji: "🤩",
    label: "สุดยอด",
    color: "bg-score-emerald",
    ring: "ring-score-emerald/30",
    glow: "shadow-[0_0_20px_hsla(163,78%,20%,0.25)]",
  },
];

const tagScoreConfig: Record<number, { bg: string; text: string }> = {
  2: { bg: "bg-score-emerald/10", text: "text-score-emerald" },
  0: { bg: "bg-score-slate/10", text: "text-score-slate" },
  [-2]: { bg: "bg-score-ruby/10", text: "text-score-ruby" },
};

/** Mini circular gauge for average score */
const ScoreGauge = ({ score, count, tier }: { score: number; count: number; tier: ScoreTier }) => {
  const pct = ((score + 2) / 4) * 100;
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative flex flex-col items-center">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="3" className="stroke-border" />
        <motion.circle
          cx="24" cy="24" r={r} fill="none" strokeWidth="3"
          strokeLinecap="round"
          className={tierStrokeMap[tier]}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
          strokeDasharray={circ}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-[11px] font-bold tabular-nums", tierColorMap[tier])}>
          {score > 0 ? "+" : ""}{score.toFixed(1)}
        </span>
      </div>
      <span className="text-[7px] font-light text-muted-foreground mt-0.5 tabular-nums">
        {count} คน
      </span>
    </div>
  );
};

const MenuFeedbackCard = ({ item, myScore, onRate, index = 0 }: MenuFeedbackCardProps) => {
  const navigate = useNavigate();
  const hasAvg = item.avg_score !== null;
  const avgTier = hasAvg ? getScoreTier(item.avg_score!) : null;
  const config = typeConfig[item.type] || typeConfig.standard;
  const [topTags, setTopTags] = useState<DnaTag[]>([]);

  // Fetch top 3 most emotional tags (prioritize +2 and -2)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dish_dna")
        .select("component_icon, selected_tag, selected_score")
        .eq("menu_item_id", item.id)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        // Sort by extremity: +2 and -2 first
        const sorted = [...data].sort((a, b) => Math.abs(b.selected_score) - Math.abs(a.selected_score));
        // Unique by component
        const seen = new Set<string>();
        const unique: DnaTag[] = [];
        for (const d of sorted) {
          if (!seen.has(d.selected_tag) && unique.length < 3) {
            seen.add(d.selected_tag);
            unique.push(d);
          }
        }
        setTopTags(unique);
      }
    })();
  }, [item.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.06,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="bg-surface-elevated rounded-[20px] shadow-luxury overflow-hidden"
    >
      <div className="p-4 space-y-3.5">
        {/* Top: Info + Gauge */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-sm", config.accent)}>
                {config.icon}
              </div>
              <h3 className="text-[15px] font-medium text-foreground leading-snug truncate">
                {item.name}
              </h3>
            </div>

            {/* Price Row */}
            <div className="flex items-baseline gap-2 pl-10">
              <span className="text-sm font-semibold text-foreground tabular-nums">
                ฿{item.price}
              </span>
              {item.type === "dual_price" && item.price_special != null && (
                <>
                  <span className="text-[10px] text-muted-foreground">/</span>
                  <span className="text-sm font-semibold text-score-emerald tabular-nums">
                    ฿{item.price_special}
                  </span>
                  <span className="text-[8px] font-medium text-score-emerald uppercase tracking-wider">
                    พิเศษ
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Score Gauge */}
          {hasAvg && avgTier && (
            <ScoreGauge score={item.avg_score!} count={item.review_count} tier={avgTier} />
          )}
          {!hasAvg && (
            <div className="flex flex-col items-center opacity-40">
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <span className="text-[9px] font-light text-muted-foreground">ยังไม่มี</span>
              </div>
            </div>
          )}
        </div>

        {/* ─── Top 3 DNA Tags ─── */}
        {topTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-10">
            {topTags.map((tag, i) => {
              const cfg = tagScoreConfig[tag.selected_score] || tagScoreConfig[0];
              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium",
                    cfg.bg, cfg.text
                  )}
                >
                  <span>{tag.component_icon}</span>
                  <span className="truncate max-w-[120px]">{tag.selected_tag}</span>
                </motion.span>
              );
            })}
          </div>
        )}

        <div className="h-px bg-border/60" />

        {/* Rating + DNA Button */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
              ให้คะแนนเมนูนี้
            </span>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => navigate(`/dish-dna/${item.id}?storeId=${item.id}`)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-score-emerald/8 text-score-emerald text-[10px] font-medium hover:bg-score-emerald/15 transition-colors"
            >
              <Dna size={12} strokeWidth={2} />
              <span>Dish DNA</span>
            </motion.button>
          </div>

          <div className="flex items-center gap-2">
            {ratingOptions.map((opt) => {
              const isActive = myScore === opt.value;
              return (
                <motion.button
                  key={opt.value}
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => onRate(opt.value)}
                  className={cn(
                    "flex-1 relative flex flex-col items-center gap-1 py-2.5 rounded-2xl transition-all duration-300",
                    isActive
                      ? cn(opt.color, "text-primary-foreground ring-2", opt.ring, opt.glow)
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                  )}
                >
                  <motion.span
                    className="text-lg leading-none"
                    animate={isActive ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {opt.emoji}
                  </motion.span>
                  <span className={cn(
                    "text-[9px] font-medium tracking-wide",
                    isActive ? "text-primary-foreground" : "text-muted-foreground"
                  )}>
                    {opt.label}
                  </span>

                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary-foreground border-2 border-current"
                        style={{ borderColor: "inherit" }}
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MenuFeedbackCard;
