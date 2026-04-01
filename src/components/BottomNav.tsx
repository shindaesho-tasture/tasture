import { motion } from "framer-motion";
import { Home, Compass, PlusCircle, ClipboardList, User, Store } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();

  // Check if user owns any stores (cached, lightweight)
  const { data: hasStores } = useQuery({
    queryKey: ["has-stores", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { count } = await supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      return (count ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const navItems = [
    { id: "home", labelKey: "nav.home", icon: Home, path: "/" },
    { id: "discover", labelKey: "nav.discover", icon: Compass, path: "/discover" },
    { id: "post", labelKey: "nav.post", icon: PlusCircle, path: "/post", isCenter: true },
    { id: "orders", labelKey: "nav.orders", icon: ClipboardList, path: "/orders" },
    ...(hasStores
      ? [{ id: "mystore", labelKey: "nav.myStore", icon: Store, path: "/my-stores" }]
      : []),
    { id: "profile", labelKey: "nav.profile", icon: User, path: "/profile" },
  ];

  const activeId = navItems.find((item) =>
    item.path === "/my-stores"
      ? location.pathname.startsWith("/my-stores") || location.pathname.startsWith("/merchant")
      : location.pathname === item.path
  )?.id ?? "home";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="glass-effect glass-border border-t-0 px-4 pt-2 pb-8">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => navigate(item.path)}
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center gap-1 py-1 min-w-[44px] ${
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
