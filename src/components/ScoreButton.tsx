import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ScoreTier } from "@/lib/categories";

interface ScoreButtonProps {
  value: number;
  label: string;
  tier: ScoreTier;
  shortLabel: string;
  selected: boolean;
  onSelect: (value: number) => void;
}

const tierStyles: Record<ScoreTier, { bg: string; bgSelected: string; text: string; ring: string }> = {
  emerald: {
    bg: "bg-score-emerald/10",
    bgSelected: "bg-score-emerald",
    text: "text-score-emerald",
    ring: "ring-score-emerald/30",
  },
  mint: {
    bg: "bg-score-mint/15",
    bgSelected: "bg-score-mint",
    text: "text-score-mint",
    ring: "ring-score-mint/30",
  },
  slate: {
    bg: "bg-score-slate/10",
    bgSelected: "bg-score-slate",
    text: "text-score-slate",
    ring: "ring-score-slate/30",
  },
  amber: {
    bg: "bg-score-amber/10",
    bgSelected: "bg-score-amber",
    text: "text-score-amber",
    ring: "ring-score-amber/30",
  },
  ruby: {
    bg: "bg-score-ruby/10",
    bgSelected: "bg-score-ruby",
    text: "text-score-ruby",
    ring: "ring-score-ruby/30",
  },
};

const ScoreButton = ({ value, label, tier, shortLabel, selected, onSelect }: ScoreButtonProps) => {
  const styles = tierStyles[tier];

  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={() => onSelect(value)}
      className={cn(
        "relative flex flex-col items-center gap-1.5 rounded-2xl px-3 py-3 transition-all duration-200 ring-2 ring-transparent",
        selected
          ? cn(styles.bgSelected, "text-white shadow-lg", styles.ring)
          : cn(styles.bg, styles.text, "hover:ring-2", styles.ring)
      )}
    >
      <span className="text-base font-bold leading-none">{shortLabel}</span>
      <span className={cn(
        "text-[9px] font-medium leading-tight text-center",
        selected ? "text-white/90" : "opacity-70"
      )}>
        {label}
      </span>
    </motion.button>
  );
};

export default ScoreButton;
