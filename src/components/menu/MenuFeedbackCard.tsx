import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import MenuRatingButtons from "./MenuRatingButtons";

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
}

const tierColorMap: Record<ScoreTier, string> = {
  emerald: "text-score-emerald",
  mint: "text-score-mint",
  slate: "text-score-slate",
  amber: "text-score-amber",
  ruby: "text-score-ruby",
};

const tierBgMap: Record<ScoreTier, string> = {
  emerald: "bg-score-emerald/15",
  mint: "bg-score-mint/15",
  slate: "bg-score-slate/15",
  amber: "bg-score-amber/15",
  ruby: "bg-score-ruby/15",
};

const typeIcon: Record<string, string> = {
  noodle: "🍜",
  dual_price: "💰",
  standard: "🍽️",
};

const MenuFeedbackCard = ({ item, myScore, onRate }: MenuFeedbackCardProps) => {
  const hasAvg = item.avg_score !== null;
  const avgTier = hasAvg ? getScoreTier(item.avg_score!) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-elevated rounded-2xl shadow-luxury p-4 space-y-3"
    >
      {/* Top row: name + price + avg */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{typeIcon[item.type] || "🍽️"}</span>
            <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">฿{item.price}</span>
            {item.type === "dual_price" && item.price_special && (
              <span className="text-xs text-score-emerald">พิเศษ ฿{item.price_special}</span>
            )}
          </div>
        </div>

        {/* Average Badge */}
        {hasAvg && avgTier && (
          <div className={cn("flex flex-col items-center px-2.5 py-1.5 rounded-xl", tierBgMap[avgTier])}>
            <span className={cn("text-base font-bold tabular-nums leading-none", tierColorMap[avgTier])}>
              {item.avg_score! > 0 ? "+" : ""}
              {item.avg_score!.toFixed(1)}
            </span>
            <span className="text-[8px] text-muted-foreground mt-0.5">
              {item.review_count} รีวิว
            </span>
          </div>
        )}
      </div>

      {/* Rating row */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">ให้คะแนน</span>
        <MenuRatingButtons rating={myScore ?? undefined} onRate={onRate} />
      </div>
    </motion.div>
  );
};

export default MenuFeedbackCard;
