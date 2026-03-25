import { motion } from "framer-motion";
import { Home, Compass, PlusCircle, ClipboardList, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";

const navItems = [
  { id: "home", labelKey: "nav.home", icon: Home, path: "/" },
  { id: "discover", labelKey: "nav.discover", icon: Compass, path: "/discover" },
  { id: "post", labelKey: "nav.post", icon: PlusCircle, path: "/post", isCenter: true },
  { id: "orders", labelKey: "nav.orders", icon: ClipboardList, path: "/orders" },
  { id: "profile", labelKey: "nav.profile", icon: User, path: "/profile" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const activeId = navItems.find((item) => location.pathname === item.path)?.id ?? "discover";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="glass-effect glass-border border-t-0 px-6 pt-2 pb-8">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => navigate(item.path)}
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center gap-1 py-1 min-w-[56px] ${
                  item.isCenter ? "-mt-3" : ""
                }`}
              >
                {item.isCenter ? (
                  <div className="w-12 h-12 rounded-full bg-score-emerald flex items-center justify-center shadow-[0_2px_16px_hsl(163_78%_20%/0.4)]">
                    <Icon size={24} strokeWidth={2} className="text-white" />
                  </div>
                ) : (
                  <>
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2 : 1.5}
                      className={`transition-colors duration-200 ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium transition-colors duration-200 ${
                        isActive ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {t(item.labelKey)}
                    </span>
                  </>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
