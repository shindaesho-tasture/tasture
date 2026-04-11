import { useState, useMemo, useCallback, useRef } from "react";
import LazyImage from "@/components/ui/lazy-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { useTagTranslations } from "@/hooks/use-tag-translations";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";
import TastureHeader from "@/components/TastureHeader";
import LocationPickerSheet from "@/components/LocationPickerSheet";
import KaraokeName from "@/components/KaraokeName";
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


const PULL_THRESHOLD = 80;

const Index = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { position } = useGeolocation();
  const { categories: dynamicCategories } = useCategories();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [customPos, setCustomPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activePosition = customPos || position;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 120));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      navigator.vibrate?.(8);
      await queryClient.invalidateQueries({ queryKey: ["discover-essential"] });
      await queryClient.invalidateQueries({ queryKey: ["discover-enrich"] });
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, isRefreshing, queryClient]);

  // ─── Phase 1: FAST essential query — single RPC (stores + menu summary) ───
  // Replaces: 2 queries fetching 100 stores + 2000 menu rows
  // Now:      1 RPC returning ~200 rows total (server-side aggregation)
  const { data: essentialData, isLoading: essentialLoading } = useQuery({
    queryKey: ["discover-essential"],
    queryFn: async () => {
      let allStores: any[] = [];
      let menuSummary: any[] = [];

      // Try RPC first, fallback to direct query if not available
      const { data, error } = await (supabase as any).rpc("get_stores_with_menu_summary");
      if (!error && data) {
        allStores = data?.stores || [];
        menuSummary = data?.menu_summary || [];
      } else {
        // Fallback: direct query
        const { data: storesData } = await supabase
          .from("stores")
          .select("id, name, category_id, verified, pin_lat, pin_lng, menu_photo")
          .order("created_at", { ascending: false })
          .limit(100);
        allStores = storesData || [];

        if (allStores.length > 0) {
          const storeIds = allStores.map((s: any) => s.id);
          const { data: menuData } = await supabase
            .from("menu_items")
            .select("store_id, image_url")
            .in("store_id", storeIds);
          const countMap = new Map<string, number>();
          const imgMap = new Map<string, string>();
          (menuData || []).forEach((m: any) => {
            countMap.set(m.store_id, (countMap.get(m.store_id) || 0) + 1);
            if (m.image_url && !imgMap.has(m.store_id)) imgMap.set(m.store_id, m.image_url);
          });
          menuSummary = Array.from(countMap.entries()).map(([store_id, menu_count]) => ({
            store_id, menu_count, first_image: imgMap.get(store_id) || null
          }));
        }
      }

      const menuCountMap = new Map<string, number>();
      const storeImageMap = new Map<string, string>();
      menuSummary.forEach((row: any) => {
        menuCountMap.set(row.store_id, Number(row.menu_count));
        if (row.first_image) storeImageMap.set(row.store_id, row.first_image);
      });

      return { allStores, menuCountMap, storeImageMap, storeIds: allStores.map((s: any) => s.id) };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ─── Phase 2: DEFERRED enrichment — single RPC (server-side aggregation) ───
  // Replaces: 6 parallel chunkedIn queries + client-side Map building
  // Now:      1 RPC with DB-side JOINs, returns pre-aggregated rows
  const { data: enrichData } = useQuery({
    queryKey: ["discover-enrich", user?.id ?? "anon"],
    queryFn: async () => {
      const { storeIds } = essentialData!;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await (supabase as any).rpc("get_store_enrichment", {
        p_store_ids: storeIds,
        p_since: sevenDaysAgo,
        p_user_id: user?.id ?? null,
      });
      if (error) throw error;

      const reviewScores: any[]     = data?.review_scores     || [];
      const recentActivity: any[]   = data?.recent_activity   || [];
      const dnaCounts: any[]        = data?.dna_counts        || [];
      const menuRevCounts: any[]    = data?.menu_rev_counts   || [];
      const storeDnaProfile: any[]  = data?.store_dna_profile || [];
      const userDnaList: any[]      = data?.user_dna          || [];

      // Review scores: RPC returns (store_id, metric_id, avg_score, cnt)
      const metricMap = new Map<string, Map<string, { total: number; count: number }>>();
      reviewScores.forEach((r: any) => {
        if (!metricMap.has(r.store_id)) metricMap.set(r.store_id, new Map());
        const cnt = Number(r.cnt);
        metricMap.get(r.store_id)!.set(r.metric_id, {
          total: Number(r.avg_score) * cnt,
          count: cnt,
        });
      });

      const recentActivityMap = new Map<string, number>();
      recentActivity.forEach((r: any) => {
        recentActivityMap.set(r.store_id, Number(r.activity_count));
      });

      const dnaCountMap = new Map<string, number>();
      dnaCounts.forEach((r: any) => {
        dnaCountMap.set(r.store_id, Number(r.dna_count));
      });

      const menuRevCountMap = new Map<string, number>();
      menuRevCounts.forEach((r: any) => {
        menuRevCountMap.set(r.store_id, Number(r.mr_count));
      });

      // Store DNA profile: (store_id, component_name, avg_score) — set count=1 so avg works in useMemo
      const storeDnaMap = new Map<string, Map<string, { total: number; count: number }>>();
      storeDnaProfile.forEach((r: any) => {
        if (!storeDnaMap.has(r.store_id)) storeDnaMap.set(r.store_id, new Map());
        storeDnaMap.get(r.store_id)!.set(r.component_name, {
          total: Number(r.avg_score),
          count: 1,
        });
      });

      const userPrefs = new Map<string, number>();
      userDnaList.forEach((r: any) => {
        userPrefs.set(r.component_name, Number(r.pref_score));
      });

      return { metricMap, recentActivityMap, dnaCountMap, storeDnaMap, menuRevCountMap, userPrefs, menuCountMap };
    },
    enabled: !!essentialData && essentialData.storeIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ─── Derive store cards ───
  const stores = useMemo(() => {
    if (!essentialData || essentialData.allStores.length === 0) return [];
    const { allStores } = essentialData;

    return allStores.map((s) => {
      const cat = dynamicCategories.find((c) => c.id === s.category_id) || defaultCategories.find((c) => c.id === s.category_id);

      const metrics: MetricAvg[] = [];
      let totalScore = 0;
      let totalCount = 0;
      let recentActivityCount = 0;
      let dnaCount = 0;
      let menuReviewCount = 0;
      let matchPercent: number | null = null;

      // Enrichment data (available after phase 2)
      if (enrichData) {
        const { metricMap, recentActivityMap, dnaCountMap, storeDnaMap, menuRevCountMap, userPrefs, menuCountMap } = enrichData;
        const sm = metricMap.get(s.id);

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

        recentActivityCount = recentActivityMap.get(s.id) || 0;
        dnaCount = dnaCountMap.get(s.id) || 0;
        menuReviewCount = menuRevCountMap.get(s.id) || 0;

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
      }

      let distanceKm: number | null = null;
      if (activePosition && s.pin_lat != null && s.pin_lng != null) {
        distanceKm = Math.round(haversineKm(activePosition.lat, activePosition.lng, s.pin_lat, s.pin_lng) * 10) / 10;
      }

      return {
        ...s,
        categoryLabel: cat?.labelTh || cat?.label || null,
        categoryIcon: cat?.icon || categoryEmoji[s.category_id || ""] || "🍽️",
        verified: s.verified ?? false,
        avgScore: totalCount > 0 ? Math.round((totalScore / totalCount) * 10) / 10 : null,
        reviewCount: totalCount,
        menuCount: enrichData?.menuCountMap?.get(s.id) || 0,
        metrics,
        dnaCount,
        menuReviewCount,
        distanceKm,
        recentActivityCount,
        matchPercent,
        imageUrl: s.menu_photo || null,
      } as StoreCard;
    });
  }, [essentialData, enrichData, activePosition, dynamicCategories]);

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

  const nearbyStores = useMemo(() =>
    [...categoryFiltered].sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    }).slice(0, 10)
  , [categoryFiltered]);

  const trendingStores = useMemo(() =>
    [...categoryFiltered].filter((s) => s.recentActivityCount > 0)
      .sort((a, b) => b.recentActivityCount - a.recentActivityCount)
      .slice(0, 10)
  , [categoryFiltered]);

  const matchStores = useMemo(() =>
    [...categoryFiltered].filter((s) => s.matchPercent != null && s.matchPercent > 0)
      .sort((a, b) => (b.matchPercent || 0) - (a.matchPercent || 0))
      .slice(0, 10)
  , [categoryFiltered]);

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

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "สวัสดีตอนเช้า";
    if (h < 17) return "สวัสดีตอนบ่าย";
    return "สวัสดีตอนเย็น";
  }, []);

  const allTranslatableLabels = useMemo(() => {
    const labels = new Set<string>();
    stores.forEach((s) => {
      s.metrics.forEach((m) => labels.add(m.label));
      if (s.categoryLabel) labels.add(s.categoryLabel);
      labels.add(s.name);
    });
    return Array.from(labels);
  }, [stores]);
  const { translateTag } = useTagTranslations(allTranslatableLabels);

  // ─── Store Card Component ───
  const SpotifyStoreCard = useCallback(({ store, size = "normal" }: { store: StoreCard; size?: "normal" | "large" }) => {
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
        <div className={cn(
          "aspect-square rounded-xl flex items-center justify-center relative overflow-hidden",
          "bg-gradient-to-br from-muted to-secondary"
        )}>
          {store.imageUrl ? (
            <LazyImage
              src={store.imageUrl}
              alt={store.name}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              transformWidth={400}
              quality={75}
            />
          ) : (
            <span className={cn("transition-transform duration-300 group-hover:scale-110", isLarge ? "text-5xl" : "text-4xl")}>
              {store.categoryIcon}
            </span>
          )}

          {store.imageUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
          )}

          {tier && store.avgScore !== null && (
            <div className={cn("absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-primary-foreground", tierColors[tier])}>
              {store.avgScore > 0 ? "+" : ""}{store.avgScore.toFixed(1)}
            </div>
          )}

          {store.matchPercent != null && store.matchPercent > 0 ? (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-score-emerald/90 backdrop-blur-sm text-[9px] font-bold text-primary-foreground flex items-center gap-0.5">
              💚 {store.matchPercent}%
            </div>
          ) : store.recentActivityCount > 3 ? (
            <div className="absolute top-2 left-2 text-xs">🔥</div>
          ) : null}

          {store.distanceKm != null && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-full bg-background/70 backdrop-blur-sm text-[9px] font-medium text-foreground">
              {store.distanceKm} km
            </div>
          )}
        </div>

        <div className="pt-2 pb-1 px-0.5">
          <KaraokeName
            original={store.name}
            translated={translateTag(store.name) !== store.name ? translateTag(store.name) : undefined}
            className="text-[13px] font-semibold text-foreground leading-tight"
            subClassName="text-[9px] text-muted-foreground leading-tight"
          />
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {translateTag(store.categoryLabel || "ร้านอาหาร")}
            {store.menuCount > 0 && ` · ${store.menuCount} เมนู`}
          </p>
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
                      {m.icon} {translateTag(m.label)}
                    </span>
                  );
                })}
            </div>
          )}
        </div>
      </motion.button>
    );
  }, [navigate, translateTag]);

  // ─── Horizontal Scroll Section ───
  const HorizontalSection = useCallback(({ title, emoji, stores: sectionStores, gradient, showAll }: {
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
  }, [SpotifyStoreCard]);

  return (
    <PageTransition>
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="min-h-screen bg-background pb-24 overflow-y-auto"
      >
        {/* Pull-to-refresh indicator */}
        <motion.div
          animate={{ height: pullDistance, opacity: pullDistance > 10 ? 1 : 0 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="flex items-center justify-center overflow-hidden"
        >
          <motion.div
            animate={{ rotate: isRefreshing ? 360 : pullDistance * 2 }}
            transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
            className="text-lg"
          >
            {isRefreshing ? "⏳" : pullDistance >= PULL_THRESHOLD ? "🔄" : "⬇️"}
          </motion.div>
          <span className="ml-2 text-[11px] text-muted-foreground font-medium">
            {isRefreshing ? "กำลังรีเฟรช..." : pullDistance >= PULL_THRESHOLD ? "ปล่อยเพื่อรีเฟรช" : "ดึงลงเพื่อรีเฟรช"}
          </span>
        </motion.div>

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
                {cat.icon} {translateTag(cat.labelTh || cat.label)}
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
        {essentialLoading ? (
          <div className="px-4 space-y-6 py-4">
            <div>
              <Skeleton className="h-5 w-32 mb-3" />
              <div className="flex gap-3 overflow-hidden">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-shrink-0 w-[200px] rounded-2xl overflow-hidden border border-border/50">
                    <Skeleton className="h-28 w-full" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-5 w-28 mb-3" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-elevated border border-border/50">
                    <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/5" />
                      <Skeleton className="h-3 w-2/5" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : categoryFiltered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3">
            <span className="text-4xl">🍽️</span>
            <p className="text-sm text-muted-foreground">{t("common.noStores", language)}</p>
          </div>
        ) : (
          <>
            {/* Nearby Section */}
            <HorizontalSection
              title={t("discover.nearYou", language)}
              emoji="📍"
              stores={nearbyStores}
              showAll={() => navigate("/store-list")}
            />

            {/* Trending Section */}
            {trendingStores.length > 0 && (
              <HorizontalSection
                title={t("discover.trending", language)}
                emoji="🔥"
                stores={trendingStores}
              />
            )}

            {/* Match Section */}
            {matchStores.length > 0 && (
              <HorizontalSection
                title={t("discover.matchYou", language)}
                emoji="💎"
                stores={matchStores}
              />
            )}

            {/* Category Sections (Spotify genre-style) */}
            {categoryGroups.map(([catId, group], idx) => (
              <HorizontalSection
                key={catId}
                title={translateTag(group.label)}
                emoji={group.icon}
                stores={group.stores}
                gradient={sectionGradients[idx % sectionGradients.length]}
              />
            ))}

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
