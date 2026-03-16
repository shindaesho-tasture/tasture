import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import MenuFeedbackCard from "@/components/menu/MenuFeedbackCard";

interface MenuItemWithAvg {
  id: string;
  name: string;
  type: string;
  price: number;
  price_special: number | null;
  noodle_types: string[] | null;
  noodle_styles: string[] | null;
  toppings: string[] | null;
  avg_score: number | null;
  review_count: number;
  my_score: number | null;
}

const MenuFeedback = () => {
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<MenuItemWithAvg[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("");
  const [userScores, setUserScores] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!storeId) return;
    fetchData();
  }, [storeId, user, authLoading]);

  const fetchData = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      // Fetch store name
      const { data: store } = await supabase
        .from("stores")
        .select("name")
        .eq("id", storeId)
        .single();
      if (store) setStoreName(store.name);

      // Fetch menu items
      const { data: menuItems, error: menuErr } = await supabase
        .from("menu_items")
        .select("id, name, type, price, price_special, noodle_types, noodle_styles, toppings")
        .eq("store_id", storeId);
      if (menuErr) throw menuErr;

      // Fetch all menu reviews for these items
      const itemIds = (menuItems || []).map((i) => i.id);
      const { data: allReviews } = await supabase
        .from("menu_reviews")
        .select("menu_item_id, user_id, score")
        .in("menu_item_id", itemIds);

      // Compute averages and user's own scores
      const avgMap = new Map<string, { total: number; count: number }>();
      const myMap = new Map<string, number>();
      (allReviews || []).forEach((r) => {
        if (!avgMap.has(r.menu_item_id)) avgMap.set(r.menu_item_id, { total: 0, count: 0 });
        const m = avgMap.get(r.menu_item_id)!;
        m.total += r.score;
        m.count += 1;
        if (user && r.user_id === user.id) {
          myMap.set(r.menu_item_id, r.score);
        }
      });

      const result: MenuItemWithAvg[] = (menuItems || []).map((item) => {
        const avg = avgMap.get(item.id);
        return {
          ...item,
          avg_score: avg ? avg.total / avg.count : null,
          review_count: avg ? avg.count : 0,
          my_score: myMap.get(item.id) ?? null,
        };
      });

      setItems(result);

      // Init user scores
      const scores: Record<string, number | null> = {};
      result.forEach((item) => {
        scores[item.id] = item.my_score;
      });
      setUserScores(scores);
    } catch (err) {
      console.error("MenuFeedback fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRate = (itemId: string, value: number) => {
    setUserScores((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === value ? null : value,
    }));
  };

  const changedCount = useMemo(() => {
    return items.filter((item) => userScores[item.id] !== item.my_score).length;
  }, [userScores, items]);

  const ratedCount = useMemo(() => {
    return Object.values(userScores).filter((v) => v !== null && v !== undefined).length;
  }, [userScores]);

  const handleSubmit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setSaving(true);
    try {
      const upsertRows: { menu_item_id: string; user_id: string; score: number }[] = [];
      const deleteIds: string[] = [];

      items.forEach((item) => {
        const newScore = userScores[item.id];
        const oldScore = item.my_score;
        if (newScore !== oldScore) {
          if (newScore !== null && newScore !== undefined) {
            upsertRows.push({ menu_item_id: item.id, user_id: user.id, score: newScore });
          } else if (oldScore !== null) {
            deleteIds.push(item.id);
          }
        }
      });

      if (upsertRows.length > 0) {
        const { error } = await supabase
          .from("menu_reviews")
          .upsert(upsertRows, { onConflict: "menu_item_id,user_id" });
        if (error) throw error;
      }

      if (deleteIds.length > 0) {
        const { error } = await supabase
          .from("menu_reviews")
          .delete()
          .in("menu_item_id", deleteIds)
          .eq("user_id", user.id);
        if (error) throw error;
      }

      toast({ title: "✅ บันทึกสำเร็จ", description: `ให้คะแนน ${ratedCount} รายการ` });
      fetchData(); // refresh averages
    } catch (err: any) {
      console.error("Save menu reviews error:", err);
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Group items by type
  const noodles = items.filter((i) => i.type === "noodle");
  const dualPrice = items.filter((i) => i.type === "dual_price");
  const standard = items.filter((i) => i.type === "standard");

  const renderSection = (label: string, sectionItems: MenuItemWithAvg[]) => {
    if (sectionItems.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className="text-[10px] font-light text-muted-foreground">{sectionItems.length} รายการ</span>
        </div>
        {sectionItems.map((item) => (
          <MenuFeedbackCard
            key={item.id}
            item={item}
            myScore={userScores[item.id] ?? null}
            onRate={(v) => handleRate(item.id, v)}
          />
        ))}
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-32">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
                {storeName || "ฟีดแบคเมนู"}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                Menu Feedback · {items.length} รายการ
              </p>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {ratedCount}/{items.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
            <span className="text-xs text-muted-foreground">กำลังโหลดเมนู...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-4xl">🍽️</span>
            <p className="text-sm text-muted-foreground">ยังไม่มีเมนูในร้านนี้</p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-5">
            {renderSection("🍜 ก๋วยเตี๋ยว / Noodles", noodles)}
            {renderSection("💰 ราคาคู่ / Dual Price", dualPrice)}
            {renderSection("🍽️ เมนูทั่วไป / Standard", standard)}
          </div>
        )}

        {/* Submit Button */}
        {items.length > 0 && (
          <div className="fixed bottom-20 left-0 right-0 px-4 z-10">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={changedCount === 0 || saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-foreground text-background font-semibold text-sm shadow-luxury transition-opacity disabled:opacity-30"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Check size={18} strokeWidth={2} />
              )}
              บันทึกฟีดแบค {changedCount > 0 && `(${changedCount} เปลี่ยน)`}
            </motion.button>
          </div>
        )}

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default MenuFeedback;
