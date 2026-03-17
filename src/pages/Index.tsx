import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation, haversineKm } from "@/hooks/use-geolocation";
import { useCategories } from "@/hooks/use-categories";
import { categories as defaultCategories, getScoreTier, type ScoreTier } from "@/lib/categories";
import { getPopularityTier, getPopularityTierInfo } from "@/lib/popularity-tier";
import { getIntensityOpacity } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import TastureHeader from "@/components/TastureHeader";
import DiscoveryTabs, { type DiscoveryTab } from "@/components/DiscoveryTabs";
import SensorySearch from "@/components/SensorySearch";
import HeroFoodCard from "@/components/HeroFoodCard";
import LocationPickerSheet from "@/components/LocationPickerSheet";
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
  verified: boolean;
  avgScore: number | null;
  reviewCount: number;
  menuCount: number;
  metrics: MetricAvg[];
  dnaCount: number;
  menuReviewCount: number;
  pin_lat: number | null;
  pin_lng: number | null;
  distanceKm: number | null;
  recentActivityCount: number;
  matchPercent: number | null;
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

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { categories: dynamicCategories } = useCategories();
  const [stores, setStores] = useState<StoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("nearby");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [customPos, setCustomPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Use custom pinned position if set, otherwise GPS
  const activePosition = customPos || position;

  useEffect(() => {
    fetchStores();
  }, [user, activePosition]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const { data: allStores } = await supabase
        .from("stores")
        .select("id, name, category_id, verified, pin_lat, pin_lng")
        .order("created_at", { ascending: false })
        .limit(30);

      if (!allStores || allStores.length === 0) { setStores([]); setLoading(false); return; }

      const storeIds = allStores.map((s) => s.id);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Parallel fetches
      const [reviewsRes, menuRes, dnaRes, menuRevRes, recentReviewsRes, recentDnaRes, userDnaRes] = await Promise.all([
        supabase.from("reviews").select("store_id, metric_id, score").in("store_id", storeIds),
        supabase.from("menu_items").select("id, store_id").in("store_id", storeIds),
        supabase.from("dish_dna").select("menu_item_id").in("menu_item_id",
          (await supabase.from("menu_items").select("id").in("store_id", storeIds)).data?.map(m => m.id) || []
        ),
        supabase.from("menu_reviews").select("menu_item_id").in("menu_item_id",
          (await supabase.from("menu_items").select("id").in("store_id", storeIds)).data?.map(m => m.id) || []
        ),
        // Recent activity for trending (last 7 days)
        supabase.from("menu_reviews").select("menu_item_id, created_at").gte("created_at", sevenDaysAgo),
        supabase.from("dish_dna").select("menu_item_id, created_at").gte("created_at", sevenDaysAgo),
        // User's DNA preferences for matching
        user ? supabase.from("dish_dna").select("component_name, selected_score").eq("user_id", user.id) : Promise.resolve({ data: [] }),
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

      // DNA & menu review counts per store
      const dnaCountMap = new Map<string, number>();
      (dnaRes.data || []).forEach((d) => {
        const sid = menuToStore.get(d.menu_item_id);
        if (sid) dnaCountMap.set(sid, (dnaCountMap.get(sid) || 0) + 1);
      });
      const menuRevCountMap = new Map<string, number>();
      (menuRevRes.data || []).forEach((r) => {
        const sid = menuToStore.get(r.menu_item_id);
        if (sid) menuRevCountMap.set(sid, (menuRevCountMap.get(sid) || 0) + 1);
      });

      // Recent activity per store (trending)
      const recentActivityMap = new Map<string, number>();
      (recentReviewsRes.data || []).forEach((r) => {
        const sid = menuToStore.get(r.menu_item_id);
        if (sid) recentActivityMap.set(sid, (recentActivityMap.get(sid) || 0) + 1);
      });
      (recentDnaRes.data || []).forEach((d) => {
        const sid = menuToStore.get(d.menu_item_id);
        if (sid) recentActivityMap.set(sid, (recentActivityMap.get(sid) || 0) + 1);
      });

      // User DNA preferences for matching
      const userPrefs = new Map<string, number>();
      (userDnaRes.data || []).forEach((d: any) => {
        if (d.selected_score !== 0) {
          userPrefs.set(d.component_name, (userPrefs.get(d.component_name) || 0) + d.selected_score);
        }
      });

      // Store DNA profiles for matching
      const storeDnaMap = new Map<string, Map<string, { total: number; count: number }>>();
      // We need full dna data with component_name and score for matching
      const { data: fullDnaData } = await supabase
        .from("dish_dna")
        .select("menu_item_id, component_name, selected_score");

      (fullDnaData || []).forEach((d) => {
        const sid = menuToStore.get(d.menu_item_id);
        if (!sid) return;
        if (!storeDnaMap.has(sid)) storeDnaMap.set(sid, new Map());
        const sm = storeDnaMap.get(sid)!;
        if (!sm.has(d.component_name)) sm.set(d.component_name, { total: 0, count: 0 });
        const entry = sm.get(d.component_name)!;
        entry.total += d.selected_score;
        entry.count++;
      });

      setStores(allStores.map((s) => {
        const sm = metricMap.get(s.id);
        const cat = dynamicCategories.find((c) => c.id === s.category_id) || defaultCategories.find((c) => c.id === s.category_id);

        const metrics: MetricAvg[] = [];
        let totalScore = 0;
        let totalCount = 0;

        if (sm && cat) {
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

        // Distance
        let distanceKm: number | null = null;
        if (activePosition && s.pin_lat != null && s.pin_lng != null) {
          distanceKm = Math.round(haversineKm(activePosition.lat, activePosition.lng, s.pin_lat, s.pin_lng) * 10) / 10;
        }

        // Match percent
        let matchPercent: number | null = null;
        if (userPrefs.size > 0) {
          const storeDna = storeDnaMap.get(s.id);
          if (storeDna && storeDna.size > 0) {
            let matchScore = 0;
            let maxScore = 0;
            userPrefs.forEach((prefScore, compName) => {
              const storeEntry = storeDna.get(compName);
              if (storeEntry && storeEntry.count > 0) {
                const storeAvg = storeEntry.total / storeEntry.count;
                // Both positive = match; both negative = match
                if ((prefScore > 0 && storeAvg > 0) || (prefScore < 0 && storeAvg < 0)) {
                  matchScore += Math.min(Math.abs(prefScore), Math.abs(storeAvg));
                }
                maxScore += Math.abs(prefScore);
              } else {
                maxScore += Math.abs(prefScore);
              }
            });
            matchPercent = maxScore > 0 ? Math.round((matchScore / maxScore) * 100) : null;
          }
        }

        return {
          ...s,
          categoryLabel: cat?.labelTh || null,
          verified: s.verified ?? false,
          avgScore: totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : null,
          reviewCount: totalCount,
          menuCount: menuCountMap.get(s.id) || 0,
          metrics,
          dnaCount: dnaCountMap.get(s.id) || 0,
          menuReviewCount: menuRevCountMap.get(s.id) || 0,
          distanceKm,
          recentActivityCount: recentActivityMap.get(s.id) || 0,
          matchPercent,
        };
      }));
    } catch (err) {
      console.error("Fetch stores error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sort/filter based on active tab
  const filteredStores = useMemo(() => {
    let sorted = [...stores];
    
    // Apply category filter
    if (selectedCategoryFilter) {
      sorted = sorted.filter((s) => s.category_id === selectedCategoryFilter);
    }
    
    switch (activeTab) {
      case "nearby":
        return sorted.sort((a, b) => {
          if (a.distanceKm == null && b.distanceKm == null) return 0;
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        });
      case "trending":
        return sorted
          .filter((s) => s.recentActivityCount > 0)
          .sort((a, b) => b.recentActivityCount - a.recentActivityCount)
          .concat(sorted.filter((s) => s.recentActivityCount === 0));
      case "match":
        return sorted.sort((a, b) => {
          if (a.matchPercent == null && b.matchPercent == null) return 0;
          if (a.matchPercent == null) return 1;
          if (b.matchPercent == null) return -1;
          return b.matchPercent - a.matchPercent;
        });
      default:
        return sorted;
    }
  }, [stores, activeTab, selectedCategoryFilter]);

  const tabTitle: Record<DiscoveryTab, string> = {
    nearby: "📍 ร้านใกล้คุณ",
    trending: "🔥 กำลังเป็นเทรนด์",
    match: "💎 แมตช์กับคุณ",
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

        {/* Discovery Trinity Tabs */}
        <DiscoveryTabs active={activeTab} onChange={setActiveTab} />

        {/* Location picker trigger */}
        <div className="px-6 pb-2">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowLocationPicker(true)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-medium transition-all",
              customPos
                ? "bg-score-emerald/10 text-score-emerald border border-score-emerald/20"
                : "bg-secondary text-muted-foreground"
            )}
          >
            <MapPin size={13} strokeWidth={2} />
            {customPos
              ? `📍 ตำแหน่งที่เลือก (${customPos.lat.toFixed(3)}, ${customPos.lng.toFixed(3)})`
              : activePosition
              ? "📍 ใช้ GPS ปัจจุบัน — แตะเพื่อเปลี่ยน"
              : "📍 เลือกตำแหน่ง"}
          </motion.button>
        </div>

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
            <h2 className="text-lg font-semibold text-foreground tracking-tight">
              {tabTitle[activeTab]}
            </h2>
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
          ) : filteredStores.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <span className="text-3xl">🍽️</span>
              <p className="text-xs text-muted-foreground">
                {activeTab === "match" && !user
                  ? "เข้าสู่ระบบเพื่อดูร้านที่แมตช์กับคุณ"
                  : activeTab === "match"
                  ? "รีวิว Dish DNA เพิ่มเติมเพื่อให้ระบบแมตช์ได้แม่นยำขึ้น"
                  : "ยังไม่มีร้านอาหาร"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStores.map((store, i) => {
                const overallTier = store.avgScore !== null ? getScoreTier(store.avgScore) : null;
                const popInfo = getPopularityTierInfo(getPopularityTier(store.reviewCount));
                const topMetrics = [...(store.metrics || [])]
                  .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
                  .slice(0, 4);
                const isTrending = activeTab === "trending" && store.recentActivityCount > 0;

                return (
                  <motion.button
                    key={store.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/store/${store.id}/order`)}
                    className={`w-full rounded-2xl bg-surface-elevated border border-border/50 text-left overflow-hidden relative ${popInfo.borderClass} ${popInfo.glowClass || 'shadow-luxury'}`}
                  >
                    {/* Trending badge */}
                    {isTrending && (
                      <div className="absolute top-2 right-2 z-10">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-score-amber/15 text-score-amber text-[9px] font-bold tracking-wide">
                          🔥 Trending
                        </span>
                      </div>
                    )}

                    {/* Match badge */}
                    {activeTab === "match" && store.matchPercent != null && (
                      <div className="absolute top-2 right-2 z-10">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-score-emerald/15 text-score-emerald text-[9px] font-bold tracking-wide">
                          💎 {store.matchPercent}% Match
                        </span>
                      </div>
                    )}

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
                          {activeTab === "nearby" && store.distanceKm != null && (
                            <> · 📍 {store.distanceKm} km</>
                          )}
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
                          const bgOpacity = getIntensityOpacity(m.count);
                          return (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-semibold relative overflow-hidden"
                            >
                              <span
                                className={cn("absolute inset-0 rounded-lg", tierColors[t].bg)}
                                style={{ opacity: bgOpacity }}
                              />
                              <span className={cn("relative z-10", tierColors[t].text)}>
                                {m.icon} {m.label}
                              </span>
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
                    {popInfo.label && (
                      <span className="absolute bottom-2 right-3 text-[8px] font-extralight text-muted-foreground tracking-wide">
                        {popInfo.label}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      <BottomNav />

      <LocationPickerSheet
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(pos) => setCustomPos(pos)}
        currentPosition={customPos}
        gpsPosition={position}
      />
    </div>
    </PageTransition>
  );
};

export default Index;
