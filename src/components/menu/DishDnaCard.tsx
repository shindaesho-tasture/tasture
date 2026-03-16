import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DishComponent, DishDnaSelection } from "@/lib/dish-dna-types";

interface DishDnaCardProps {
  component: DishComponent;
  selection: DishDnaSelection | null;
  onSelect: (score: -2 | 0 | 2, tag: string) => void;
  index: number;
}

interface ScoreOption {
  score: -2 | 0 | 2;
  label: string;
  dot: string;
  selectedBg: string;
  selectedText: string;
  selectedGlow: string;
  selectedRing: string;
}

const scoreOptions: ScoreOption[] = [
  {
    score: 2,
    label: "+2",
    dot: "bg-score-emerald",
    selectedBg: "bg-score-emerald/10",
    selectedText: "text-score-emerald",
    selectedGlow: "shadow-[0_0_20px_hsla(163,78%,20%,0.2)]",
    selectedRing: "ring-1 ring-score-emerald/30",
  },
  {
    score: 0,
    label: "0",
    dot: "bg-score-slate",
    selectedBg: "bg-score-slate/10",
    selectedText: "text-score-slate",
    selectedGlow: "shadow-[0_0_16px_hsla(215,16%,47%,0.15)]",
    selectedRing: "ring-1 ring-score-slate/30",
  },
  {
    score: -2,
    label: "-2",
    dot: "bg-score-ruby",
    selectedBg: "bg-score-ruby/10",
    selectedText: "text-score-ruby",
    selectedGlow: "shadow-[0_0_20px_hsla(0,68%,35%,0.2)]",
    selectedRing: "ring-1 ring-score-ruby/30",
  },
];

const getTagForScore = (component: DishComponent, score: -2 | 0 | 2): string => {
  if (score === 2) return component.tags.emerald;
  if (score === 0) return component.tags.neutral;
  return component.tags.ruby;
};

const DishDnaCard = ({ component, selection, onSelect, index }: DishDnaCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => setExpanded((prev) => !prev);

  const handleSelect = (opt: ScoreOption) => {
    const tag = getTagForScore(component, opt.score);
    onSelect(opt.score, tag);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.06,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="bg-surface-elevated rounded-[20px] shadow-luxury overflow-hidden"
    >
      {/* Collapsed Header — always visible */}
      <motion.button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-lg">{component.icon}</span>
        <span className="flex-1 text-[15px] font-semibold text-foreground tracking-tight leading-relaxed">
          {component.name}
        </span>

        {/* Score dots — quick glance at 3 tiers */}
        <div className="flex items-center gap-1.5 mr-1">
          {scoreOptions.map((opt) => {
            const isSelected = selection?.selected_score === opt.score;
            return (
              <div
                key={opt.score}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  isSelected
                    ? cn(opt.dot, "scale-125")
                    : "bg-muted-foreground/20"
                )}
              />
            );
          })}
        </div>

        {/* Selection indicator or chevron */}
        <AnimatePresence mode="wait">
          {selection ? (
            <motion.div
              key="check"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="w-5 h-5 rounded-full bg-score-emerald flex items-center justify-center"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          ) : (
            <motion.div
              key="chevron"
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.25 }}
            >
              <ChevronDown size={16} className="text-muted-foreground" strokeWidth={1.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Expanded Tags — 3 emotional texture tags */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0.5 flex flex-wrap gap-2">
              {scoreOptions.map((opt) => {
                const tag = getTagForScore(component, opt.score);
                const isSelected = selection?.selected_score === opt.score;

                return (
                  <motion.button
                    key={opt.score}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[13px] font-medium transition-all duration-300 leading-relaxed",
                      isSelected
                        ? cn(opt.selectedBg, opt.selectedText, opt.selectedRing, opt.selectedGlow, "border-transparent")
                        : "bg-secondary/50 border-border/40 text-foreground/60 hover:bg-secondary"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 transition-all duration-300",
                        isSelected ? opt.dot : "bg-muted-foreground/25"
                      )}
                    />
                    <span className="whitespace-nowrap">{tag}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DishDnaCard;
