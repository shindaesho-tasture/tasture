import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SensoryAxis } from "@/lib/sensory-types";

interface SensorySliderCardProps {
  axis: SensoryAxis;
  value: number; // 1-5
  onChange: (level: number) => void;
  index: number;
  translateTag?: (tag: string) => string;
}

const levelColors: Record<number, { bg: string; text: string; ring: string; dot: string }> = {
  1: { bg: "bg-score-ruby/10", text: "text-score-ruby", ring: "ring-score-ruby/30", dot: "bg-score-ruby" },
  2: { bg: "bg-score-amber/10", text: "text-score-amber", ring: "ring-score-amber/30", dot: "bg-score-amber" },
  3: { bg: "bg-score-emerald/10", text: "text-score-emerald", ring: "ring-score-emerald/30", dot: "bg-score-emerald" },
  4: { bg: "bg-score-amber/10", text: "text-score-amber", ring: "ring-score-amber/30", dot: "bg-score-amber" },
  5: { bg: "bg-score-ruby/10", text: "text-score-ruby", ring: "ring-score-ruby/30", dot: "bg-score-ruby" },
};

const SensorySliderCard = ({ axis, value, onChange, index }: SensorySliderCardProps) => {
  const colors = levelColors[value];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-surface-elevated rounded-[20px] shadow-luxury p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-lg">{axis.icon}</span>
        <span className="text-[15px] font-semibold text-foreground tracking-tight">{axis.name}</span>
        <motion.span
          key={value}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn("ml-auto text-[11px] font-medium px-2.5 py-1 rounded-xl", colors.bg, colors.text)}
        >
          {axis.labels[value - 1]}
        </motion.span>
      </div>

      {/* 5-Point Selector */}
      <div className="relative">
        {/* Track */}
        <div className="relative h-8 flex items-center">
          {/* Background track line */}
          <div className="absolute left-[10%] right-[10%] h-[3px] rounded-full bg-border" />
          
          {/* Emerald center marker */}
          <div className="absolute left-1/2 -translate-x-1/2 w-1 h-4 rounded-full bg-score-emerald/30" />

          {/* Points */}
          <div className="relative w-full flex justify-between px-[6%]">
            {[1, 2, 3, 4, 5].map((level) => {
              const isActive = value === level;
              const lc = levelColors[level];
              return (
                <motion.button
                  key={level}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => onChange(level)}
                  className={cn(
                    "relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive
                      ? cn(lc.dot, "ring-4", lc.ring, "shadow-lg text-primary-foreground")
                      : "bg-secondary hover:bg-muted text-muted-foreground"
                  )}
                >
                  <span className={cn("text-[11px] font-bold", isActive ? "text-primary-foreground" : "")}>
                    {level}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Labels below */}
        <div className="flex justify-between px-0 mt-2">
          {axis.labels.map((label, i) => {
            const isActive = value === i + 1;
            const lc = levelColors[i + 1];
            return (
              <motion.button
                key={i}
                onClick={() => onChange(i + 1)}
                className={cn(
                  "flex-1 text-center px-0.5 py-1 rounded-lg transition-all",
                  isActive ? cn(lc.bg) : "hover:bg-secondary/50"
                )}
              >
                <span className={cn(
                  "text-[8px] leading-tight font-medium block",
                  isActive ? lc.text : "text-muted-foreground/60"
                )}>
                  {label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default SensorySliderCard;
