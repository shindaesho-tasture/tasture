import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { ClipboardList, ChevronRight, Store, LogIn } from "lucide-react";
import { motion } from "framer-motion";

interface VisitRecord {
  storeId: string;
  storeName: string;
  lastVisit: string;
  itemCount: number;
  items: { id: string; name: string; score: number | null }[];
}

const scoreEmoji = (s: number | null) =>
  s === 2 ? "🤩" : s === 0 ? "😐" : s === -2 ? "😔" : "—";

const OrderHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      // Get all menu_reviews for this user, joined with menu_items + stores
      const { data: reviews } = await supabase
        .from("menu_reviews")
        .select("score, created_at, menu_item_id")
        .eq("user_id", user.id);

      if (!reviews || reviews.length === 0) {
        setLoading(false);
        return;
      }

      const itemIds = [...new Set(reviews.map((r) => r.menu_item_id))];
      const { data: items } = await supabase
        .from("menu_items")
        .select("id, name, store_id")
        .in("id", itemIds);

      if (!items) {
        setLoading(false);
        return;
      }

      const storeIds = [...new Set(items.map((i) => i.store_id))];
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", storeIds);

      if (!stores) {
        setLoading(false);
        return;
      }

      const storeMap = Object.fromEntries(stores.map((s) => [s.id, s.name]));
      const itemMap = Object.fromEntries(
        items.map((i) => [i.id, { name: i.name, storeId: i.store_id }])
      );

      // Group by store
      const grouped: Record<string, VisitRecord> = {};
      for (const rev of reviews) {
        const item = itemMap[rev.menu_item_id];
        if (!item) continue;
        const sid = item.storeId;
        if (!grouped[sid]) {
          grouped[sid] = {
            storeId: sid,
            storeName: storeMap[sid] || "ร้านไม่ทราบชื่อ",
            lastVisit: rev.created_at,
            itemCount: 0,
            items: [],
          };
        }
        if (rev.created_at > grouped[sid].lastVisit) {
          grouped[sid].lastVisit = rev.created_at;
        }
        // Avoid duplicate items
        if (!grouped[sid].items.find((x) => x.id === rev.menu_item_id)) {
          grouped[sid].items.push({
            id: rev.menu_item_id,
            name: item.name,
            score: rev.score,
          });
          grouped[sid].itemCount++;
        }
      }

      const sorted = Object.values(grouped).sort(
        (a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()
      );
      setVisits(sorted);
      setLoading(false);
    };

    fetch();
  }, [user, authLoading]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
  };

  if (authLoading || loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-24">
          <header className="px-6 pt-6 pb-4">
            <h1 className="text-xl font-semibold text-foreground">รายการ</h1>
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
            <h1 className="text-xl font-semibold text-foreground">รายการ</h1>
          </header>
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4 px-6">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <LogIn size={28} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              เข้าสู่ระบบเพื่อดูประวัติการไปร้านอาหาร
            </p>
            <button
              onClick={() => navigate("/auth")}
              className="mt-2 px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-medium"
            >
              เข้าสู่ระบบ
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
          <h1 className="text-xl font-semibold text-foreground">รายการ</h1>
          <p className="text-xs text-muted-foreground mt-1">
            ประวัติร้านอาหารและเมนูที่คุณเคยออเดอร์
          </p>
        </header>

        {visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[55vh] gap-4 px-6">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <ClipboardList size={28} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              ยังไม่มีประวัติการไปร้านอาหาร
            </p>
          </div>
        ) : (
          <div className="px-4 pt-3 space-y-3">
            {visits.map((visit, i) => {
              const isOpen = expanded === visit.storeId;
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
                    onClick={() => setExpanded(isOpen ? null : visit.storeId)}
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
                        {visit.itemCount} เมนู · {formatDate(visit.lastVisit)}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className={`text-muted-foreground transition-transform duration-200 ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                  </button>

                  {/* Expanded items */}
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border"
                    >
                      {visit.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0"
                        >
                          <span className="text-[13px] text-foreground truncate pr-3">
                            {item.name}
                          </span>
                          <span className="text-base shrink-0">
                            {scoreEmoji(item.score)}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
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
