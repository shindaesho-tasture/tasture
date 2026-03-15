import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import {
  getIntensityOpacity,
  getScoreSuffix,
  selectTopTags,
  type ResultCardData,
  type MetricScore,
} from "@/lib/scoring";

// Map score tiers to tailwind token classes
const tierColorMap: Record<ScoreTier, { bg: string; text: string; dot: string }> = {
  emerald: { bg: "bg-score-emerald", text: "text-score-emerald", dot: "bg-score-emerald" },
  mint: { bg: "bg-score-mint", text: "text-score-mint", dot: "bg-score-mint" },
  slate: { bg: "bg-score-slate", text: "text-score-slate", dot: "bg-score-slate" },
  amber: { bg: "bg-score-amber", text: "text-score-amber", dot: "bg-score-amber" },
  ruby: { bg: "bg-score-ruby", text: "text-score-ruby", dot: "bg-score-ruby" },
};

interface ScoreBarProps {
  metric: MetricScore;
}

const ScoreBar = ({ metric }: ScoreBarProps) => {
  const tier = getScoreTier(metric.score);
  const opacity = getIntensityOpacity(metric.reviewCount);
  const colors = tierColorMap[tier];
  // Map score from [-2, 2] to percentage [0, 100]
  const percentage = ((metric.score + 2) / 4) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{metric.icon}</span>
          <span className="text-[11px] font-medium text-foreground">{metric.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[11px] font-semibold tabular-nums", colors.text)}>
            {metric.score > 0 ? "+" : ""}{metric.score.toFixed(1)}
          </span>
          <span className="text-[9px] text-muted-foreground">
            ({metric.reviewCount})
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className={cn("h-full rounded-full", colors.bg)}
          style={{ opacity }}
        />
      </div>
    </div>
  );
};

interface TagBadgeProps {
  metric: MetricScore;
}

const TagBadge = ({ metric }: TagBadgeProps) => {
  const tier = getScoreTier(metric.score);
  const opacity = getIntensityOpacity(metric.reviewCount);
  const colors = tierColorMap[tier];
  const suffix = getScoreSuffix(metric);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold leading-none",
        colors.bg,
        "text-white"
      )}
      style={{ opacity }}
    >
      <span>{metric.icon}</span>
      <span className="truncate max-w-[120px]">{suffix}</span>
    </span>
  );
};

interface ResultCardProps {
  data: ResultCardData;
  index?: number;
}

const ResultCard = ({ data, index = 0 }: ResultCardProps) => {
  const topTags = selectTopTags(data.metrics, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.08,
        duration: 0.5,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 overflow-hidden"
    >
      {/* Card Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl flex-shrink-0">{data.categoryIcon}</span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate">{data.name}</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {data.categoryLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Tags — max 4, sorted by extremity */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {topTags.map((m) => (
            <TagBadge key={m.id} metric={m} />
          ))}
        </div>
      </div>

      {/* Score Bars */}
      <div className="px-4 pb-4 space-y-2.5">
        {data.metrics.map((metric) => (
          <ScoreBar key={metric.id} metric={metric} />
        ))}
      </div>
    </motion.div>
  );
};

export default ResultCard;
