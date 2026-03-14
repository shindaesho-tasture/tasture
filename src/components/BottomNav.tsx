import { useState } from "react";
import { motion } from "framer-motion";
import { Compass, Globe, Split, User } from "lucide-react";

const navItems = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "world", label: "World Map", icon: Globe },
  { id: "split", label: "Smart Split", icon: Split },
  { id: "profile", label: "Profile", icon: User },
];

const BottomNav = () => {
  const [active, setActive] = useState("discover");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="glass-effect glass-border border-t-0 px-6 pt-2 pb-8">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => setActive(item.id)}
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
