import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MenuRatingButtonsProps {
  rating?: number;
  onRate: (value: number) => void;
}

const ratings = [
  { value: -2, label: "-2", color: "bg-score-ruby", activeRing: "ring-score-ruby/40" },
  { value: 0, label: "0", color: "bg-score-slate", activeRing: "ring-score-slate/40" },
  { value: 2, label: "+2", color: "bg-score-emerald", activeRing: "ring-score-emerald/40" },
];

const MenuRatingButtons = ({ rating, onRate }: MenuRatingButtonsProps) => (
  <div className="flex items-center gap-2">
    {ratings.map((r) => {
      const isActive = rating === r.value;
      return (
        <motion.button
          key={r.value}
          whileTap={{ scale: 0.88 }}
          onClick={() => onRate(r.value)}
          className={cn(
            "w-10 h-10 rounded-xl text-xs font-semibold transition-all duration-200",
            isActive
              ? cn(r.color, "text-primary-foreground shadow-lg ring-2", r.activeRing)
              : "bg-secondary text-muted-foreground hover:bg-muted"
          )}
        >
          {r.label}
        </motion.button>
      );
    })}
  </div>
);

export default MenuRatingButtons;
