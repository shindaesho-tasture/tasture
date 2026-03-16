import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronLeft, MessageSquarePlus, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { categories, getScoreTier, type ScoreTier } from "@/lib/categories";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";

import { getTrustTier } from "@/lib/trust-tiers";
import TrustTierBadge from "@/components/TrustTierBadge";

interface StoreWithReviews {
  id: string;
  name: string;
  category_id: string | null;
  created_at: string;
  verified: boolean;
  reviewCount: number;
  metricAverages: { metric_id: string; avg_score: number; count: number }[];
}

const tierBgMap: Record<ScoreTier, string> = {
  emerald: "bg-score-emerald",
  mint: "bg-score-mint",
  slate: "bg-score-slate",
  amber: "bg-score-amber",
  ruby: "bg-score-ruby",
};

const MyStores = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [stores, setStores] = useState<StoreWithReviews[]>([]);
  const [loading, setLoading] = useState(true);

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
      // Fetch user's stores
      const { data: storesData, error: storesErr } = await supabase
        .from("stores")
        .select("id, name, category_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (storesErr) throw storesErr;

      if (!storesData || storesData.length === 0) {
        setStores([]);
        setLoading(false);
        return;
      }

      // Fetch reviews for all stores
      const storeIds = storesData.map((s) => s.id);
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("store_id, metric_id, score")
        .in("store_id", storeIds);

      // Compute averages per store per metric
      const avgMap = new Map<string, Map<string, { total: number; count: number }>>();
      (reviewsData || []).forEach((r) => {
        if (!avgMap.has(r.store_id)) avgMap.set(r.store_id, new Map());
        const storeMap = avgMap.get(r.store_id)!;
        if (!storeMap.has(r.metric_id)) storeMap.set(r.metric_id, { total: 0, count: 0 });
        const m = storeMap.get(r.metric_id)!;
        m.total += r.score;
        m.count += 1;
      });

      const result: StoreWithReviews[] = storesData.map((s) => {
        const storeMap = avgMap.get(s.id);
        const metricAverages: StoreWithReviews["metricAverages"] = [];
        if (storeMap) {
          storeMap.forEach((val, metricId) => {
            metricAverages.push({
              metric_id: metricId,
              avg_score: val.total / val.count,
              count: val.count,
            });
          });
        }
        // Sort by extremity
        metricAverages.sort((a, b) => Math.abs(b.avg_score) - Math.abs(a.avg_score));
        return { ...s, metricAverages };
      });

      setStores(result);
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryInfo = (categoryId: string | null) => {
    return categories.find((c) => c.id === categoryId);
  };

  const getMetricLabel = (categoryId: string | null, metricId: string) => {
    const cat = getCategoryInfo(categoryId);
    if (!cat) return metricId;
    // Search in metrics and sub-metrics
    for (const m of cat.metrics) {
      if (m.id === metricId) return m.icon + " " + m.label;
      if (m.smartGate) {
        for (const sub of m.smartGate.subMetrics) {
          if (sub.id === metricId) return sub.icon + " " + sub.label;
        }
      }
    }
    return metricId;
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
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">My Stores</p>
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
                const cat = getCategoryInfo(store.category_id);
                const topTags = store.metricAverages.slice(0, 4);

                return (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 overflow-hidden"
                  >
                    <div className="px-4 pt-4 pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl flex-shrink-0">{cat?.icon ?? "🏪"}</span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-foreground truncate">{store.name}</h3>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                              {cat?.label ?? "Uncategorized"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Score Tags */}
                      {topTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {topTags.map((tag) => {
                            const tier = getScoreTier(tag.avg_score);
                            return (
                              <span
                                key={tag.metric_id}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold leading-none text-white ${tierBgMap[tier]}`}
                              >
                                {getMetricLabel(store.category_id, tag.metric_id)}
                                <span className="opacity-70">
                                  {tag.avg_score > 0 ? "+" : ""}
                                  {tag.avg_score.toFixed(1)}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {topTags.length === 0 && (
                        <p className="text-[11px] text-muted-foreground mt-3">ยังไม่มีฟีดแบค</p>
                      )}
                    </div>

                    {/* Action: Add Feedback */}
                    <div className="px-4 pb-4">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          if (store.category_id) {
                            navigate(`/review/${store.category_id}?store=${store.id}`);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary text-foreground text-[11px] font-medium uppercase tracking-wider hover:bg-muted transition-colors"
                      >
                        <MessageSquarePlus size={14} strokeWidth={1.5} />
                        เพิ่มฟีดแบค
                      </motion.button>
                    </div>
                  </motion.div>
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

export default MyStores;
