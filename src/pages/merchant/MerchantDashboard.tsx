import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, UtensilsCrossed, BarChart3, ChefHat, Users, Settings, Camera, TrendingUp, Store, ChevronRight, Bell, BellRing, QrCode, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import { categories } from "@/lib/categories";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useMerchantNotifications } from "@/hooks/use-merchant-notifications";

const MerchantDashboard = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { stores, activeStore, setActiveStoreId, loading: storesLoading } = useMerchant();
  const isTh = language === "th";

  const [stats, setStats] = useState({ todayOrders: 0, totalOrders: 0, menuItems: 0, reviews: 0, todayRevenue: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [newOrderPulse, setNewOrderPulse] = useState(false);

  // Global merchant notifications — sound + push on all events
  const { pushSubscribed, pushSupported, requestPermissionAndSubscribe } = useMerchantNotifications({
    storeId: activeStore?.id || null,
    userId: user?.id || null,
    language,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/m/login"); return; }
  }, [user, authLoading]);

  const fetchStats = useCallback(async () => {
    if (!activeStore) return;
    setStatsLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [ordersRes, todayOrdersRes, menuRes, reviewsRes] = await Promise.all([
      supabase.from("orders").select("id, total_price").eq("store_id", activeStore.id),
      supabase.from("orders").select("id, total_price").eq("store_id", activeStore.id).gte("created_at", today),
      supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("store_id", activeStore.id),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("store_id", activeStore.id),
    ]);

    const allOrders = ordersRes.data || [];
    const todayOrders = todayOrdersRes.data || [];
    const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total_price || 0), 0);

    setStats({
      totalOrders: allOrders.length,
      todayOrders: todayOrders.length,
      menuItems: menuRes.count ?? 0,
      reviews: reviewsRes.count ?? 0,
      todayRevenue,
    });
    setStatsLoading(false);
  }, [activeStore]);

  useEffect(() => {
    if (!activeStore) return;
    fetchStats();
  }, [activeStore, fetchStats]);

  // Realtime: listen for new orders
  useEffect(() => {
    if (!activeStore) return;

    const channel = supabase
      .channel(`merchant-orders-${activeStore.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${activeStore.id}`,
        },
        (payload) => {
          const newOrder = payload.new as any;
          const price = Number(newOrder.total_price || 0);

          // Update stats in-place
          setStats((prev) => ({
            ...prev,
            todayOrders: prev.todayOrders + 1,
            totalOrders: prev.totalOrders + 1,
            todayRevenue: prev.todayRevenue + price,
          }));

          // Pulse animation
          setNewOrderPulse(true);
          setTimeout(() => setNewOrderPulse(false), 3000);

          // Toast notification
          toast(isTh ? "🔔 ออเดอร์ใหม่!" : "🔔 New order!", {
            description: isTh
              ? `ออเดอร์ #${newOrder.order_number} — ฿${price.toLocaleString()}`
              : `Order #${newOrder.order_number} — ฿${price.toLocaleString()}`,
            action: {
              label: isTh ? "ดูครัว" : "Kitchen",
              onClick: () => navigate("/m/kitchen"),
            },
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStore, isTh, navigate]);

  const cat = activeStore ? categories.find((c) => c.id === activeStore.category_id) : null;
  const loading = authLoading || storesLoading;

  const quickActions = [
    { icon: UtensilsCrossed, labelTh: "จัดการเมนู", labelEn: "Menu", path: "/m/menu", color: "bg-primary/10 text-primary", iconBg: "bg-primary/20" },
    { icon: Users, labelTh: "จัดการคิว", labelEn: "Queue", path: "/m/queue", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", iconBg: "bg-amber-500/20" },
    { icon: Camera, labelTh: "รูปเมนู", labelEn: "Images", path: `/menu-images/${activeStore?.id}`, color: "bg-violet-500/15 text-violet-600 dark:text-violet-400", iconBg: "bg-violet-500/20" },
    { icon: QrCode, labelTh: "QR โต๊ะ", labelEn: "Table QR", path: "/m/qr", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", iconBg: "bg-blue-500/20" },
    { icon: Gift, labelTh: "โปรโมชั่น", labelEn: "Promotions", path: "/m/promotions", color: "bg-pink-500/15 text-pink-600 dark:text-pink-400", iconBg: "bg-pink-500/20" },
  ];

  if (!user && !authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-score-emerald/15 flex items-center justify-center">
              <Store size={18} className="text-score-emerald" />
            </div>
            <div className="flex-1 min-w-0">
              {loading ? (
                <>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </>
              ) : (
                <>
                  <h1 className="text-base font-bold tracking-tight text-foreground truncate">
                    {activeStore?.name || (isTh ? "ยังไม่มีร้าน" : "No store")}
                  </h1>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    {cat?.icon} {cat?.label || "Merchant"} Dashboard
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {/* Push notification toggle */}
              {pushSupported && !pushSubscribed && (
                <button
                  onClick={requestPermissionAndSubscribe}
                  className="p-2 rounded-xl bg-secondary hover:bg-accent transition-colors"
                >
                  <BellRing size={16} className="text-muted-foreground" />
                </button>
              )}
              {pushSubscribed && (
                <span className="p-2 rounded-xl bg-score-emerald/10">
                  <Bell size={16} className="text-score-emerald" />
                </span>
              )}
              {/* Store switcher */}
              {stores.length > 1 && (
                <select
                  value={activeStore?.id || ""}
                  onChange={(e) => setActiveStoreId(e.target.value)}
                  className="text-[11px] bg-secondary border border-border/50 rounded-lg px-2 py-1.5 text-foreground outline-none"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Today Stats */}
        <div className="px-4 pt-4">
          {statsLoading || loading ? (
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-score-emerald/10 border border-score-emerald/20 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={14} className="text-score-emerald" />
                  <span className="text-[9px] text-score-emerald uppercase tracking-wider font-semibold">{isTh ? "รายได้วันนี้" : "Today Revenue"}</span>
                </div>
                <p className="text-xl font-bold text-foreground">฿{stats.todayRevenue.toLocaleString()}</p>
              </div>
              <div className={`rounded-xl border p-3 transition-all duration-500 ${newOrderPulse ? "bg-score-emerald/15 border-score-emerald/40 ring-2 ring-score-emerald/30" : "bg-surface-elevated border-border/50"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingBag size={14} className={newOrderPulse ? "text-score-emerald" : "text-primary"} />
                  <span className={`text-[9px] uppercase tracking-wider font-semibold ${newOrderPulse ? "text-score-emerald" : "text-muted-foreground"}`}>{isTh ? "ออเดอร์วันนี้" : "Today Orders"}</span>
                  {newOrderPulse && <span className="relative flex h-2 w-2 ml-auto"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-score-emerald opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-score-emerald"></span></span>}
                </div>
                <p className="text-xl font-bold text-foreground">{stats.todayOrders}</p>
              </div>
              <div className="rounded-xl bg-surface-elevated border border-border/50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <UtensilsCrossed size={14} className="text-amber-500" />
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{isTh ? "เมนูทั้งหมด" : "Menu Items"}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats.menuItems}</p>
              </div>
              <div className="rounded-xl bg-surface-elevated border border-border/50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 size={14} className="text-violet-500" />
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">{isTh ? "รีวิว" : "Reviews"}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats.reviews}</p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="px-4 pt-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            {isTh ? "เครื่องมือด่วน" : "Quick Actions"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.path}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate(action.path)}
                className={`rounded-2xl border border-border/50 p-4 text-left ${action.color} hover:shadow-luxury transition-all`}
              >
                <div className={`w-9 h-9 rounded-xl ${action.iconBg} flex items-center justify-center mb-2`}>
                  <action.icon size={18} strokeWidth={1.5} />
                </div>
                <p className="text-xs font-bold">{isTh ? action.labelTh : action.labelEn}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Total stats */}
        {!loading && (
          <div className="px-4 pt-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
              {isTh ? "สรุปรวม" : "Total Summary"}
            </p>
            <div className="rounded-xl bg-surface-elevated border border-border/50 p-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{isTh ? "ออเดอร์ทั้งหมด" : "All-time orders"}</span>
              <span className="text-sm font-bold text-foreground">{stats.totalOrders}</span>
            </div>
          </div>
        )}

        {/* No store state */}
        {!loading && stores.length === 0 && (
          <div className="px-4 pt-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
              <Store size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{isTh ? "ยังไม่มีร้าน" : "No store yet"}</p>
            <p className="text-xs text-muted-foreground mb-4">{isTh ? "สร้างร้านแรกของคุณเลย" : "Create your first store"}</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/register")}
              className="px-6 py-3 rounded-xl bg-score-emerald text-white text-sm font-semibold shadow-luxury">
              {isTh ? "+ สร้างร้าน" : "+ Create Store"}
            </motion.button>
          </div>
        )}

        <MerchantBottomNav />
      </div>
    </PageTransition>
  );
};

export default MerchantDashboard;
