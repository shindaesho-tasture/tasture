import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Plus, ChevronLeft, MessageSquarePlus, Store, UtensilsCrossed, Camera, GitMerge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { categories, getScoreTier, type ScoreTier } from "@/lib/categories";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { getPopularityTier, getPopularityTierInfo } from "@/lib/popularity-tier";

interface StoreWithReviews {
  id: string;
  name: string;
  category_id: string | null;
  created_at: string;
  verified: boolean;
  reviewCount: number;
  menuReviewCount: number;
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
  const { toast } = useToast();
  const [stores, setStores] = useState<StoreWithReviews[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeDialogGroup, setMergeDialogGroup] = useState<StoreWithReviews[] | null>(null);
  const [merging, setMerging] = useState(false);

  // Detect groups of stores with the same name
  const duplicateGroups = useMemo(() => {
    const nameMap = new Map<string, StoreWithReviews[]>();
    stores.forEach((s) => {
      const key = s.name.trim().toLowerCase();
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key)!.push(s);
    });
    return Array.from(nameMap.values()).filter((g) => g.length > 1);
  }, [stores]);

  const mergeStores = async (group: StoreWithReviews[]) => {
    if (!user) return;
    setMerging(true);
    // Primary = oldest store (first created); duplicates = the rest
    const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const primary = sorted[0];
    const duplicates = sorted.slice(1);
    try {
      for (const dup of duplicates) {
        // 1. Get primary menu item names
        const { data: primaryItems } = await supabase.from("menu_items").select("id, name").eq("store_id", primary.id);
        const existingNames = new Set((primaryItems || []).map((m) => m.name.trim().toLowerCase()));

        // 2. Get duplicate menu items
        const { data: dupItems } = await supabase.from("menu_items").select("id, name").eq("store_id", dup.id);
        const toMove = (dupItems || []).filter((i) => !existingNames.has(i.name.trim().toLowerCase()));
        const toDelete = (dupItems || []).filter((i) => existingNames.has(i.name.trim().toLowerCase()));

        // 3. Move unique items to primary
        if (toMove.length > 0) {
          await supabase.from("menu_items").update({ store_id: primary.id }).in("id", toMove.map((i) => i.id));
        }
        // 4. Delete exact-name duplicates (CASCADE handles reviews/DNA)
        if (toDelete.length > 0) {
          await supabase.from("menu_items").delete().in("id", toDelete.map((i) => i.id));
        }

        // 5. Move reviews (skip conflicts from unique constraint)
        const { data: primaryRevs } = await supabase.from("reviews").select("user_id, metric_id").eq("store_id", primary.id);
        const primaryRevKeys = new Set((primaryRevs || []).map((r) => `${r.user_id}-${r.metric_id}`));
        const { data: dupRevs } = await supabase.from("reviews").select("id, user_id, metric_id").eq("store_id", dup.id);
        const revsToMove = (dupRevs || []).filter((r) => !primaryRevKeys.has(`${r.user_id}-${r.metric_id}`));
        const revsToDelete = (dupRevs || []).filter((r) => primaryRevKeys.has(`${r.user_id}-${r.metric_id}`));
        if (revsToMove.length > 0) await supabase.from("reviews").update({ store_id: primary.id }).in("id", revsToMove.map((r) => r.id));
        if (revsToDelete.length > 0) await supabase.from("reviews").delete().in("id", revsToDelete.map((r) => r.id));

        // 6. Move posts (store_id nullable, no unique constraint)
        await supabase.from("posts").update({ store_id: primary.id }).eq("store_id", dup.id);

        // 7. Delete duplicate store (CASCADE handles saved_stores, remaining data)
        await supabase.from("stores").delete().eq("id", dup.id);
      }

      toast({ title: "รวมร้านสำเร็จ! 🎉", description: `รวม "${primary.name}" ${duplicates.length} สาขาเป็นร้านเดียวแล้ว` });
      fetchStores();
    } catch (err: any) {
      console.error("Merge error:", err);
      toast({ title: "รวมไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
      setMergeDialogGroup(null);
    }
  };

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
        .select("id, name, category_id, created_at, verified")
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

      // Fetch menu items for stores to get menu review counts
      const { data: menuItemsData } = await supabase
        .from("menu_items")
        .select("id, store_id")
        .in("store_id", storeIds);

      const menuItemIds = (menuItemsData || []).map((mi) => mi.id);
      let menuReviewsData: { menu_item_id: string }[] = [];
      if (menuItemIds.length > 0) {
        const { data } = await supabase
          .from("menu_reviews")
          .select("menu_item_id")
          .in("menu_item_id", menuItemIds);
        menuReviewsData = data || [];
      }

      // Map menu items to stores for counting
      const menuItemStoreMap = new Map<string, string>();
      (menuItemsData || []).forEach((mi) => menuItemStoreMap.set(mi.id, mi.store_id));

      const menuReviewCountByStore = new Map<string, number>();
      menuReviewsData.forEach((mr) => {
        const sid = menuItemStoreMap.get(mr.menu_item_id);
        if (sid) menuReviewCountByStore.set(sid, (menuReviewCountByStore.get(sid) || 0) + 1);
      });

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
        const reviewCount = metricAverages.reduce((max, m) => Math.max(max, m.count), 0);
        const menuReviewCount = menuReviewCountByStore.get(s.id) || 0;
        return { ...s, metricAverages, reviewCount, menuReviewCount };
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

        {/* Duplicate Groups Banner */}
        {duplicateGroups.length > 0 && (
          <div className="px-4 pt-3 space-y-2">
            {duplicateGroups.map((group) => (
              <motion.div
                key={group.map((s) => s.id).join("-")}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GitMerge size={16} className="text-amber-500 shrink-0" />
                  <p className="text-[12px] font-medium text-foreground truncate">
                    พบ "{group[0].name}" {group.length} ร้าน
                  </p>
                </div>
                <button
                  onClick={() => setMergeDialogGroup(group)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-[11px] font-semibold"
                >
                  รวมร้าน
                </button>
              </motion.div>
            ))}
          </div>
        )}

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
                const popInfo = getPopularityTierInfo(getPopularityTier(store.reviewCount));

                return (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    className={`rounded-2xl bg-surface-elevated border border-border/50 overflow-hidden relative ${popInfo.borderClass} ${popInfo.glowClass || 'shadow-luxury'}`}
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

                    {/* Actions */}
                    <div className="px-4 pb-4 flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          if (store.category_id) {
                            navigate(`/review/${store.category_id}?store=${store.id}`);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary text-foreground text-[11px] font-medium uppercase tracking-wider hover:bg-muted transition-colors"
                      >
                        <MessageSquarePlus size={14} strokeWidth={1.5} />
                        ฟีดแบคร้าน
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(`/menu-feedback/${store.id}`)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-score-emerald/15 text-score-emerald text-[11px] font-medium uppercase tracking-wider hover:bg-score-emerald/25 transition-colors"
                      >
                        <UtensilsCrossed size={14} strokeWidth={1.5} />
                        ฟีดแบคเมนู
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(`/menu-images/${store.id}`)}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent/50 text-foreground text-[11px] font-medium uppercase tracking-wider hover:bg-accent transition-colors"
                      >
                        <Camera size={14} strokeWidth={1.5} />
                        📷
                      </motion.button>
                    </div>
                    {popInfo.label && (
                      <span className="absolute bottom-2 right-3 text-[8px] font-extralight text-muted-foreground tracking-wide">
                        {popInfo.label}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <BottomNav />
      </div>

      {/* Merge Confirmation Dialog */}
      <AlertDialog open={!!mergeDialogGroup} onOpenChange={(o) => { if (!o) setMergeDialogGroup(null); }}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>รวมร้านซ้ำ</AlertDialogTitle>
            <AlertDialogDescription>
              รวม {mergeDialogGroup?.length ?? 0} ร้านชื่อ "
              <span className="font-semibold text-foreground">{mergeDialogGroup?.[0]?.name}</span>
              " เป็นร้านเดียว เมนูและข้อมูลทั้งหมดจะถูกรวมเข้ากับร้านที่เก่าที่สุด
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => mergeDialogGroup && mergeStores(mergeDialogGroup)}
              disabled={merging}
              className="bg-score-emerald hover:bg-score-emerald/90 text-primary-foreground"
            >
              {merging ? "กำลังรวม..." : "รวมร้านเลย"}
            </AlertDialogAction>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
};

export default MyStores;
