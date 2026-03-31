import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Store, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { categories } from "@/lib/categories";
import { getPopularityTier, getPopularityTierInfo } from "@/lib/popularity-tier";
import { useTagTranslations } from "@/hooks/use-tag-translations";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import KaraokeName from "@/components/KaraokeName";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";

interface StoreItem {
  id: string;
  name: string;
  category_id: string | null;
  created_at: string;
  menuCount: number;
  totalReviews: number;
}

const StoreList = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  const storeNames = useMemo(() => stores.map((s) => s.name), [stores]);
  const { translateTag } = useTagTranslations(storeNames);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchStores();
  }, [user, authLoading]);

  const fetchStores = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: storesData, error } = await supabase
        .from("stores")
        .select("id, name, category_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!storesData || storesData.length === 0) {
        setStores([]);
        setLoading(false);
        return;
      }

      const storeIds = storesData.map((s) => s.id);
      const [menuRes, reviewRes] = await Promise.all([
        supabase.from("menu_items").select("id, store_id").in("store_id", storeIds),
        supabase.from("reviews").select("store_id").in("store_id", storeIds),
      ]);

      const menuCountMap = new Map<string, number>();
      const menuToStore = new Map<string, string>();
      (menuRes.data || []).forEach((mi) => {
        menuCountMap.set(mi.store_id, (menuCountMap.get(mi.store_id) || 0) + 1);
        menuToStore.set(mi.id, mi.store_id);
      });

      const reviewCountMap = new Map<string, number>();
      (reviewRes.data || []).forEach((r) => {
        reviewCountMap.set(r.store_id, (reviewCountMap.get(r.store_id) || 0) + 1);
      });

      // Also count menu reviews and DNA
      const menuIds = (menuRes.data || []).map((m) => m.id);
      if (menuIds.length > 0) {
        const [menuRevRes, dnaRes] = await Promise.all([
          supabase.from("menu_reviews").select("menu_item_id").in("menu_item_id", menuIds),
          supabase.from("dish_dna").select("menu_item_id").in("menu_item_id", menuIds),
        ]);
        (menuRevRes.data || []).forEach((r) => {
          const sid = menuToStore.get(r.menu_item_id);
          if (sid) reviewCountMap.set(sid, (reviewCountMap.get(sid) || 0) + 1);
        });
        (dnaRes.data || []).forEach((d) => {
          const sid = menuToStore.get(d.menu_item_id);
          if (sid) reviewCountMap.set(sid, (reviewCountMap.get(sid) || 0) + 1);
        });
      }

      setStores(
        storesData.map((s) => ({
          ...s,
          menuCount: menuCountMap.get(s.id) || 0,
          totalReviews: reviewCountMap.get(s.id) || 0,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (categoryId: string | null) => {
    return categories.find((c) => c.id === categoryId)?.icon ?? "🏪";
  };

  const getCategoryLabel = (categoryId: string | null) => {
    return categories.find((c) => c.id === categoryId)?.label ?? "ร้านค้า";
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground">ร้านของฉัน</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                Order from my stores
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/register")}
              className="w-9 h-9 rounded-xl bg-score-emerald flex items-center justify-center shadow-luxury"
            >
              <Plus size={18} strokeWidth={2} className="text-primary-foreground" />
            </motion.button>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
              <span className="text-xs text-muted-foreground">กำลังโหลด...</span>
            </div>
          ) : stores.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                <Store size={28} strokeWidth={1.5} className="text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">ยังไม่มีร้านอาหาร</p>
                <p className="text-xs text-muted-foreground mt-1">เพิ่มร้านแรกของคุณเลย!</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/register")}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-medium shadow-luxury"
              >
                <Plus size={16} />
                เพิ่มร้านอาหาร
              </motion.button>
            </motion.div>
          ) : (
            <AnimatePresence>
              {stores.map((store, i) => {
                const popInfo = getPopularityTierInfo(getPopularityTier(store.totalReviews));
                return (
                  <motion.button
                    key={store.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    onClick={() => navigate(`/store/${store.id}/order`)}
                    className={`w-full rounded-2xl bg-surface-elevated border border-border/50 overflow-hidden text-left relative ${popInfo.borderClass} ${popInfo.glowClass || 'shadow-luxury'}`}
                  >
                    <div className="px-4 py-4 flex items-center gap-3">
                      <span className="text-3xl flex-shrink-0">{getCategoryIcon(store.category_id)}</span>
                      <div className="flex-1 min-w-0">
                        <KaraokeName
                          original={store.name}
                          translated={translateTag(store.name) !== store.name ? translateTag(store.name) : undefined}
                          className="text-sm font-bold text-foreground leading-tight"
                          subClassName="text-[9px] text-muted-foreground leading-tight"
                        />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                          {getCategoryLabel(store.category_id)}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {store.menuCount} เมนู · {store.totalReviews} รีวิว
                        </p>
                      </div>
                      <ChevronRight size={18} strokeWidth={1.5} className="text-muted-foreground flex-shrink-0" />
                    </div>
                    {popInfo.label && (
                      <span className="absolute bottom-2 right-3 text-[8px] font-extralight text-muted-foreground tracking-wide">
                        {popInfo.label}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default StoreList;
