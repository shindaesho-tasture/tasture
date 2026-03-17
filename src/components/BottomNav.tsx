import { motion } from "framer-motion";
import { Home, Compass, PlusCircle, ClipboardList, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { id: "home", label: "Home", icon: Home, path: "/" },
  { id: "discover", label: "Discover", icon: Compass, path: "/discover" },
  { id: "post", label: "โพส", icon: PlusCircle, path: "/post", isCenter: true },
  { id: "orders", label: "รายการ", icon: ClipboardList, path: "/orders" },
  { id: "profile", label: "Profile", icon: User, path: "/profile" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
                className="flex flex-col items-center gap-1 py-1 min-w-[60px]"
              >
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
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
