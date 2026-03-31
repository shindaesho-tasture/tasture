// HomeFeedTabs – tab switcher for the home feed
import { motion } from "framer-motion";
import { Compass, MapPin, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";

export type FeedTab = "explore" | "nearby" | "following" | "foryou";

interface HomeFeedTabsProps {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
}

const tabDefs: { id: FeedTab; i18nKey: string; icon: typeof Compass; emoji: string }[] = [
  { id: "explore", i18nKey: "tab.explore", icon: Compass, emoji: "🔍" },
  { id: "nearby", i18nKey: "tab.nearby", icon: MapPin, emoji: "📍" },
  { id: "following", i18nKey: "tab.following", icon: Users, emoji: "👥" },
  { id: "foryou", i18nKey: "tab.foryou", icon: Sparkles, emoji: "✨" },
];

const HomeFeedTabs = ({ active, onChange }: HomeFeedTabsProps) => {
  const { language } = useLanguage();
  return (
    <div className="px-4 pb-3">
      <div className="flex gap-2">
        {tabDefs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl transition-all duration-300 relative overflow-hidden",
                isActive
                  ? "bg-foreground shadow-luxury"
                  : "bg-secondary/80 hover:bg-secondary"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="feed-tab-bg"
                  className="absolute inset-0 bg-foreground rounded-2xl"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 text-sm">{tab.emoji}</span>
              <span
                className={cn(
                  "relative z-10 text-[10px] font-semibold tracking-wide transition-colors duration-300",
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                )}
              >
                {t(tab.i18nKey, language)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default HomeFeedTabs;
