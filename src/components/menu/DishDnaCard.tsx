import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DishComponent, DishDnaSelection } from "@/lib/dish-dna-types";

interface DishDnaCardProps {
  component: DishComponent;
  selection: DishDnaSelection | null;
  onSelect: (score: -2 | 0 | 2, tag: string) => void;
  index: number;
}

const ratingOptions = [
  { score: 2 as const, label: "🤩 สุดยอด", bg: "bg-score-emerald", text: "text-white" },
  { score: 0 as const, label: "😐 ปกติ", bg: "bg-score-slate", text: "text-white" },
  { score: -2 as const, label: "😔 ไม่ชอบ", bg: "bg-score-ruby", text: "text-white" },
];

const scoreColor = (score: -2 | 0 | 2) => {
  if (score === 2) return { ring: "ring-score-emerald/40", bg: "bg-score-emerald/10", text: "text-score-emerald", glow: "shadow-[0_0_16px_hsla(163,78%,20%,0.15)]" };
  if (score === 0) return { ring: "ring-score-slate/40", bg: "bg-score-slate/10", text: "text-score-slate", glow: "shadow-[0_0_12px_hsla(215,16%,47%,0.1)]" };
  return { ring: "ring-score-ruby/40", bg: "bg-score-ruby/10", text: "text-score-ruby", glow: "shadow-[0_0_16px_hsla(0,68%,35%,0.15)]" };
};

const DishDnaCard = ({ component, selection, onSelect, index }: DishDnaCardProps) => {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = [
    { tag: component.tags.emerald, tier: "emerald" },
    { tag: component.tags.neutral, tier: "neutral" },
    { tag: component.tags.ruby, tier: "ruby" },
  ];

  const handleTagTap = (tag: string) => {
    setActiveTag((prev) => (prev === tag ? null : tag));
  };

  const handleRate = (score: -2 | 0 | 2, tag: string) => {
    onSelect(score, tag);
    setActiveTag(null);
  };

  const isTagSelected = (tag: string) => selection?.selected_tag === tag;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-surface-elevated rounded-[20px] shadow-luxury overflow-visible"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-2">
        <span className="text-lg">{component.icon}</span>
        <span className="flex-1 text-[15px] font-semibold text-foreground tracking-tight leading-relaxed">
          {component.name}
        </span>
        {selection && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="w-5 h-5 rounded-full bg-score-emerald flex items-center justify-center"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}
      </div>

      {/* Tags — always visible */}
      <div className="px-4 pb-4 pt-1 flex flex-wrap gap-2 relative">
        {allTags.map(({ tag }) => {
          const selected = isTagSelected(tag);
          const selColor = selected && selection ? scoreColor(selection.selected_score) : null;

          return (
            <div key={tag} className="relative">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => handleTagTap(tag)}
                className={cn(
                  "inline-flex items-center px-4 py-2.5 rounded-2xl border text-[13px] font-medium transition-all duration-300 leading-relaxed",
                  selected && selColor
                    ? cn(selColor.bg, selColor.text, "ring-1", selColor.ring, selColor.glow, "border-transparent")
                    : activeTag === tag
                      ? "bg-foreground/5 border-foreground/20 text-foreground"
                      : "bg-secondary/50 border-border/40 text-foreground/60 hover:bg-secondary"
                )}
              >
                <span className="whitespace-nowrap">{tag}</span>
              </motion.button>

              {/* Rating Popup */}
              <AnimatePresence>
                {activeTag === tag && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -4 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 flex items-center gap-1.5 p-1.5 rounded-2xl bg-surface-elevated shadow-card-elevated border border-border/30"
                  >
                    {ratingOptions.map((opt) => (
                      <motion.button
                        key={opt.score}
                        whileTap={{ scale: 0.88 }}
                        onClick={() => handleRate(opt.score, tag)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all",
                          opt.bg, opt.text
                        )}
                      >
                        {opt.label}
                      </motion.button>
                    ))}
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
