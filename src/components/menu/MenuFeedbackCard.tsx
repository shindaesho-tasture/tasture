import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Dna, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import { supabase } from "@/integrations/supabase/client";
import type { SensoryAxis } from "@/lib/sensory-types";
import { useLanguage } from "@/lib/language-context";
import { useTagTranslations } from "@/hooks/use-tag-translations";
import SensorySliderCard from "./SensorySliderCard";
import BalanceSpiderChart from "./BalanceSpiderChart";

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

const tagScoreConfig: Record<number, { bg: string; text: string }> = {
  2: { bg: "bg-score-emerald/10", text: "text-score-emerald" },
  0: { bg: "bg-score-slate/10", text: "text-score-slate" },
  [-2]: { bg: "bg-score-ruby/10", text: "text-score-ruby" },
};

/** Mini circular gauge for average score */
const ScoreGauge = ({ score, count, tier, personsLabel }: { score: number; count: number; tier: ScoreTier; personsLabel: string }) => {
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
        {count} {personsLabel}
      </span>
    </div>
  );
};

const MenuFeedbackCard = ({ item, myScore, onRate, index = 0 }: MenuFeedbackCardProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const hasAvg = item.avg_score !== null;
  const avgTier = hasAvg ? getScoreTier(item.avg_score!) : null;
  const config = typeConfig[item.type] || typeConfig.standard;
  const [topTags, setTopTags] = useState<DnaTag[]>([]);

  const tagTexts = useMemo(() => topTags.map((t) => t.selected_tag), [topTags]);
  const { translateTag } = useTagTranslations(tagTexts);
  // Taste satisfaction gate
  const [tasteSatisfaction, setTasteSatisfaction] = useState<"perfect" | "ok" | "bad" | null>(null);

  // Sensory feedback state
  const [sensoryExpanded, setSensoryExpanded] = useState(false);
  const [sensoryAxes, setSensoryAxes] = useState<SensoryAxis[]>([]);
  const [sensoryValues, setSensoryValues] = useState<Record<string, number>>({});
  const [loadingSensory, setLoadingSensory] = useState(false);
  const [sensoryLoaded, setSensoryLoaded] = useState(false);

  // Fetch top 3 most emotional tags
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dish_dna")
        .select("component_icon, selected_tag, selected_score")
        .eq("menu_item_id", item.id)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        const sorted = [...data].sort((a, b) => Math.abs(b.selected_score) - Math.abs(a.selected_score));
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

  const handleTasteSatisfaction = async (choice: "perfect" | "ok" | "bad") => {
    setTasteSatisfaction(choice);
    if (choice === "perfect") {
      setSensoryExpanded(false);
      onRate(2);
    } else {
      await loadSensoryData();
      setSensoryExpanded(true);
    }
  };

  const loadSensoryData = async () => {
    if (sensoryLoaded) return;
    setLoadingSensory(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-sensory", {
        body: { dishName: item.name },
      });
      if (error) throw error;
      if (data?.axes) {
        setSensoryAxes(data.axes);
        const defaults: Record<string, number> = {};
        data.axes.forEach((a: SensoryAxis) => { defaults[a.name] = 3; });
        setSensoryValues(defaults);
        setSensoryLoaded(true);
      }
    } catch (err) {
      console.error("Sensory analysis error:", err);
    } finally {
      setLoadingSensory(false);
    }
  };

  const handleExpandSensory = async () => {
    if (sensoryExpanded) {
      setSensoryExpanded(false);
      return;
    }
    setSensoryExpanded(true);
    await loadSensoryData();
  };

  const handleSensoryChange = (axisName: string, level: number) => {
    setSensoryValues((prev) => ({ ...prev, [axisName]: level }));
  };

  const computeSensoryScore = (): number | null => {
    if (sensoryAxes.length === 0) return null;
    const vals = Object.values(sensoryValues);
    if (vals.length === 0) return null;
    const balanceScore = vals.reduce((sum, v) => sum + Math.abs(v - 3), 0) / vals.length;
    return Math.round((2 - balanceScore * 2) * 10) / 10;
  };

  const sensoryComputedScore = computeSensoryScore();

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
                    {t("feedback.special")}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Score Gauge */}
          {hasAvg && avgTier && (
            <ScoreGauge score={item.avg_score!} count={item.review_count} tier={avgTier} personsLabel={t("feedback.persons")} />
          )}
          {!hasAvg && (
            <div className="flex flex-col items-center opacity-40">
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                <span className="text-[9px] font-light text-muted-foreground">{t("feedback.noData")}</span>
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
                  <span className="truncate max-w-[120px]">{translateTag(tag.selected_tag)}</span>
                </motion.span>
              );
            })}
          </div>
        )}

        <div className="h-px bg-border/60" />

        {/* ─── Taste Satisfaction Gate ─── */}
        <div className="space-y-3">
          <p className="text-[11px] font-medium text-muted-foreground">{t("feedback.tasteSatisfaction")}</p>
          <div className="flex gap-2">
            {([
              { key: "perfect" as const, labelKey: "feedback.perfect", emoji: "🤩", activeBg: "bg-score-emerald", activeText: "text-primary-foreground" },
              { key: "ok" as const, labelKey: "feedback.ok", emoji: "😐", activeBg: "bg-score-slate", activeText: "text-primary-foreground" },
              { key: "bad" as const, labelKey: "feedback.bad", emoji: "😔", activeBg: "bg-score-ruby", activeText: "text-primary-foreground" },
            ]).map((opt) => {
              const isActive = tasteSatisfaction === opt.key;
              return (
                <motion.button
                  key={opt.key}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => handleTasteSatisfaction(opt.key)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-2xl text-center transition-all duration-200",
                    isActive
                      ? cn(opt.activeBg, opt.activeText, "shadow-lg")
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                  )}
                >
                  <span className="text-lg">{opt.emoji}</span>
                  <span className="text-[9px] font-semibold leading-tight">{t(opt.labelKey)}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Sensory + DNA buttons */}
          {tasteSatisfaction && tasteSatisfaction !== "perfect" && (
            <div className="flex items-center justify-between">
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExpandSensory}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-score-emerald/8 text-score-emerald hover:bg-score-emerald/15 transition-colors"
              >
                <span className="text-sm">🎯</span>
                <span className="text-[11px] font-semibold">{t("feedback.sensory")}</span>
                {sensoryExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => navigate(`/dish-dna/${item.id}?storeId=${item.id}`)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-secondary text-muted-foreground text-[10px] font-medium hover:bg-muted transition-colors"
              >
                <Dna size={12} strokeWidth={2} />
                <span>Dish DNA</span>
              </motion.button>
            </div>
          )}

          {/* ─── Expanded Sensory Dashboard ─── */}
          <AnimatePresence>
            {sensoryExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="overflow-hidden"
              >
                {loadingSensory ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-8 h-8 rounded-full border-[2px] border-border border-t-score-emerald"
                    />
                    <p className="text-[10px] text-muted-foreground">{t("feedback.analyzing")}</p>
                  </div>
                ) : sensoryAxes.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    {sensoryAxes.length >= 3 && (
                      <div className="bg-secondary/30 rounded-2xl p-4">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-[0.15em] mb-2 text-center">
                          Balance Spider Chart
                        </p>
                        <BalanceSpiderChart axes={sensoryAxes} values={sensoryValues} />
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {sensoryAxes.map((axis, i) => (
                        <SensorySliderCard
                          key={axis.name}
                          axis={axis}
                          value={sensoryValues[axis.name] ?? 3}
                          onChange={(level) => handleSensoryChange(axis.name, level)}
                          index={i}
                        />
                      ))}
                    </div>

                    {sensoryComputedScore !== null && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-between p-3 rounded-2xl bg-score-emerald/5 border border-score-emerald/10"
                      >
                        <span className="text-[11px] font-medium text-foreground">{t("feedback.balanceScore")}</span>
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          sensoryComputedScore >= 1 ? "text-score-emerald" :
                          sensoryComputedScore >= 0 ? "text-score-mint" :
                          sensoryComputedScore >= -1 ? "text-score-amber" : "text-score-ruby"
                        )}>
                          {sensoryComputedScore > 0 ? "+" : ""}{sensoryComputedScore.toFixed(1)}
                        </span>
                      </motion.div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-4">{t("feedback.cannotAnalyze")}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default MenuFeedbackCard;
