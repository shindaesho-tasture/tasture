import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Check, Loader2, Sparkles, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";
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

/* ─── Circular Progress Ring ─── */
const ProgressRing = ({ progress, rated, total }: { progress: number; rated: number; total: number }) => {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;

  return (
    <div className="relative">
      <svg width="68" height="68" className="-rotate-90">
        <circle cx="34" cy="34" r={r} fill="none" strokeWidth="4" className="stroke-border" />
        <motion.circle
          cx="34" cy="34" r={r} fill="none" strokeWidth="4"
          strokeLinecap="round"
          className="stroke-score-emerald"
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          strokeDasharray={circ}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-foreground tabular-nums leading-none">{rated}</span>
        <span className="text-[8px] text-muted-foreground font-light">/ {total}</span>
      </div>
    </div>
  );
};

/* ─── Section Divider ─── */
const SectionHeader = ({ icon, label, count, itemsLabel }: { icon: string; label: string; count: number; itemsLabel: string }) => (
  <div className="flex items-center gap-3 pt-2">
    <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-sm">
      {icon}
    </div>
    <div className="flex-1">
      <span className="text-[11px] font-medium text-foreground tracking-wide">{label}</span>
      <span className="text-[9px] text-muted-foreground ml-2">{count} {itemsLabel}</span>
    </div>
    <div className="h-px flex-1 bg-border/50" />
  </div>
);

