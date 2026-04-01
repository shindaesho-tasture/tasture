import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Minus, Plus, Trash2, CheckCircle2, ShoppingBag, MessageSquare, ChevronDown } from "lucide-react";
import { useOrder } from "@/lib/order-context";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGuestSession } from "@/hooks/use-guest-session";
import { toast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/* ── Category-specific quick tags ── */
const CATEGORY_TAGS: Record<string, { th: string[]; en: string[] }> = {
  noodle: {
    th: ["เส้นหนึบ", "เส้นนุ่ม", "น้ำน้อย", "แยกน้ำ", "ไม่ใส่ถั่ว", "ไม่เผ็ด", "เผ็ดมาก", "ไม่ใส่ผักชี"],
    en: ["Firm noodles", "Soft noodles", "Less soup", "Soup separate", "No peanuts", "Not spicy", "Extra spicy", "No cilantro"],
  },
  rice: {
    th: ["ข้าวน้อย", "ข้าวเพิ่ม", "ไม่เผ็ด", "เผ็ดน้อย", "เผ็ดมาก", "ไม่ใส่ผัก", "ไม่ใส่ผักชี", "ไข่ดาวสุก"],
    en: ["Less rice", "Extra rice", "Not spicy", "Less spicy", "Extra spicy", "No veggies", "No cilantro", "Well-done egg"],
  },
  cafe: {
    th: ["หวานน้อย", "ไม่หวาน", "เพิ่มช็อต", "นมออ๊ต", "ไม่ใส่น้ำแข็ง", "ใส่วิปครีม"],
    en: ["Less sweet", "No sugar", "Extra shot", "Oat milk", "No ice", "Add whipped cream"],
  },
  dessert: {
    th: ["หวานน้อย", "ไม่หวาน", "เพิ่มท็อปปิ้ง", "ไม่ใส่ถั่ว", "ไม่ใส่นม"],
    en: ["Less sweet", "No sugar", "Extra topping", "No peanuts", "No milk"],
  },
};

const DEFAULT_TAGS = {
  th: ["ไม่เผ็ด", "ไม่ใส่ผัก", "ไม่ใส่ผักชี", "เผ็ดน้อย", "เผ็ดมาก", "ไม่ใส่ถั่ว", "ไม่ใส่น้ำตาล", "แยกน้ำ"],
  en: ["Not spicy", "No veggies", "No cilantro", "Less spicy", "Extra spicy", "No peanuts", "No sugar", "Soup separate"],
};

const OrderSummary = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { guestId } = useGuestSession();
  const { items, storeName, storeId, updateQuantity, removeItem, updateItemNote, clearOrder, totalItems, totalPrice } = useOrder();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Fetch store category for context-aware quick tags
  const { data: storeCategory } = useQuery({
    queryKey: ["store-category", storeId],
    queryFn: async () => {
      if (!storeId) return null;
      const { data } = await supabase.from("stores").select("category_id").eq("id", storeId).single();
      return data?.category_id || null;
    },
    enabled: !!storeId,
    staleTime: Infinity,
  });

  const quickTags = useMemo(() => {
    const catId = storeCategory?.toLowerCase() || "";
    for (const key of Object.keys(CATEGORY_TAGS)) {
      if (catId.includes(key)) {
        return CATEGORY_TAGS[key];
      }
    }
    return DEFAULT_TAGS;
  }, [storeCategory]);

  const handleConfirm = async () => {
    if (!storeId || items.length === 0) return;
    setSubmitting(true);
    try {
      const orderItems = items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        type: i.type,
        note: i.note || undefined,
        selectedOptions: i.selectedOptions,
      }));
      const { error } = await supabase.from("orders").insert({
        store_id: storeId,
        user_id: user?.id || null,
        guest_id: user ? null : guestId,
        items: orderItems,
        status: "pending",
        customer_language: language,
        total_price: totalPrice,
        notes: notes.trim() || null,
      } as any);
      if (error) throw error;
      setConfirmed(true);
    } catch (err: any) {
      console.error("Order submit error:", err);
      toast({ title: "ส่งออเดอร์ไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  const handleReview = () => navigate("/post-review");
  const handleDone = () => { clearOrder(); navigate("/store-list"); };

  if (confirmed) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} className="flex flex-col items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-score-emerald/15 flex items-center justify-center">
              <CheckCircle2 size={40} strokeWidth={1.5} className="text-score-emerald" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">{t("orderSum.confirmed", language)}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("orderSum.items", language, { count: totalItems })} · ฿{totalPrice.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{storeName}</p>
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleReview}
              className="w-full max-w-xs px-8 py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold shadow-luxury mt-4">
              {t("orderSum.reviewBtn", language)}
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleDone}
              className="px-8 py-2.5 rounded-2xl bg-secondary text-foreground text-xs font-medium mt-2">
              {t("orderSum.skipBtn", language)}
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate("/m/kitchen")}
              className="px-8 py-2.5 rounded-2xl bg-accent text-accent-foreground text-xs font-medium mt-1 flex items-center gap-1.5">
              🍳 {language === "th" ? "ดูในครัว (Merchant)" : "View in Kitchen (Merchant)"}
            </motion.button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-40">
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground">{t("orderSum.title", language)}</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{storeName || "Order Summary"}</p>
            </div>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <ShoppingBag size={28} strokeWidth={1.5} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("orderSum.empty", language)}</p>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate(storeId ? `/store/${storeId}/order` : "/store-list")}
              className="px-5 py-3 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-medium">
              {t("orderSum.selectMenu", language)}
            </motion.button>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-2">
            {items.map((item, i) => (
              <motion.div key={item.menuItemId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-surface-elevated border border-border/50 shadow-luxury px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">{item.name}</h3>
                    {item.selectedOptions && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.selectedOptions.noodleType && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
                            🍜 {item.selectedOptions.noodleType}
                            {item.selectedOptions.noodleTypePrice ? ` +฿${item.selectedOptions.noodleTypePrice}` : ""}
                          </span>
                        )}
                        {item.selectedOptions.noodleStyle && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
                            🍲 {item.selectedOptions.noodleStyle}
                            {item.selectedOptions.noodleStylePrice ? ` +฿${item.selectedOptions.noodleStylePrice}` : ""}
                          </span>
                        )}
                        {item.selectedOptions.toppings?.map((tp) => <span key={tp} className="text-[9px] px-1.5 py-0.5 rounded-md bg-score-emerald/10 text-score-emerald">{tp}</span>)}
                        {item.selectedOptions.addOns?.map((ao) => <span key={ao} className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/60 text-accent-foreground">+ {ao}</span>)}
                      </div>
                    )}
                    <span className="text-xs text-score-emerald font-bold">฿{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center"><Minus size={12} strokeWidth={2} className="text-foreground" /></motion.button>
                    <span className="text-sm font-bold text-foreground w-4 text-center">{item.quantity}</span>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                      className="w-7 h-7 rounded-lg bg-score-emerald flex items-center justify-center"><Plus size={12} strokeWidth={2} className="text-primary-foreground" /></motion.button>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => removeItem(item.menuItemId)}
                      className="w-7 h-7 rounded-lg bg-score-ruby/10 flex items-center justify-center ml-1"><Trash2 size={12} strokeWidth={2} className="text-score-ruby" /></motion.button>
                  </div>
                </div>
                {/* Per-item note */}
                <div className="mt-2 pt-2 border-t border-border/30">
                  <button
                    onClick={() => setExpandedNotes((prev) => {
                      const next = new Set(prev);
                      next.has(item.menuItemId) ? next.delete(item.menuItemId) : next.add(item.menuItemId);
                      return next;
                    })}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageSquare size={10} />
                    <span>{item.note ? item.note.slice(0, 30) + (item.note.length > 30 ? "…" : "") : (language === "th" ? "เพิ่มโน้ตเฉพาะจาน" : "Add item note")}</span>
                    <ChevronDown size={10} className={`transition-transform ${expandedNotes.has(item.menuItemId) ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {expandedNotes.has(item.menuItemId) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {/* Quick tags */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(language === "th" ? quickTags.th : quickTags.en).map((tag) => {
                            const currentNote = item.note || "";
                            const isActive = currentNote.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  if (isActive) {
                                    const updated = currentNote.replace(tag, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
                                    updateItemNote(item.menuItemId, updated);
                                  } else {
                                    const updated = currentNote ? `${currentNote}, ${tag}` : tag;
                                    updateItemNote(item.menuItemId, updated);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                                  isActive
                                    ? "bg-score-emerald/20 text-score-emerald border border-score-emerald/40"
                                    : "bg-secondary text-muted-foreground border border-border/50 active:scale-95"
                                }`}
                              >
                                {isActive ? "✓ " : ""}{tag}
                              </button>
                            );
                          })}
                        </div>
                        <textarea
                          value={item.note || ""}
                          onChange={(e) => updateItemNote(item.menuItemId, e.target.value)}
                          placeholder={language === "th" ? "พิมพ์เพิ่มเติม..." : "Type more..."}
                          rows={1}
                          maxLength={100}
                          className="w-full mt-2 bg-secondary/60 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 border-0 outline-none resize-none focus:ring-1 focus:ring-score-emerald/30"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
            {/* Notes */}
            <div className="rounded-2xl bg-surface-elevated border border-border/50 shadow-luxury px-4 py-3 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">{t("orderSum.notes", language)}</span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={language === "th" ? "เช่น ไม่ใส่ผัก, ไม่เผ็ด, แพ้ถั่ว..." : "e.g. No vegetables, not spicy, nut allergy..."}
                rows={2}
                maxLength={200}
                className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 border-0 outline-none resize-none focus:ring-1 focus:ring-score-emerald/30"
              />
              {notes.length > 0 && <p className="text-[10px] text-muted-foreground text-right mt-1">{notes.length}/200</p>}
            </div>

            <div className="rounded-2xl bg-secondary/60 px-4 py-4 mt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("orderSum.total", language)}</span>
                <span className="text-lg font-bold text-foreground">฿{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{t("orderSum.items", language, { count: totalItems })}</span>
              </div>
            </div>
          </div>
        )}

        {items.length > 0 && (
          <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed bottom-6 left-4 right-4 z-50">
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleConfirm} disabled={submitting}
              className="w-full py-4 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold shadow-luxury disabled:opacity-50">
              {submitting ? "กำลังส่ง..." : `${t("orderSum.confirmBtn", language)} · ฿${totalPrice.toLocaleString()}`}
            </motion.button>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};

export default OrderSummary;
