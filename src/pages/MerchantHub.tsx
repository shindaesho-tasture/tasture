import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Settings,
  ChefHat,
  Users,
  Camera,
  UtensilsCrossed,
  MessageSquarePlus,
  ShoppingBag,
  BarChart3,
  Store,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import { categories } from "@/lib/categories";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { Skeleton } from "@/components/ui/skeleton";

interface StoreInfo {
  id: string;
  name: string;
  category_id: string | null;
  verified: boolean;
}

const hubActions = (storeId: string, categoryId: string | null) => [
  {
    id: "kitchen",
    icon: ChefHat,
    labelTh: "ครัว / ออเดอร์",
    labelEn: "Kitchen Orders",
    descTh: "จัดการออเดอร์เรียลไทม์",
    descEn: "Real-time order management",
    path: `/kitchen/${storeId}`,
    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-500/20",
  },
  {
    id: "menu",
    icon: Settings,
    labelTh: "จัดการเมนู",
    labelEn: "Menu Manager",
    descTh: "เพิ่ม/แก้ไข/ลบเมนู",
    descEn: "Add, edit, remove items",
    path: `/menu-manager/${storeId}`,
    color: "bg-primary/10 text-primary",
    iconBg: "bg-primary/20",
  },
  {
    id: "queue",
    icon: Users,
    labelTh: "จัดการคิว",
    labelEn: "Queue Manager",
    descTh: "ระบบคิวลูกค้า",
    descEn: "Customer queue system",
    path: `/queue-manager/${storeId}`,
    color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-500/20",
  },
  {
    id: "images",
    icon: Camera,
    labelTh: "รูปเมนู",
    labelEn: "Menu Images",
    descTh: "จัดการรูปภาพเมนู",
    descEn: "Manage menu photos",
    path: `/menu-images/${storeId}`,
    color: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-500/20",
  },
  {
    id: "store-feedback",
    icon: MessageSquarePlus,
    labelTh: "ฟีดแบคร้าน",
    labelEn: "Store Feedback",
    descTh: "ดูรีวิวร้าน",
    descEn: "View store reviews",
    path: categoryId ? `/review/${categoryId}?store=${storeId}` : null,
    color: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-500/20",
  },
  {
    id: "menu-feedback",
    icon: UtensilsCrossed,
    labelTh: "ฟีดแบคเมนู",
    labelEn: "Menu Feedback",
    descTh: "ดูรีวิวเมนู",
    descEn: "View menu reviews",
    path: `/menu-feedback/${storeId}`,
    color: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-500/20",
  },
  {
    id: "order-page",
    icon: ShoppingBag,
    labelTh: "หน้าสั่งอาหาร",
    labelEn: "Order Page",
    descTh: "ดูหน้าร้านฝั่งลูกค้า",
    descEn: "Customer-facing store page",
    path: `/store/${storeId}/order`,
    color: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-500/20",
  },
];

const MerchantHub = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ orders: 0, menuItems: 0, reviews: 0 });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    if (!storeId) return;
    fetchStore();
  }, [user, authLoading, storeId]);

  const fetchStore = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [{ data: storeData }, { data: ordersData }, { data: menuData }, { data: reviewsData }] = await Promise.all([
        supabase.from("stores").select("id, name, category_id, verified").eq("id", storeId).single(),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("menu_items").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      ]);
      if (storeData) setStore(storeData);
      setStats({
        orders: (ordersData as any)?.length ?? 0,
        menuItems: (menuData as any)?.length ?? 0,
        reviews: (reviewsData as any)?.length ?? 0,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const cat = store ? categories.find((c) => c.id === store.category_id) : null;
  const actions = storeId ? hubActions(storeId, store?.category_id ?? null) : [];
  const isTh = language === "th";

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate("/my-stores")} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              {loading ? (
                <>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </>
              ) : (
                <>
                  <h1 className="text-lg font-bold tracking-tight text-foreground truncate">{store?.name}</h1>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 flex items-center gap-1">
                    <span>{cat?.icon ?? "🏪"}</span>
                    {cat?.label ?? "Store"} • {isTh ? "ศูนย์บริหาร" : "Management Hub"}
                  </p>
                </>
              )}
            </div>
            {store?.verified && (
              <span className="px-2 py-0.5 rounded-full bg-score-emerald/15 text-score-emerald text-[9px] font-bold uppercase tracking-wider">
                ✓ {isTh ? "ยืนยัน" : "Verified"}
              </span>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="px-4 pt-4">
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-3 gap-2"
            >
              {[
                { label: isTh ? "ออเดอร์" : "Orders", value: stats.orders, icon: ShoppingBag, color: "text-emerald-500" },
                { label: isTh ? "เมนู" : "Items", value: stats.menuItems, icon: UtensilsCrossed, color: "text-primary" },
                { label: isTh ? "รีวิว" : "Reviews", value: stats.reviews, icon: BarChart3, color: "text-amber-500" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl bg-surface-elevated border border-border/50 p-3 text-center">
                  <s.icon size={16} className={`mx-auto mb-1 ${s.color}`} />
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* Action Grid */}
        <div className="px-4 pt-5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            {isTh ? "เครื่องมือ" : "Tools"}
          </p>
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {actions.map((action, i) => (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35 }}
                  whileTap={{ scale: 0.96 }}
                  disabled={!action.path}
                  onClick={() => action.path && navigate(action.path)}
                  className={`rounded-2xl border border-border/50 p-4 text-left transition-all ${action.color} ${
                    !action.path ? "opacity-40 cursor-not-allowed" : "hover:shadow-luxury active:shadow-none"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-xl ${action.iconBg} flex items-center justify-center mb-2.5`}>
                    <action.icon size={18} strokeWidth={1.5} />
                  </div>
                  <p className="text-xs font-bold leading-tight">{isTh ? action.labelTh : action.labelEn}</p>
                  <p className="text-[9px] opacity-60 mt-0.5 leading-tight">{isTh ? action.descTh : action.descEn}</p>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default MerchantHub;
