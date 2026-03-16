import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DishComponent, DishDnaSelection } from "@/lib/dish-dna-types";

interface DishDnaCardProps {
  component: DishComponent;
  selection: DishDnaSelection | null;
  onSelect: (score: -2 | 0 | 2, tag: string) => void;
  index: number;
}

const scoreConfig = {
  "2": {
    key: "emerald" as const,
    bg: "bg-score-emerald",
    bgLight: "bg-score-emerald/8",
    text: "text-score-emerald",
    ring: "ring-score-emerald/30",
    glow: "shadow-[0_0_24px_hsla(163,78%,20%,0.2)]",
    label: "+2",
    border: "border-score-emerald/20",
  },
  "0": {
    key: "neutral" as const,
    bg: "bg-score-slate",
    bgLight: "bg-score-slate/8",
    text: "text-score-slate",
    ring: "ring-score-slate/30",
    glow: "shadow-[0_0_24px_hsla(215,16%,47%,0.15)]",
    label: "0",
    border: "border-score-slate/20",
  },
  "-2": {
    key: "ruby" as const,
    bg: "bg-score-ruby",
    bgLight: "bg-score-ruby/8",
    text: "text-score-ruby",
    ring: "ring-score-ruby/30",
    glow: "shadow-[0_0_24px_hsla(0,68%,35%,0.2)]",
    label: "-2",
    border: "border-score-ruby/20",
  },
};

const DishDnaCard = ({ component, selection, onSelect, index }: DishDnaCardProps) => {
  const scores: Array<-2 | 0 | 2> = [2, 0, -2];

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.55,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="bg-surface-elevated rounded-[22px] shadow-luxury overflow-hidden"
    >
      {/* Component Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center text-xl">
            {component.icon}
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              {component.name}
            </h3>
            <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
              เลือกแท็กที่ตรงกับความรู้สึก
            </p>
          </div>
        </div>
      </div>

      {/* Tag Options */}
      <div className="px-4 pb-5 space-y-2">
        {scores.map((score) => {
          const config = scoreConfig[String(score) as keyof typeof scoreConfig];
          const tag = component.tags[config.key];
          const isSelected = selection?.selected_score === score;

          return (
            <motion.button
              key={score}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(score, tag)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 text-left",
                isSelected
                  ? cn(config.bgLight, "ring-2", config.ring, config.glow, config.border, "border")
                  : "bg-secondary/60 hover:bg-secondary border border-transparent"
              )}
            >
              {/* Score Badge */}
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300",
                  isSelected
                    ? cn(config.bg, "text-primary-foreground")
                    : "bg-muted text-muted-foreground"
                )}
              >
                {config.label}
              </div>

              {/* Tag Text */}
              <span
                className={cn(
                  "text-[13px] font-medium leading-snug flex-1 transition-colors duration-300",
                  isSelected ? config.text : "text-foreground/70"
                )}
              >
                {tag}
              </span>

              {/* Selected Check */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", config.bg)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DishDnaCard;
