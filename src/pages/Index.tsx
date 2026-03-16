import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { categories, getScoreTier, type ScoreTier } from "@/lib/categories";
import { getIntensityOpacity } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import TastureHeader from "@/components/TastureHeader";
import KingSwitcher from "@/components/KingSwitcher";
import SensorySearch from "@/components/SensorySearch";
import HeroFoodCard from "@/components/HeroFoodCard";
import BottomNav from "@/components/BottomNav";

/* ─── Types ─── */
interface MetricAvg {
  id: string;
  label: string;
  icon: string;
  score: number;
  count: number;
}

interface StoreCard {
  id: string;
  name: string;
  category_id: string | null;
  categoryLabel: string | null;
  avgScore: number | null;
  reviewCount: number;
  menuCount: number;
  metrics: MetricAvg[];
  dnaCount: number;
  menuReviewCount: number;
}

const tierColors: Record<ScoreTier, { bg: string; text: string }> = {
  emerald: { bg: "bg-score-emerald", text: "text-score-emerald" },
  mint: { bg: "bg-score-mint", text: "text-score-mint" },
  slate: { bg: "bg-score-slate", text: "text-score-slate" },
  amber: { bg: "bg-score-amber", text: "text-score-amber" },
  ruby: { bg: "bg-score-ruby", text: "text-score-ruby" },
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

/* ─── Mini Score Bar ─── */
const MiniScoreBar = ({ metric }: { metric: MetricAvg }) => {
  const tier = getScoreTier(metric.score);
  const opacity = getIntensityOpacity(metric.count);
  const colors = tierColors[tier];
  const pct = ((metric.score + 2) / 4) * 100;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px]">{metric.icon}</span>
          <span className="text-[9px] font-medium text-foreground truncate">{metric.label}</span>
        </div>
        <span className={cn("text-[9px] font-semibold tabular-nums", colors.text)}>
          {metric.score > 0 ? "+" : ""}{metric.score.toFixed(1)}
        </span>
      </div>
      <div className="h-1 rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className={cn("h-full rounded-full", colors.bg)}
          style={{ opacity }}
        />
      </div>
    </div>
  );
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

      // Fetch reviews (with metric_id), menu_items, dish_dna, menu_reviews in parallel
      const [reviewsRes, menuRes, dnaRes, menuRevRes] = await Promise.all([
        supabase.from("reviews").select("store_id, metric_id, score").in("store_id", storeIds),
        supabase.from("menu_items").select("id, store_id").in("store_id", storeIds),
        supabase.from("dish_dna").select("menu_item_id"),
        supabase.from("menu_reviews").select("menu_item_id"),
      ]);

      // Build menu→store map
      const menuToStore = new Map<string, string>();
      (menuRes.data || []).forEach((m) => menuToStore.set(m.id, m.store_id));

      const menuCountMap = new Map<string, number>();
      (menuRes.data || []).forEach((m) => {
        menuCountMap.set(m.store_id, (menuCountMap.get(m.store_id) || 0) + 1);
      });

      // Per-metric averages per store
      const metricMap = new Map<string, Map<string, { total: number; count: number }>>();
      (reviewsRes.data || []).forEach((r) => {
        if (!metricMap.has(r.store_id)) metricMap.set(r.store_id, new Map());
        const sm = metricMap.get(r.store_id)!;
        if (!sm.has(r.metric_id)) sm.set(r.metric_id, { total: 0, count: 0 });
        const m = sm.get(r.metric_id)!;
        m.total += r.score;
        m.count++;
      });

      // DNA count per store
      const dnaCountMap = new Map<string, number>();
      (dnaRes.data || []).forEach((d) => {
        const sid = menuToStore.get(d.menu_item_id);
        if (sid) dnaCountMap.set(sid, (dnaCountMap.get(sid) || 0) + 1);
      });

      // Menu review count per store
      const menuRevCountMap = new Map<string, number>();
      (menuRevRes.data || []).forEach((r) => {
        const sid = menuToStore.get(r.menu_item_id);
        if (sid) menuRevCountMap.set(sid, (menuRevCountMap.get(sid) || 0) + 1);
      });

      setStores(allStores.map((s) => {
        const sm = metricMap.get(s.id);
        const cat = categories.find((c) => c.id === s.category_id);

        // Build metric averages
        const metrics: MetricAvg[] = [];
        let totalScore = 0;
        let totalCount = 0;

        if (sm && cat) {
          // Flatten category metrics (including sub-metrics from smartGates)
          const allMetrics = cat.metrics.flatMap((m) =>
            m.smartGate ? m.smartGate.subMetrics : [m]
          );
          allMetrics.forEach((cm) => {
            const data = sm.get(cm.id);
            if (data) {
              const avg = data.total / data.count;
              metrics.push({ id: cm.id, label: cm.label, icon: cm.icon, score: Math.round(avg * 10) / 10, count: data.count });
              totalScore += data.total;
              totalCount += data.count;
            }
          });
        } else if (sm) {
          sm.forEach((data, metricId) => {
            const avg = data.total / data.count;
            metrics.push({ id: metricId, label: metricId, icon: "📊", score: Math.round(avg * 10) / 10, count: data.count });
            totalScore += data.total;
            totalCount += data.count;
          });
        }

        return {
          ...s,
          avgScore: totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : null,
          reviewCount: totalCount,
          menuCount: menuCountMap.get(s.id) || 0,
          metrics,
          dnaCount: dnaCountMap.get(s.id) || 0,
          menuReviewCount: menuRevCountMap.get(s.id) || 0,
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
            <div className="space-y-3">
              {stores.map((store, i) => {
                const overallTier = store.avgScore !== null ? getScoreTier(store.avgScore) : null;
                const topMetrics = [...(store.metrics || [])]
                  .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
                  .slice(0, 4);

                return (
                  <motion.button
                    key={store.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/store/${store.id}/order`)}
                    className="w-full rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 text-left overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="flex items-center gap-3 p-4 pb-2">
                      <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-xl shrink-0">
                        {categoryEmoji[store.category_id || ""] || "🍽️"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">{store.name}</h3>
                        {store.categoryLabel && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{store.categoryLabel}</p>
                        )}
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {store.menuCount} เมนู · {store.reviewCount} รีวิว
                          {store.dnaCount > 0 && <> · 🧬 {store.dnaCount}</>}
                          {store.menuReviewCount > 0 && <> · ⭐ {store.menuReviewCount}</>}
                        </p>
                      </div>
                      {overallTier && store.avgScore !== null && (
                        <div className={cn("px-2.5 py-1.5 rounded-xl", tierColors[overallTier].bg)}>
                          <span className="text-xs font-bold text-primary-foreground tabular-nums">
                            {store.avgScore > 0 ? "+" : ""}{store.avgScore.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Top Tags */}
                    {topMetrics.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-4 pb-3">
                        {topMetrics.map((m) => {
                          const t = getScoreTier(m.score);
                          const opacity = getIntensityOpacity(m.count);
                          return (
                            <span
                              key={m.id}
                              className={cn("inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[9px] font-semibold", tierColors[t].bg)}
                              style={{ opacity, color: "white" }}
                            >
                              {m.icon} {m.label}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* No reviews yet */}
                    {(store.metrics || []).length === 0 && (
                      <div className="px-4 pb-3">
                        <p className="text-[10px] text-muted-foreground italic">ยังไม่มีรีวิว — เป็นคนแรกที่ให้ฟีดแบค!</p>
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