const MenuFeedback = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<MenuItemWithAvg[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState("");
  const [userScores, setUserScores] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [menuReviewChoice, setMenuReviewChoice] = useState<"same" | "changed" | null>(null);
  const [hasPreviousMenuReview, setHasPreviousMenuReview] = useState(false);
  const [showPostPrompt, setShowPostPrompt] = useState(false);
  const [lastSavedReviewId, setLastSavedReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!storeId) return;
    fetchData();
  }, [storeId, user, authLoading]);

  const fetchData = async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const { data: store } = await supabase
        .from("stores").select("name").eq("id", storeId).single();
      if (store) setStoreName(store.name);

      const { data: menuItems, error: menuErr } = await supabase
        .from("menu_items")
        .select("id, name, type, price, price_special, noodle_types, noodle_styles, toppings")
        .eq("store_id", storeId);
      if (menuErr) throw menuErr;

      const itemIds = (menuItems || []).map((i) => i.id);
      const { data: allReviews } = await supabase
        .from("menu_reviews")
        .select("menu_item_id, user_id, score")
        .in("menu_item_id", itemIds);

      const avgMap = new Map<string, { total: number; count: number }>();
      const myMap = new Map<string, number>();
      (allReviews || []).forEach((r) => {
        if (!avgMap.has(r.menu_item_id)) avgMap.set(r.menu_item_id, { total: 0, count: 0 });
        const m = avgMap.get(r.menu_item_id)!;
        m.total += r.score;
        m.count += 1;
        if (user && r.user_id === user.id) myMap.set(r.menu_item_id, r.score);
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
      const scores: Record<string, number | null> = {};
      result.forEach((item) => { scores[item.id] = item.my_score; });
      setUserScores(scores);
      setHasPreviousMenuReview(result.some((item) => item.my_score !== null));
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

  const changedCount = useMemo(() =>
    items.filter((item) => userScores[item.id] !== item.my_score).length,
  [userScores, items]);

  const ratedCount = useMemo(() =>
    Object.values(userScores).filter((v) => v !== null && v !== undefined).length,
  [userScores]);

  const progress = items.length > 0 ? (ratedCount / items.length) * 100 : 0;

  const handleSubmit = async () => {
    if (!user) { navigate("/auth"); return; }
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

      toast({ title: `✅ ${t("feedback.saved")}`, description: t("feedback.savedDesc", { count: ratedCount }) });

      // Get the most recent review id for linking to a post
      if (upsertRows.length > 0) {
        const { data: latestReview } = await supabase
          .from("menu_reviews")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (latestReview) {
          setLastSavedReviewId(latestReview.id);
          setShowPostPrompt(true);
        }
      }

      setTimeout(() => setSaveSuccess(false), 2000);
      fetchData();
    } catch (err: any) {
      toast({ title: t("feedback.saveFailed"), description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSameReview = async () => {
    if (!user) { navigate("/auth"); return; }
    setSaving(true);
    try {
      const reRows = items
        .filter((item) => item.my_score !== null)
        .map((item) => ({ menu_item_id: item.id, user_id: user.id, score: item.my_score! }));
      if (reRows.length > 0) {
        const { error } = await supabase
          .from("menu_reviews")
          .upsert(reRows, { onConflict: "menu_item_id,user_id" });
        if (error) throw error;
      }
      setSaveSuccess(true);
      toast({ title: "✅ บันทึกสำเร็จ", description: `ยืนยันคะแนนเดิม ${reRows.length} เมนู` });
      setTimeout(() => { setSaveSuccess(false); navigate(-1); }, 1500);
    } catch (err: any) {
      console.error("Re-save menu reviews error:", err);
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const noodles = items.filter((i) => i.type === "noodle");
  const dualPrice = items.filter((i) => i.type === "dual_price");
  const standard = items.filter((i) => i.type === "standard");

  let cardIndex = 0;
  const renderSection = (icon: string, label: string, sectionItems: MenuItemWithAvg[]) => {
    if (sectionItems.length === 0) return null;
    return (
      <div className="space-y-2.5">
        <SectionHeader icon={icon} label={label} count={sectionItems.length} itemsLabel={t("feedback.items")} />
        {sectionItems.map((item) => {
          const ci = cardIndex++;
          return (
            <MenuFeedbackCard
              key={item.id}
              item={item}
              myScore={userScores[item.id] ?? null}
              onRate={(v) => handleRate(item.id, v)}
              index={ci}
            />
          );
        })}
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-36">
        {/* ─── Glassmorphic Header ─── */}
        <div className="sticky top-0 z-20 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
                {storeName || "ฟีดแบคเมนู"}
              </h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
                menu feedback
              </p>
            </div>
            {items.length > 0 && (
              <ProgressRing progress={progress} rated={ratedCount} total={items.length} />
            )}
          </div>
        </div>

        {/* ─── Previous Review Gate ─── */}
        {!loading && items.length > 0 && hasPreviousMenuReview && menuReviewChoice === null && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 pt-5 space-y-4"
          >
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-score-emerald/5 border border-score-emerald/10">
              <Sparkles size={16} className="text-score-emerald mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-[11px] font-medium text-foreground">คุณเคยรีวิวเมนูร้านนี้แล้ว</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">รสชาติเมนูเปลี่ยนไปหรือเปล่า?</p>
              </div>
            </div>

            {/* Previous scores summary */}
            <div className="rounded-2xl border border-border/50 bg-surface-elevated/50 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/30">
                <p className="text-[10px] font-medium text-muted-foreground tracking-wide">คะแนนเดิมที่เคยให้</p>
              </div>
              <div className="divide-y divide-border/20 max-h-52 overflow-y-auto">
                {items.filter((item) => item.my_score !== null).map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[11px] text-foreground truncate flex-1 mr-3">{item.name}</span>
                    <span className="text-sm shrink-0">
                      {item.my_score === 1 ? "😔" : item.my_score === 2 ? "😐" : "🤩"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setMenuReviewChoice("same");
                  handleSameReview();
                }}
                className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl bg-score-emerald/10 border-2 border-score-emerald/30 hover:border-score-emerald/60 transition-all"
              >
                <span className="text-3xl">👍</span>
                <span className="text-sm font-semibold text-foreground">ยังเหมือนเดิม</span>
                <span className="text-[9px] text-muted-foreground">บันทึกคะแนนเดิมอีกครั้ง</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setMenuReviewChoice("changed")}
                className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl bg-score-amber/10 border-2 border-score-amber/30 hover:border-score-amber/60 transition-all"
              >
                <span className="text-3xl">🔄</span>
                <span className="text-sm font-semibold text-foreground">เปลี่ยนไป</span>
                <span className="text-[9px] text-muted-foreground">รีวิวเมนูใหม่</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ─── Hero Description ─── */}
        {!loading && items.length > 0 && (!hasPreviousMenuReview || menuReviewChoice === "changed") && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="px-5 pt-5 pb-2"
          >
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-score-emerald/5 border border-score-emerald/10">
              <Sparkles size={16} className="text-score-emerald mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-[11px] font-medium text-foreground leading-relaxed">
                  กดเลือก <span className="text-score-ruby">😔</span> <span className="text-score-slate">😐</span> <span className="text-score-emerald">🤩</span> เพื่อให้คะแนนแต่ละเมนู
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  ค่าเฉลี่ยจากทุกคนจะแสดงที่วงกลมด้านขวา
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── Content ─── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-full border-[3px] border-border border-t-score-emerald"
            />
            <div className="text-center">
              <p className="text-xs font-medium text-foreground">กำลังโหลดเมนู</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">loading menu items...</p>
            </div>
          </div>
        ) : items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-28 gap-5"
          >
            <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center">
              <span className="text-4xl">🍽️</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">ยังไม่มีเมนูในร้านนี้</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                เมนูจะปรากฏหลังจากสแกนป้ายเมนู
              </p>
            </div>
          </motion.div>
        ) : hasPreviousMenuReview && menuReviewChoice !== "changed" ? (
          null
        ) : (
          <div className="px-4 pt-3 space-y-5">
            {renderSection("🍜", "ก๋วยเตี๋ยว", noodles)}
            {renderSection("💰", "ราคาคู่", dualPrice)}
            {renderSection("🍽️", "เมนูทั่วไป", standard)}
          </div>
        )}

        {/* ─── Floating Submit ─── */}
        <AnimatePresence>
          {items.length > 0 && (!hasPreviousMenuReview || menuReviewChoice === "changed") && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-20 left-0 right-0 px-4 z-10"
            >
              <div className="p-1 rounded-[22px] bg-surface-elevated shadow-card-elevated border border-border/30">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={changedCount === 0 || saving}
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[18px] bg-foreground text-background font-semibold text-sm transition-all disabled:opacity-25"
                >
                  <AnimatePresence mode="wait">
                    {saving ? (
                      <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Loader2 size={18} className="animate-spin" />
                      </motion.div>
                    ) : saveSuccess ? (
                      <motion.div
                        key="success"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Check size={18} strokeWidth={2.5} />
                        <span>สำเร็จ!</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="default"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-2"
                      >
                        <Check size={18} strokeWidth={2} />
                        <span>
                          บันทึกฟีดแบค
                          {changedCount > 0 && (
                            <span className="ml-1 opacity-60">({changedCount} เปลี่ยน)</span>
                          )}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Post Prompt after review */}
        <AnimatePresence>
          {showPostPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
              onClick={() => setShowPostPrompt(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="w-full max-w-sm rounded-3xl bg-card border border-border/30 shadow-luxury p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center space-y-2">
                  <div className="text-4xl">📸</div>
                  <h3 className="text-base font-bold text-foreground">แชร์รูปอาหารพร้อมรีวิว?</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ถ่ายรูปอาหารที่คุณเพิ่งรีวิวแล้วโพสให้เพื่อนเห็น พร้อมแนบคะแนนรีวิวอัตโนมัติ
                  </p>
                </div>
                <div className="flex flex-col gap-2.5">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setShowPostPrompt(false);
                      navigate(`/post?review=${lastSavedReviewId}`);
                    }}
                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-foreground text-background text-sm font-semibold"
                  >
                    <Camera size={16} />
                    โพสรูปพร้อมรีวิว
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowPostPrompt(false)}
                    className="py-3 rounded-2xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    ข้ามไปก่อน
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default MenuFeedback;
