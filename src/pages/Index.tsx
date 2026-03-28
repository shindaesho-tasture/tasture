import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGeolocation, haversineKm } from "@/hooks/use-geolocation";
import { useCategories } from "@/hooks/use-categories";
import { categories as defaultCategories, getScoreTier, type ScoreTier } from "@/lib/categories";
import { getPopularityTier, getPopularityTierInfo } from "@/lib/popularity-tier";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import TastureHeader from "@/components/TastureHeader";
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
  categoryIcon: string;
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
  imageUrl: string | null;
}

const tierColors: Record<ScoreTier, string> = {
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

// Spotify-style gradient colors for category sections
const sectionGradients = [
  "from-emerald-900/40 to-transparent",
  "from-amber-900/40 to-transparent",
  "from-rose-900/40 to-transparent",
  "from-indigo-900/40 to-transparent",
  "from-cyan-900/40 to-transparent",
  "from-purple-900/40 to-transparent",
  "from-orange-900/40 to-transparent",
];

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { position } = useGeolocation();
  const { categories: dynamicCategories } = useCategories();
  // stores derived via useMemo below
  const [loading, setLoading] = useState(true);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [customPos, setCustomPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activePosition = customPos || position;

  // Raw store data (fetched once, independent of position)
  const [rawStores, setRawStores] = useState<any[] | null>(null);
  const [rawData, setRawData] = useState<{
    menuToStore: Map<string, string>;
    menuCountMap: Map<string, number>;
    storeImageMap: Map<string, string>;
    metricMap: Map<string, Map<string, { total: number; count: number }>>;
    recentActivityMap: Map<string, number>;
    dnaCountMap: Map<string, number>;
    storeDnaMap: Map<string, Map<string, { total: number; count: number }>>;
    menuRevCountMap: Map<string, number>;
    userPrefs: Map<string, number>;
  } | null>(null);

  useEffect(() => {
    fetchStores();
  }, [user]);

  // ─── Data Fetching (single round of parallel queries) ───
  const fetchStores = async () => {
    setLoading(true);
    try {
      const { data: allStores } = await supabase
        .from("stores")
        .select("id, name, category_id, verified, pin_lat, pin_lng, menu_photo")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!allStores || allStores.length === 0) { setRawStores([]); setLoading(false); return; }

      const storeIds = allStores.map((s) => s.id);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // All queries in ONE parallel batch — no sequential rounds
      const [reviewsRes, menuRes, recentReviewsRes, recentDnaRes, userDnaRes, allDnaRes, allMenuRevRes] = await Promise.all([
        supabase.from("reviews").select("store_id, metric_id, score").in("store_id", storeIds),
        supabase.from("menu_items").select("id, store_id, image_url").in("store_id", storeIds),
        supabase.from("menu_reviews").select("menu_item_id, created_at").gte("created_at", sevenDaysAgo),
        supabase.from("dish_dna").select("menu_item_id, created_at").gte("created_at", sevenDaysAgo),
        user ? supabase.from("dish_dna").select("component_name, selected_score").eq("user_id", user.id) : Promise.resolve({ data: [] }),
        // Fetch ALL dna & menu_reviews filtered by store_id instead of menu_item_id (avoids 2nd round)
        supabase.from("dish_dna").select("menu_item_id, component_name, selected_score")
          .in("menu_item_id", (await supabase.from("menu_items").select("id").in("store_id", storeIds)).data?.map(m => m.id) || []),
        supabase.from("menu_reviews").select("menu_item_id")
          .in("menu_item_id", (await supabase.from("menu_items").select("id").in("store_id", storeIds)).data?.map(m => m.id) || []),
      ]);

      const menuToStore = new Map<string, string>();
      const menuCountMap = new Map<string, number>();
      const storeImageMap = new Map<string, string>();
      (menuRes.data || []).forEach((m: any) => {
        menuToStore.set(m.id, m.store_id);
        menuCountMap.set(m.store_id, (menuCountMap.get(m.store_id) || 0) + 1);
        if (m.image_url && !storeImageMap.has(m.store_id)) {
          storeImageMap.set(m.store_id, m.image_url);
        }
      });

      const metricMap = new Map<string, Map<string, { total: number; count: number }>>();
      (reviewsRes.data || []).forEach((r) => {
        if (!metricMap.has(r.store_id)) metricMap.set(r.store_id, new Map());
        const sm = metricMap.get(r.store_id)!;
        if (!sm.has(r.metric_id)) sm.set(r.metric_id, { total: 0, count: 0 });
        const m = sm.get(r.metric_id)!;
        m.total += r.score;
        m.count++;
      });

      const recentActivityMap = new Map<string, number>();
      (recentReviewsRes.data || []).forEach((r) => {
        const sid = menuToStore.get(r.menu_item_id);
        if (sid) recentActivityMap.set(sid, (recentActivityMap.get(sid) || 0) + 1);
      });
      (recentDnaRes.data || []).forEach((d) => {
        const sid = menuToStore.get(d.menu_item_id);
        if (sid) recentActivityMap.set(sid, (recentActivityMap.get(sid) || 0) + 1);
      });

      const userPrefs = new Map<string, number>();
      (userDnaRes.data || []).forEach((d: any) => {
        if (d.selected_score !== 0) userPrefs.set(d.component_name, (userPrefs.get(d.component_name) || 0) + d.selected_score);
      });

      const dnaCountMap = new Map<string, number>();
      const storeDnaMap = new Map<string, Map<string, { total: number; count: number }>>();
      (allDnaRes.data || []).forEach((d: any) => {
        const sid = menuToStore.get(d.menu_item_id);
        if (!sid) return;
        dnaCountMap.set(sid, (dnaCountMap.get(sid) || 0) + 1);
        if (!storeDnaMap.has(sid)) storeDnaMap.set(sid, new Map());
        const sm = storeDnaMap.get(sid)!;
        if (!sm.has(d.component_name)) sm.set(d.component_name, { total: 0, count: 0 });
        const entry = sm.get(d.component_name)!;
        entry.total += d.selected_score;
        entry.count++;
      });

      const menuRevCountMap = new Map<string, number>();
      (allMenuRevRes.data || []).forEach((r: any) => {
        const sid = menuToStore.get(r.menu_item_id);
        if (sid) menuRevCountMap.set(sid, (menuRevCountMap.get(sid) || 0) + 1);
      });

      setRawStores(allStores);
      setRawData({ menuToStore, menuCountMap, storeImageMap, metricMap, recentActivityMap, dnaCountMap, storeDnaMap, menuRevCountMap, userPrefs });
    } catch (err) {
      console.error("Fetch stores error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Derive store cards from raw data + position (no refetch on GPS change) ───
  const stores = useMemo(() => {
    if (!rawStores || !rawData) return [];
    const { menuCountMap, storeImageMap, metricMap, recentActivityMap, dnaCountMap, storeDnaMap, menuRevCountMap, userPrefs } = rawData;

    return rawStores.map((s) => {
      const sm = metricMap.get(s.id);
      const cat = dynamicCategories.find((c) => c.id === s.category_id) || defaultCategories.find((c) => c.id === s.category_id);

      const metrics: MetricAvg[] = [];
      let totalScore = 0;
      let totalCount = 0;

      if (sm && cat) {
        cat.metrics.flatMap((m) => m.smartGate ? m.smartGate.subMetrics : [m]).forEach((cm) => {
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

      let distanceKm: number | null = null;
      if (activePosition && s.pin_lat != null && s.pin_lng != null) {
        distanceKm = Math.round(haversineKm(activePosition.lat, activePosition.lng, s.pin_lat, s.pin_lng) * 10) / 10;
      }

      let matchPercent: number | null = null;
      if (userPrefs.size > 0) {
        const storeDna = storeDnaMap.get(s.id);
        if (storeDna && storeDna.size > 0) {
          let matchScore = 0, maxScore = 0;
          userPrefs.forEach((prefScore, compName) => {
            const storeEntry = storeDna.get(compName);
            if (storeEntry && storeEntry.count > 0) {
              const storeAvg = storeEntry.total / storeEntry.count;
              if ((prefScore > 0 && storeAvg > 0) || (prefScore < 0 && storeAvg < 0)) {
                matchScore += Math.min(Math.abs(prefScore), Math.abs(storeAvg));
              }
              maxScore += Math.abs(prefScore);
            } else { maxScore += Math.abs(prefScore); }
          });
          matchPercent = maxScore > 0 ? Math.round((matchScore / maxScore) * 100) : null;
        }
      }

      return {
        ...s,
        categoryLabel: cat?.labelTh || cat?.label || null,
        categoryIcon: cat?.icon || categoryEmoji[s.category_id || ""] || "🍽️",
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
        imageUrl: s.menu_photo || storeImageMap.get(s.id) || null,
      } as StoreCard;
    });
  }, [rawStores, rawData, activePosition, dynamicCategories]);

  // ─── Derived Data ───
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return stores;
    const q = searchQuery.toLowerCase();
    return stores.filter((s) => s.name.toLowerCase().includes(q) || (s.categoryLabel || "").toLowerCase().includes(q));
  }, [stores, searchQuery]);

  const categoryFiltered = useMemo(() => {
    if (!selectedCategoryFilter) return searchFiltered;
    return searchFiltered.filter((s) => s.category_id === selectedCategoryFilter);
  }, [searchFiltered, selectedCategoryFilter]);

  // Nearby stores (sorted by distance)
  const nearbyStores = useMemo(() =>
    [...categoryFiltered].sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    }).slice(0, 10)
  , [categoryFiltered]);

  // Trending stores
  const trendingStores = useMemo(() =>
    [...categoryFiltered].filter((s) => s.recentActivityCount > 0)
      .sort((a, b) => b.recentActivityCount - a.recentActivityCount)
      .slice(0, 10)
  , [categoryFiltered]);

  // Match stores
  const matchStores = useMemo(() =>
    [...categoryFiltered].filter((s) => s.matchPercent != null && s.matchPercent > 0)
      .sort((a, b) => (b.matchPercent || 0) - (a.matchPercent || 0))
      .slice(0, 10)
  , [categoryFiltered]);

  // Group by category for Spotify-style sections
  const categoryGroups = useMemo(() => {
    const groups = new Map<string, { label: string; icon: string; stores: StoreCard[] }>();
    categoryFiltered.forEach((s) => {
      const key = s.category_id || "other";
      if (!groups.has(key)) {
        groups.set(key, { label: s.categoryLabel || "อื่นๆ", icon: s.categoryIcon, stores: [] });
      }
      groups.get(key)!.stores.push(s);
    });
    return Array.from(groups.entries()).filter(([, g]) => g.stores.length > 0);
  }, [categoryFiltered]);

  // Greeting based on time
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "สวัสดีตอนเช้า";
    if (h < 17) return "สวัสดีตอนบ่าย";
    return "สวัสดีตอนเย็น";
  }, []);

  // ─── Store Card Component ───
  const SpotifyStoreCard = ({ store, size = "normal" }: { store: StoreCard; size?: "normal" | "large" }) => {
    const tier = store.avgScore !== null ? getScoreTier(store.avgScore) : null;
    const isLarge = size === "large";

    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate(`/store/${store.id}/order`)}
        className={cn(
          "shrink-0 rounded-xl overflow-hidden text-left relative group",
          isLarge ? "w-[180px]" : "w-[150px]"
        )}
      >
        {/* Card bg with image or gradient */}
        <div className={cn(
          "aspect-square rounded-xl flex items-center justify-center relative overflow-hidden",
          "bg-gradient-to-br from-muted to-secondary"
        )}>
          {store.imageUrl ? (
            <img
              src={store.imageUrl}
              alt={store.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <span className={cn("transition-transform duration-300 group-hover:scale-110", isLarge ? "text-5xl" : "text-4xl")}>
              {store.categoryIcon}
            </span>
          )}

          {/* Dark overlay for text readability when image present */}
          {store.imageUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
          )}

          {/* Score badge */}
          {tier && store.avgScore !== null && (
            <div className={cn("absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-primary-foreground", tierColors[tier])}>
              {store.avgScore > 0 ? "+" : ""}{store.avgScore.toFixed(1)}
            </div>
          )}

          {/* Match % or Trending fire */}
          {store.matchPercent != null && store.matchPercent > 0 ? (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-score-emerald/90 backdrop-blur-sm text-[9px] font-bold text-primary-foreground flex items-center gap-0.5">
              💚 {store.matchPercent}%
            </div>
          ) : store.recentActivityCount > 3 ? (
            <div className="absolute top-2 left-2 text-xs">🔥</div>
          ) : null}

          {/* Distance pill */}
          {store.distanceKm != null && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-full bg-background/70 backdrop-blur-sm text-[9px] font-medium text-foreground">
              {store.distanceKm} km
            </div>
          )}
        </div>

        {/* Title area */}
        <div className="pt-2 pb-1 px-0.5">
          <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{store.name}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {store.categoryLabel || "ร้านอาหาร"}
            {store.menuCount > 0 && ` · ${store.menuCount} เมนู`}
          </p>
          {/* Metric tags */}
          {store.metrics.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[...store.metrics]
                .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
                .slice(0, 3)
                .map((m) => {
                  const t = getScoreTier(m.score);
                  const tagColorMap: Record<ScoreTier, string> = {
                    emerald: "bg-score-emerald/15 text-score-emerald",
                    mint: "bg-score-mint/15 text-score-mint",
                    slate: "bg-score-slate/15 text-score-slate",
                    amber: "bg-score-amber/15 text-score-amber",
                    ruby: "bg-score-ruby/15 text-score-ruby",
                  };
                  return (
                    <span
                      key={m.id}
                      className={cn("px-1.5 py-0.5 rounded-md text-[8px] font-semibold leading-none", tagColorMap[t])}
                    >
                      {m.icon} {m.label}
                    </span>
                  );
                })}
            </div>
          )}
        </div>
      </motion.button>
    );
  };

  // ─── Horizontal Scroll Section ───
  const HorizontalSection = ({ title, emoji, stores: sectionStores, gradient, showAll }: {
    title: string;
    emoji: string;
    stores: StoreCard[];
    gradient?: string;
    showAll?: () => void;
  }) => {
    if (sectionStores.length === 0) return null;
    return (
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mt-6"
      >
        <div className="flex items-center justify-between px-5 mb-3">
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            {emoji} {title}
          </h2>
          {showAll && (
            <button onClick={showAll} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              ดูทั้งหมด
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide px-5 pb-1">
          {sectionStores.map((store) => (
            <SpotifyStoreCard key={store.id} store={store} size={sectionStores.length <= 3 ? "large" : "normal"} />
          ))}
        </div>
      </motion.section>
    );
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        <TastureHeader />

        {/* ─── Spotify Greeting + Gradient ─── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-score-emerald/8 via-transparent to-transparent pointer-events-none" />
          <div className="relative px-5 pt-3 pb-2">
            <h1 className="text-[26px] font-bold tracking-tight text-foreground leading-tight">
              {greeting} 👋
            </h1>
          </div>
        </div>

        {/* ─── Search Bar (Spotify-style) ─── */}
        <div className="px-5 pt-2 pb-1">
          <motion.div
            whileTap={{ scale: 0.99 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary"
          >
            <Search size={18} strokeWidth={2} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาร้านอาหารหรือหมวดหมู่..."
              className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground/60 outline-none"
              lang="th"
              autoComplete="off"
            />
          </motion.div>
        </div>

        {/* ─── Location Pill ─── */}
        <div className="px-5 pt-2 pb-1">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowLocationPicker(true)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all",
              customPos
                ? "bg-score-emerald/10 text-score-emerald"
                : "bg-secondary text-muted-foreground"
            )}
          >
            <MapPin size={12} strokeWidth={2} />
            {customPos
              ? `ตำแหน่งที่เลือก`
              : activePosition
              ? "ใช้ GPS ปัจจุบัน"
              : "เลือกตำแหน่ง"}
          </motion.button>
        </div>

        {/* ─── Filter Chips (Spotify pill style) ─── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-5 pt-3 pb-1">
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setSelectedCategoryFilter(null)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-[12px] font-semibold transition-all border",
              !selectedCategoryFilter
                ? "bg-foreground text-primary-foreground border-foreground"
                : "bg-transparent text-foreground border-border hover:bg-secondary"
            )}
          >
            ทั้งหมด
          </motion.button>
          {dynamicCategories.map((cat) => {
            const isActive = selectedCategoryFilter === cat.id;
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.93 }}
                onClick={() => setSelectedCategoryFilter(isActive ? null : cat.id)}
                className={cn(
                  "shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all border",
                  isActive
                    ? "bg-foreground text-primary-foreground border-foreground"
                    : "bg-transparent text-foreground border-border hover:bg-secondary"
                )}
              >
                {cat.icon} {cat.labelTh || cat.label}
              </motion.button>
            );
          })}
        </div>

        {/* ─── Quick Action Grid (Spotify shortcut style) ─── */}
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/register")}
            className="flex items-center gap-3 p-3 rounded-lg bg-secondary overflow-hidden"
          >
            <div className="w-10 h-10 rounded-md bg-score-emerald/20 flex items-center justify-center shrink-0">
              <Plus size={18} className="text-score-emerald" />
            </div>
            <span className="text-[12px] font-semibold text-foreground leading-tight">เพิ่มร้านใหม่</span>
          </motion.button>
        </div>

        {/* ─── Content Sections ─── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
          </div>
        ) : categoryFiltered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <span className="text-4xl">🍽️</span>
            <p className="text-sm text-muted-foreground">ยังไม่มีร้านอาหาร</p>
          </div>
        ) : (
          <>
            {/* Nearby Section */}
            <HorizontalSection
              title="ใกล้คุณ"
              emoji="📍"
              stores={nearbyStores}
              showAll={() => navigate("/store-list")}
            />

            {/* Trending Section */}
            {trendingStores.length > 0 && (
              <HorizontalSection
                title="กำลังเป็นเทรนด์"
                emoji="🔥"
                stores={trendingStores}
              />
            )}

            {/* Match Section */}
            {matchStores.length > 0 && (
              <HorizontalSection
                title="แมตช์กับคุณ"
                emoji="💎"
                stores={matchStores}
              />
            )}

            {/* Category Sections (Spotify genre-style) */}
            {categoryGroups.map(([catId, group], idx) => (
              <HorizontalSection
                key={catId}
                title={group.label}
                emoji={group.icon}
                stores={group.stores}
                gradient={sectionGradients[idx % sectionGradients.length]}
              />
            ))}

            {/* Bottom spacer */}
            <div className="h-6" />
          </>
        )}

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
