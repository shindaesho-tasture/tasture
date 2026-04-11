import { motion } from "framer-motion";
import { LayoutDashboard, ChefHat, BarChart3, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";

const merchantNav = [
  { id: "dashboard", labelKey: "nav.m.dashboard", icon: LayoutDashboard, path: "/m" },
  { id: "kitchen", labelKey: "nav.m.kitchen", icon: ChefHat, path: "/m/kitchen" },
  { id: "menu", labelKey: "nav.m.menu", icon: UtensilsCrossed, path: "/m/menu" },
  { id: "sales", labelKey: "nav.m.sales", icon: BarChart3, path: "/m/sales" },
  { id: "profile", labelKey: "nav.m.profile", icon: User, path: "/m/profile" },
];

const MerchantBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const activeId = merchantNav.find((item) => {
    if (item.path === "/m") return location.pathname === "/m";
    return location.pathname.startsWith(item.path);
  })?.id ?? "dashboard";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="glass-effect glass-border border-t-0 px-4 pt-2 pb-8">
        <div className="flex items-center justify-around">
          {merchantNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => navigate(item.path)}
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-1 py-1 min-w-[48px]"
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.5}
                  className={`transition-colors duration-200 ${
                    isActive ? "text-score-emerald" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    isActive ? "text-score-emerald" : "text-muted-foreground"
                  }`}
                >
                  {t(item.labelKey)}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default MerchantBottomNav;
