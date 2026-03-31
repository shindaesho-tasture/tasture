import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DishComponent, DishDnaSelection } from "@/lib/dish-dna-types";

interface DishDnaCardProps {
  component: DishComponent;
  selection: DishDnaSelection | null;
  onSelect: (score: -2 | 0 | 2, tag: string) => void;
  index: number;
  communityScores?: Record<string, { avgScore: number; count: number }>;
  translateTag?: (tag: string) => string;
}

const ratingOptions = [
  { score: 2 as const, emoji: "🤩", label: "สุดยอด", color: "emerald" as const },
  { score: 0 as const, emoji: "😐", label: "ปกติ", color: "slate" as const },
  { score: -2 as const, emoji: "😔", label: "ไม่ชอบ", color: "ruby" as const },
];

const colorMap = {
  emerald: {
    bg: "bg-score-emerald", ring: "ring-score-emerald/40",
    bgLight: "bg-score-emerald/10", text: "text-score-emerald",
    glow: "shadow-[0_0_20px_hsla(163,78%,20%,0.18)]",
    gradient: "from-score-emerald/15 to-score-emerald/5",
  },
  slate: {
    bg: "bg-score-slate", ring: "ring-score-slate/40",
    bgLight: "bg-score-slate/10", text: "text-score-slate",
    glow: "shadow-[0_0_12px_hsla(215,16%,47%,0.1)]",
    gradient: "from-score-slate/10 to-score-slate/5",
  },
  ruby: {
    bg: "bg-score-ruby", ring: "ring-score-ruby/40",
    bgLight: "bg-score-ruby/10", text: "text-score-ruby",
    glow: "shadow-[0_0_20px_hsla(0,68%,35%,0.18)]",
    gradient: "from-score-ruby/15 to-score-ruby/5",
  },
};

const tagTierMap: Record<string, "emerald" | "slate" | "ruby"> = {};

const DishDnaCard = ({ component, selection, onSelect, index, communityScores, translateTag: tt }: DishDnaCardProps) => {
  const tr = tt || ((t: string) => t);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = [
    { tag: component.tags.emerald, tier: "emerald" as const },
    { tag: component.tags.neutral, tier: "slate" as const },
    { tag: component.tags.ruby, tier: "ruby" as const },
  ];

  const handleTagTap = (tag: string) => {
    navigator.vibrate?.(6);
    setActiveTag((prev) => (prev === tag ? null : tag));
  };

  const handleRate = (score: -2 | 0 | 2, tag: string) => {
    navigator.vibrate?.(12);
    onSelect(score, tag);
    setActiveTag(null);
  };

  const isTagSelected = (tag: string) => selection?.selected_tag === tag;
  const selectedColor = selection
    ? selection.selected_score === 2 ? "emerald"
    : selection.selected_score === 0 ? "slate" : "ruby"
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "bg-surface-elevated rounded-[20px] shadow-luxury overflow-visible transition-all duration-500",
        selection && selectedColor ? colorMap[selectedColor].glow : ""
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-2">
        <div className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all duration-300",
          selection && selectedColor
            ? cn("bg-gradient-to-br", colorMap[selectedColor].gradient)
            : "bg-secondary/50"
        )}>
          {component.icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[15px] font-semibold text-foreground tracking-tight leading-relaxed">
            {tr(component.name)}
          </span>
          {/* Community indicator */}
          {communityScores && Object.keys(communityScores).length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[8px] text-muted-foreground">ชุมชน:</span>
              {allTags.map(({ tag, tier }) => {
                const cs = communityScores[tag];
                if (!cs || cs.count < 1) return null;
                const c = colorMap[tier];
                return (
                  <span key={tag} className={cn("text-[7px] px-1 py-0.5 rounded-md font-medium", c.bgLight, c.text)}>
                    {cs.count}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        {selection && (
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              selectedColor ? colorMap[selectedColor].bg : "bg-score-emerald"
            )}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}
      </div>

      {/* Tags */}
      <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2 relative">
        {allTags.map(({ tag, tier }) => {
          const selected = isTagSelected(tag);
          const c = colorMap[tier];
          const cs = communityScores?.[tag];

          return (
            <div key={tag} className="relative">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => handleTagTap(tag)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-[13px] font-medium transition-all duration-300 leading-relaxed",
                  selected
                    ? cn(c.bgLight, c.text, "ring-1", c.ring, c.glow, "border-transparent font-semibold")
                    : activeTag === tag
                      ? "bg-foreground/5 border-foreground/20 text-foreground"
                      : "bg-secondary/50 border-border/40 text-foreground/60 hover:bg-secondary"
                )}
              >
                <span className="whitespace-nowrap">{tr(tag)}</span>
                {/* Community micro-bar */}
                {cs && cs.count >= 3 && !selected && (
                  <span className={cn("text-[8px] px-1 py-0.5 rounded-md font-bold ml-0.5", c.bgLight, c.text)}>
                    {cs.count}
                  </span>
                )}
              </motion.button>

              {/* Rating Popup - enhanced with tier color hints */}
              <AnimatePresence>
                {activeTag === tag && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface-elevated shadow-card-elevated border border-border/30"
                  >
                    {ratingOptions.map((opt) => {
                      const oc = colorMap[opt.color];
                      return (
                        <motion.button
                          key={opt.score}
                          whileTap={{ scale: 0.88 }}
                          onClick={() => handleRate(opt.score, tag)}
                          className={cn(
                            "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all",
                            oc.bg, "text-white"
                          )}
                        >
                          <span className="text-sm">{opt.emoji}</span>
                          <span className="text-[10px] font-semibold whitespace-nowrap">{opt.label}</span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default DishDnaCard;
