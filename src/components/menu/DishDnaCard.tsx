import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DishComponent, DishDnaSelection } from "@/lib/dish-dna-types";

interface DishDnaCardProps {
  component: DishComponent;
  selection: DishDnaSelection | null;
  onSelect: (score: -2 | 0 | 2, tag: string) => void;
  index: number;
}

interface TagConfig {
  score: -2 | 0 | 2;
  bg: string;
  bgSelected: string;
  text: string;
  ring: string;
  dot: string;
}

const tagConfigs: TagConfig[] = [
  {
    score: 2,
    bg: "bg-score-emerald/6 border-score-emerald/12 hover:bg-score-emerald/12",
    bgSelected: "bg-score-emerald/15 border-score-emerald/30 shadow-[0_0_16px_hsla(163,78%,20%,0.15)]",
    text: "text-score-emerald",
    ring: "ring-score-emerald/40",
    dot: "bg-score-emerald",
  },
  {
    score: 0,
    bg: "bg-score-slate/6 border-score-slate/12 hover:bg-score-slate/12",
    bgSelected: "bg-score-slate/15 border-score-slate/30 shadow-[0_0_16px_hsla(215,16%,47%,0.12)]",
    text: "text-score-slate",
    ring: "ring-score-slate/40",
    dot: "bg-score-slate",
  },
  {
    score: -2,
    bg: "bg-score-ruby/6 border-score-ruby/12 hover:bg-score-ruby/12",
    bgSelected: "bg-score-ruby/15 border-score-ruby/30 shadow-[0_0_16px_hsla(0,68%,35%,0.15)]",
    text: "text-score-ruby",
    ring: "ring-score-ruby/40",
    dot: "bg-score-ruby",
  },
];

const scoreKeyMap: Record<string, "emerald" | "neutral" | "ruby"> = {
  "2": "emerald",
  "0": "neutral",
  "-2": "ruby",
};

const DishDnaCard = ({ component, selection, onSelect, index }: DishDnaCardProps) => {
  // Flatten all tags into a single list with their config
  const allTags: Array<{ tag: string; config: TagConfig }> = [];

  for (const cfg of tagConfigs) {
    const key = scoreKeyMap[String(cfg.score)];
    const tags = component.tags[key];
    // Support both old (string) and new (string[]) format
    const tagArray = Array.isArray(tags) ? tags : [tags];
    for (const tag of tagArray) {
      if (tag) allTags.push({ tag, config: cfg });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: index * 0.08,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="bg-surface-elevated rounded-[20px] shadow-luxury overflow-hidden"
    >
      {/* Component Header */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{component.icon}</span>
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
            {component.name}
          </h3>
          <AnimatePresence>
            {selection && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                className="ml-auto w-5 h-5 rounded-full bg-score-emerald flex items-center justify-center"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Horizontal Tag Chips */}
      <div className="px-4 pb-4 pt-1">
        <div className="flex flex-wrap gap-2">
          {allTags.map(({ tag, config }) => {
            const isSelected = selection?.selected_tag === tag && selection?.selected_score === config.score;

            return (
              <motion.button
                key={`${config.score}-${tag}`}
                whileTap={{ scale: 0.93 }}
                onClick={() => onSelect(config.score, tag)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition-all duration-200 leading-none",
                  isSelected
                    ? cn(config.bgSelected, config.text, "ring-1", config.ring)
                    : cn(config.bg, "text-foreground/65")
                )}
              >
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                    isSelected ? config.dot : "bg-muted-foreground/30"
                  )}
                />
                <span className="whitespace-nowrap">{tag}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default DishDnaCard;
