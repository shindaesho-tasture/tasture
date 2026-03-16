import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getScoreTier, type ScoreTier } from "@/lib/categories";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import TastureHeader from "@/components/TastureHeader";
import KingSwitcher from "@/components/KingSwitcher";
import SensorySearch from "@/components/SensorySearch";
import HeroFoodCard from "@/components/HeroFoodCard";
import BottomNav from "@/components/BottomNav";

interface StoreCard {
  id: string;
  name: string;
  category_id: string | null;
  avgScore: number | null;
  reviewCount: number;
  menuCount: number;
}

const tierBg: Record<ScoreTier, string> = {
  emerald: "bg-score-emerald",
  mint: "bg-score-mint",
  slate: "bg-score-slate",
  amber: "bg-score-amber",
  ruby: "bg-score-ruby",
};

const categoryEmoji: Record<string, string> = {
  everyday: "🍜",
  "street-food": "🔥",
  cafe: "☕",
  bistro: "🍽️",
  "fine-dining": "👑",
  omakase: "🍣",
  bar: "🍸",
};

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStores();
  }, [user]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const { data: allStores } = await supabase
        .from("stores")
        .select("id, name, category_id")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!allStores || allStores.length === 0) { setStores([]); setLoading(false); return; }

      const storeIds = allStores.map((s) => s.id);

      const [reviewsRes, menuRes] = await Promise.all([
        supabase.from("reviews").select("store_id, score").in("store_id", storeIds),
        supabase.from("menu_items").select("id, store_id").in("store_id", storeIds),
      ]);

      const avgMap = new Map<string, { total: number; count: number }>();
      (reviewsRes.data || []).forEach((r) => {
        if (!avgMap.has(r.store_id)) avgMap.set(r.store_id, { total: 0, count: 0 });
        const m = avgMap.get(r.store_id)!;
        m.total += r.score;
        m.count++;
      });

      const menuMap = new Map<string, number>();
      (menuRes.data || []).forEach((m) => {
        menuMap.set(m.store_id, (menuMap.get(m.store_id) || 0) + 1);
      });

      setStores(allStores.map((s) => {
        const avg = avgMap.get(s.id);
        return {
          ...s,
          avgScore: avg ? Math.round((avg.total / avg.count) * 10) / 10 : null,
          reviewCount: avg?.count || 0,
          menuCount: menuMap.get(s.id) || 0,
        };
      }));
    } catch (err) {
      console.error("Fetch stores error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-background pb-24">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <TastureHeader />

        {/* Large Title */}
        <div className="px-6 pt-2 pb-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            สำรวจ
          </h1>
          <p className="text-sm font-light text-muted-foreground mt-1">
            สัมผัสรสชาติผ่านประสาทสัมผัสของคุณ
          </p>
        </div>

        <KingSwitcher />
        <SensorySearch />
        <HeroFoodCard />

        {/* Quick Actions */}
        <div className="px-6 pt-4 grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/register")}
            className="flex items-center gap-2 p-4 rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 text-left"
          >
            <span className="text-xl">📝</span>
            <div>
              <span className="text-xs font-medium text-foreground block">เพิ่มร้านใหม่</span>
              <span className="text-[10px] font-light text-muted-foreground">ลงทะเบียนร้าน</span>
            </div>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate("/my-stores")}
            className="flex items-center gap-2 p-4 rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 text-left"
          >
            <span className="text-xl">🏪</span>
            <div>
              <span className="text-xs font-medium text-foreground block">ร้านของฉัน</span>
              <span className="text-[10px] font-light text-muted-foreground">ดูร้าน & ฟีดแบค</span>
            </div>
          </motion.button>
        </div>

        {/* ─── Store List ─── */}
        <div className="px-6 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground tracking-tight">ร้านอาหาร</h2>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/store-list")}
              className="text-[11px] font-medium text-score-emerald"
            >
              ดูทั้งหมด →
            </motion.button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
            </div>
          ) : stores.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <span className="text-3xl">🍽️</span>
              <p className="text-xs text-muted-foreground">ยังไม่มีร้านอาหาร</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stores.map((store, i) => {
                const tier = store.avgScore !== null ? getScoreTier(store.avgScore) : null;
                return (
                  <motion.button
                    key={store.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.35 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/store/${store.id}/order`)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 text-left"
                  >
                    <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-xl shrink-0">
                      {categoryEmoji[store.category_id || ""] || "🍽️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{store.name}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {store.menuCount} เมนู · {store.reviewCount} รีวิว
                      </p>
                    </div>
                    {tier && store.avgScore !== null && (
                      <div className={cn("px-2.5 py-1 rounded-xl", tierBg[tier])}>
                        <span className="text-[11px] font-bold text-primary-foreground tabular-nums">
                          {store.avgScore > 0 ? "+" : ""}{store.avgScore.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      <BottomNav />
    </div>
    </PageTransition>
  );
};

export default Index;
