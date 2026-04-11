import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Minus, Plus, Trash2, CheckCircle2, ShoppingBag, MessageSquare, ChevronDown, Receipt, Split } from "lucide-react";
import { useOrder } from "@/lib/order-context";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGuestSession } from "@/hooks/use-guest-session";
import { toast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";
import { useState, useMemo, useEffect } from "react";
import SplitBillSheet from "@/components/SplitBillSheet";
import { useQuery } from "@tanstack/react-query";

/* ── Category-specific quick tags ── */
type TagLang = "th" | "en" | "zh" | "ja" | "ko";
const CATEGORY_TAGS: Record<string, Record<TagLang, string[]>> = {
  noodle: {
    th: ["เส้นหนึบ", "เส้นนุ่ม", "น้ำน้อย", "แยกน้ำ", "ไม่ใส่ถั่ว", "ไม่เผ็ด", "เผ็ดมาก", "ไม่ใส่ผักชี"],
    en: ["Firm noodles", "Soft noodles", "Less soup", "Soup separate", "No peanuts", "Not spicy", "Extra spicy", "No cilantro"],
    zh: ["面条偏硬", "面条偏软", "少汤", "汤另上", "不加花生", "不辣", "加辣", "不加香菜"],
    ja: ["麺かため", "麺やわらかめ", "スープ少なめ", "スープ別添え", "ピーナッツ抜き", "辛さなし", "辛さ増し", "パクチー抜き"],
    ko: ["면 단단하게", "면 부드럽게", "국물 적게", "국물 따로", "땅콩 빼기", "안 맵게", "많이 맵게", "고수 빼기"],
  },
  rice: {
    th: ["ข้าวน้อย", "ข้าวเพิ่ม", "ไม่เผ็ด", "เผ็ดน้อย", "เผ็ดมาก", "ไม่ใส่ผัก", "ไม่ใส่ผักชี", "ไข่ดาวสุก"],
    en: ["Less rice", "Extra rice", "Not spicy", "Less spicy", "Extra spicy", "No veggies", "No cilantro", "Well-done egg"],
    zh: ["米饭少一点", "米饭多一点", "不辣", "微辣", "加辣", "不加蔬菜", "不加香菜", "鸡蛋全熟"],
    ja: ["ご飯少なめ", "ご飯多め", "辛さなし", "辛さ控えめ", "辛さ増し", "野菜抜き", "パクチー抜き", "目玉焼きよく焼き"],
    ko: ["밥 적게", "밥 많이", "안 맵게", "덜 맵게", "많이 맵게", "채소 빼기", "고수 빼기", "달걀 완숙"],
  },
  cafe: {
    th: ["หวานน้อย", "ไม่หวาน", "เพิ่มช็อต", "นมออ๊ต", "ไม่ใส่น้ำแข็ง", "ใส่วิปครีม"],
    en: ["Less sweet", "No sugar", "Extra shot", "Oat milk", "No ice", "Add whipped cream"],
    zh: ["少糖", "无糖", "加浓缩咖啡", "燕麦奶", "不加冰", "加奶油"],
    ja: ["甘さ控えめ", "砂糖なし", "ショット追加", "オーツミルク", "氷なし", "ホイップクリームあり"],
    ko: ["덜 달게", "무설탕", "샷 추가", "귀리 우유", "얼음 빼기", "휘핑크림 추가"],
  },
  dessert: {
    th: ["หวานน้อย", "ไม่หวาน", "เพิ่มท็อปปิ้ง", "ไม่ใส่ถั่ว", "ไม่ใส่นม"],
    en: ["Less sweet", "No sugar", "Extra topping", "No peanuts", "No milk"],
    zh: ["少糖", "无糖", "加配料", "不加花生", "不加牛奶"],
    ja: ["甘さ控えめ", "砂糖なし", "トッピング追加", "ピーナッツ抜き", "ミルクなし"],
    ko: ["덜 달게", "무설탕", "토핑 추가", "땅콩 빼기", "우유 빼기"],
  },
};

const DEFAULT_TAGS: Record<TagLang, string[]> = {
  th: ["ไม่เผ็ด", "ไม่ใส่ผัก", "ไม่ใส่ผักชี", "เผ็ดน้อย", "เผ็ดมาก", "ไม่ใส่ถั่ว", "ไม่ใส่น้ำตาล", "แยกน้ำ"],
  en: ["Not spicy", "No veggies", "No cilantro", "Less spicy", "Extra spicy", "No peanuts", "No sugar", "Soup separate"],
  zh: ["不辣", "不加蔬菜", "不加香菜", "微辣", "加辣", "不加花生", "不加糖", "汤另上"],
  ja: ["辛さなし", "野菜抜き", "パクチー抜き", "辛さ控えめ", "辛さ増し", "ピーナッツ抜き", "砂糖なし", "スープ別添え"],
  ko: ["안 맵게", "채소 빼기", "고수 빼기", "덜 맵게", "많이 맵게", "땅콩 빼기", "설탕 빼기", "국물 따로"],
};

function translateOpt(
  map: Record<string, Record<string, string>> | null | undefined,
  key: string,
  lang: string
): string {
  if (!map || lang === "th") return key;
  return map[key]?.[lang] || key;
}

const OrderSummary = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { guestId } = useGuestSession();
  const { items, storeName, storeId, tableNumber, updateQuantity, removeItem, updateItemNote, clearOrder, totalItems, totalPrice } = useOrder();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [billRequested, setBillRequested] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [billPaid, setBillPaid] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

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
    if (!storeId || items.length === 0) {
      toast({
        title: t("orderSum.cannotSubmit", language),
        description: !storeId ? t("orderSum.noStore", language) : t("orderSum.noItems", language),
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const orderItems = items.map((i) => ({
        menuItemId: i.menuItemId,
        name: i.name,
        nameTranslations: i.nameTranslations || undefined,
        price: i.price,
        quantity: i.quantity,
        type: i.type,
        note: i.note || undefined,
        selectedOptions: i.selectedOptions,
        optionTranslations: i.optionTranslations || undefined,
      }));
      const { data: inserted, error } = await supabase.from("orders").insert({
        store_id: storeId,
        user_id: user?.id || null,
        guest_id: user ? null : guestId,
        items: orderItems,
        status: "pending",
        customer_language: language,
        total_price: totalPrice,
        notes: notes.trim() || null,
        table_number: tableNumber || null,
      } as any).select("id").single();
      if (error) throw error;
      // Send push notification to merchant
      supabase.functions.invoke("send-push", {
        body: {
          store_id: storeId,
          title: `🔔 ออเดอร์ใหม่${tableNumber ? ` โต๊ะ ${tableNumber}` : ""}`,
          body: `${orderItems.length} รายการ · ฿${totalPrice.toLocaleString()}`,
          url: `/kitchen/${storeId}`,
          tag: `new-order-${Date.now()}`,
        },
      }).catch(() => {});
      clearOrder();
      navigate(`/order/${(inserted as any).id}`, { replace: true });
    } catch (err: any) {
      console.error("Order submit error:", err);
      toast({ title: "ส่งออเดอร์ไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  const handleReview = () => navigate("/post-review");
  const handleDone = () => { clearOrder(); navigate(user ? "/orders" : "/guest-orders"); };

  const handleRequestBill = async () => {
    if (!storeId || requestingBill) return;
    setRequestingBill(true);
    if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
    try {
      await supabase.from("bill_requests" as any).insert({
        store_id: storeId,
        table_number: tableNumber || 0,
        guest_id: user ? null : guestId,
        total_amount: totalPrice,
      } as any);
      setBillRequested(true);
      toast({ title: language === "th" ? "💰 เรียกเก็บเงินแล้ว" : "💰 Bill requested" });
      // Send push notification to merchant
      supabase.functions.invoke("send-push", {
        body: {
          store_id: storeId,
          title: `💰 เรียกเก็บเงิน${tableNumber ? ` โต๊ะ ${tableNumber}` : ""}`,
          body: `฿${totalPrice.toLocaleString()}`,
          url: `/kitchen/${storeId}`,
          tag: `bill-request-${Date.now()}`,
        },
      }).catch(() => {});
    } catch (err: any) {
      toast({ title: language === "th" ? "เกิดข้อผิดพลาด" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setRequestingBill(false);
    }
  };

  // Listen for bill paid status via realtime
  useEffect(() => {
    if (!billRequested || !storeId) return;
    const channel = supabase
      .channel("bill-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bill_requests", filter: `store_id=eq.${storeId}` },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "paid" && updated.table_number === (tableNumber || 0)) {
            setBillPaid(true);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            // Auto redirect to feedback after 2s
            setTimeout(() => {
              navigate(`/menu-feedback/${storeId}`);
            }, 2000);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [billRequested, storeId, tableNumber]);

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

            {/* Bill request section */}
            {billPaid ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-xs text-center space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-score-emerald/15 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-score-emerald" />
                </div>
                <p className="text-lg font-bold text-score-emerald">
                  {t("orderSum.payDone", language)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("orderSum.redirectFeedback", language)}
                </p>
              </motion.div>
            ) : billRequested ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-xs px-6 py-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-300 dark:border-amber-500/30 text-center space-y-2"
              >
                <div className="text-3xl animate-bounce">💰</div>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                  {t("orderSum.billWaiting", language)}
                </p>
                <p className="text-xs text-amber-600/70 dark:text-amber-400/60">
                  {t("orderSum.billNotified", language)}
                </p>
              </motion.div>
            ) : (
              <div className="flex gap-2 w-full max-w-xs mt-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleRequestBill} disabled={requestingBill}
                  className="flex-1 px-4 py-3.5 rounded-2xl bg-amber-500 text-white text-sm font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  <Receipt size={16} />
                  {t("orderSum.bill", language)}
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSplitOpen(true)}
                  className="px-4 py-3.5 rounded-2xl bg-primary/10 text-primary text-sm font-bold flex items-center justify-center gap-2 border-2 border-primary/30">
                  <Split size={16} />
                  {t("orderSum.split", language)}
                </motion.button>
              </div>
            )}

            <motion.button whileTap={{ scale: 0.97 }} onClick={handleReview}
              className="w-full max-w-xs px-8 py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold shadow-luxury mt-2">
              {t("orderSum.reviewBtn", language)}
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleDone}
              className="px-8 py-2.5 rounded-2xl bg-secondary text-foreground text-xs font-medium mt-2">
              {t("orderSum.skipBtn", language)}
            </motion.button>
          </motion.div>

          <SplitBillSheet
            open={splitOpen}
            onOpenChange={setSplitOpen}
            items={items}
            totalPrice={totalPrice}
          />
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
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {language !== "th" && item.nameTranslations?.[language]
                        ? item.nameTranslations[language]
                        : item.name}
                    </h3>
                    {language !== "th" && item.nameTranslations?.[language] && (
                      <p className="text-[10px] text-muted-foreground">{item.name}</p>
                    )}
                    {item.selectedOptions && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.selectedOptions.noodleType && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
                            🍜 {translateOpt(item.optionTranslations?.noodleTypeTranslations, item.selectedOptions.noodleType, language)}
                            {item.selectedOptions.noodleTypePrice ? ` +฿${item.selectedOptions.noodleTypePrice}` : ""}
                          </span>
                        )}
                        {item.selectedOptions.noodleStyle && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
                            🍲 {translateOpt(item.optionTranslations?.noodleStyleTranslations, item.selectedOptions.noodleStyle, language)}
                            {item.selectedOptions.noodleStylePrice ? ` +฿${item.selectedOptions.noodleStylePrice}` : ""}
                          </span>
                        )}
                        {item.selectedOptions.toppings?.map((tp) => (
                          <span key={tp} className="text-[9px] px-1.5 py-0.5 rounded-md bg-score-emerald/10 text-score-emerald">
                            {translateOpt(item.optionTranslations?.toppingTranslations, tp, language)}
                          </span>
                        ))}
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
                    <span>{item.note ? item.note.slice(0, 30) + (item.note.length > 30 ? "…" : "") : t("orderSum.addItemNote", language)}</span>
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
                          {(quickTags[language as TagLang] ?? quickTags.en).map((tag, idx) => {
                            // Always store Thai tag in note (kitchen reads Thai)
                            const thaiTag = quickTags.th[idx] ?? tag;
                            const currentNote = item.note || "";
                            const isActive = currentNote.includes(thaiTag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  if (isActive) {
                                    const updated = currentNote.replace(thaiTag, "").replace(/,\s*,/g, ",").replace(/^,\s*|,\s*$/g, "").trim();
                                    updateItemNote(item.menuItemId, updated);
                                  } else {
                                    const updated = currentNote ? `${currentNote}, ${thaiTag}` : thaiTag;
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
                          placeholder={t("orderSum.typeMore", language)}
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
                placeholder={t("orderSum.notesPlaceholder", language)}
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
              {submitting ? t("orderSum.submitting", language) : `${t("orderSum.confirmBtn", language)} · ฿${totalPrice.toLocaleString()}`}
            </motion.button>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};

export default OrderSummary;
