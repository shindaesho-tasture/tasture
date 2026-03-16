import { motion } from "framer-motion";
import { MapPin, Flame, Diamond } from "lucide-react";

export type DiscoveryTab = "nearby" | "trending" | "match";

interface DiscoveryTabsProps {
  active: DiscoveryTab;
  onChange: (tab: DiscoveryTab) => void;
}

const tabs = [
  { id: "nearby" as const, label: "ใกล้สุด", icon: MapPin, emoji: "📍" },
  { id: "trending" as const, label: "เทรนด์", icon: Flame, emoji: "🔥" },
  { id: "match" as const, label: "แมตช์", icon: Diamond, emoji: "💎" },
];

const DiscoveryTabs = ({ active, onChange }: DiscoveryTabsProps) => {
  return (
    <section className="px-4 py-3">
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              whileTap={{ scale: 0.95 }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-3 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                isActive
                  ? "bg-foreground shadow-luxury"
                  : "bg-secondary/80 hover:bg-secondary"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="discovery-tab-bg"
                  className="absolute inset-0 bg-foreground rounded-2xl"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 text-base">{tab.emoji}</span>
              <span
                className={`relative z-10 text-[11px] font-semibold tracking-wide transition-colors duration-300 ${
                  isActive ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};

export default DiscoveryTabs;
