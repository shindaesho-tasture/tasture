import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language-context";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { ClipboardList, ChevronRight, Store, LogIn, Star } from "lucide-react";
import { motion } from "framer-motion";

interface MenuItem {
  id: string;
  name: string;
  score: number | null;
  hasReview: boolean;
  note?: string;
}

interface VisitRecord {
  storeId: string;
  storeName: string;
  lastVisit: string;
  items: MenuItem[];
}

const scoreEmoji = (s: number | null) =>
  s === 2 ? "🤩" : s === 0 ? "😐" : s === -2 ? "😔" : "—";

const OrderHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      // 1. Get stores user reviewed (store-level reviews)
      const { data: storeReviews } = await supabase
        .from("reviews")
        .select("store_id, created_at")
        .eq("user_id", user.id);

      // 2. Get menu reviews by user (ordered + reviewed)
      const { data: menuReviews } = await supabase
        .from("menu_reviews")
        .select("score, created_at, menu_item_id")
        .eq("user_id", user.id);

      // 3. Get dish_dna by user (ordered + DNA feedback but maybe no score)
      const { data: dnaEntries } = await supabase
        .from("dish_dna")
        .select("menu_item_id, created_at")
        .eq("user_id", user.id);

      const menuReviewMap = new Map(
        (menuReviews || []).map((r) => [r.menu_item_id, r])
      );
      const dnaItemIds = new Set(
        (dnaEntries || []).map((d) => d.menu_item_id)
      );

      // Combine all ordered item IDs (from menu_reviews + dish_dna)
      const orderedItemIds = [
        ...new Set([...menuReviewMap.keys(), ...dnaItemIds]),
      ];

      if (orderedItemIds.length === 0 && (!storeReviews || storeReviews.length === 0)) {
        setLoading(false);
        return;
      }

      // 4. Get menu item info for ordered items only
      let allItems: { id: string; name: string; store_id: string }[] = [];
      if (orderedItemIds.length > 0) {
        const { data: items } = await supabase
          .from("menu_items")
          .select("id, name, store_id")
          .in("id", orderedItemIds);
        if (items) allItems = items;
      }

      const allStoreIds = [
        ...new Set([
          ...(storeReviews || []).map((r) => r.store_id),
          ...allItems.map((i) => i.store_id),
        ]),
      ];

      if (allStoreIds.length === 0) {
        setLoading(false);
        return;
      }

      // 5. Get store info
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", allStoreIds);

      if (!stores) {
        setLoading(false);
        return;
      }

      const storeMap = Object.fromEntries(stores.map((s) => [s.id, s.name]));

      // 6. Build visit records — only ordered items
      const grouped: Record<string, VisitRecord> = {};

      for (const sid of allStoreIds) {
        const storeRevDates = (storeReviews || [])
          .filter((r) => r.store_id === sid)
          .map((r) => r.created_at);

        const storeItems = allItems.filter((i) => i.store_id === sid);
        const itemDates = storeItems
          .map((i) => {
            const rev = menuReviewMap.get(i.id);
            const dna = (dnaEntries || []).find((d) => d.menu_item_id === i.id);
            return rev?.created_at || dna?.created_at;
          })
          .filter(Boolean) as string[];

        const allDates = [...storeRevDates, ...itemDates];
        const lastVisit =
          allDates.length > 0
            ? allDates.sort().reverse()[0]
            : new Date().toISOString();

        const items: MenuItem[] = storeItems.map((mi) => {
          const rev = menuReviewMap.get(mi.id);
          return {
            id: mi.id,
            name: mi.name,
            score: rev ? rev.score : null,
            hasReview: !!rev,
          };
        });

        grouped[sid] = {
          storeId: sid,
          storeName: storeMap[sid] || t("history.unknownStore"),
          lastVisit,
          items,
        };
      }

      const sorted = Object.values(grouped).sort(
        (a, b) =>
          new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      );
      setVisits(sorted);
      setLoading(false);
    };

    load();
  }, [user, authLoading]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
    const time = d.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} · ${time}`;
  };

  if (authLoading || loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-24">
          <header className="px-6 pt-6 pb-4">
             <h1 className="text-xl font-semibold text-foreground">{t("history.title")}</h1>
          </header>
          <div className="flex items-center justify-center h-[50vh]">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-24">
          <header className="px-6 pt-6 pb-4">
             <h1 className="text-xl font-semibold text-foreground">{t("history.title")}</h1>
          </header>
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-6">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <LogIn size={28} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
             <p className="text-sm text-muted-foreground text-center">
               {t("history.loginPrompt")}
             </p>
             <button
               onClick={() => navigate("/auth")}
               className="mt-2 px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-medium"
             >
               {t("common.login")}
             </button>
          </div>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        <header className="px-6 pt-6 pb-2">
           <h1 className="text-xl font-semibold text-foreground">{t("history.title")}</h1>
           <p className="text-xs text-muted-foreground mt-1">
             {t("history.subtitle")}
           </p>
        </header>

        {visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[55vh] gap-4 px-6">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <ClipboardList size={28} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t("history.empty")}
            </p>
          </div>
        ) : (
          <div className="px-4 pt-3 space-y-4">
            {visits.map((visit, i) => {
              const reviewedCount = visit.items.filter((x) => x.hasReview).length;
              return (
                <motion.div
                  key={visit.storeId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-2xl bg-card border border-border overflow-hidden"
                >
                  {/* Store header */}
                  <button
                    onClick={() => navigate(`/store/${visit.storeId}/order`)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                      <Store size={18} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {visit.storeName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(visit.lastVisit)} · {t("history.reviewed", { done: reviewedCount, total: visit.items.length })}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>

                  {/* Menu items always visible */}
                  <div className="border-t border-border/50">
                    {visit.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-b-0"
                      >
                        <span className="text-[11px] font-bold text-muted-foreground/50 w-5 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-[13px] text-foreground truncate flex-1">
                          {item.name}
                        </span>
                        {item.hasReview ? (
                          <span className="text-base shrink-0">
                            {scoreEmoji(item.score)}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/menu-feedback/${visit.storeId}`);
                            }}
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-[11px] font-medium"
                          >
                             <Star size={12} />
                             {t("history.rate")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default OrderHistory;
