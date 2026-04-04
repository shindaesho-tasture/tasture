import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Gift, Percent, UtensilsCrossed, Save, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const MerchantPromotions = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { activeStore, loading: storesLoading } = useMerchant();
  const isTh = language === "th";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [promoType, setPromoType] = useState<"discount" | "special_item">("discount");
  const [discountPercent, setDiscountPercent] = useState(10);
  const [specialItemName, setSpecialItemName] = useState("");
  const [specialItemDescription, setSpecialItemDescription] = useState("");
  const [couponTitle, setCouponTitle] = useState("🎉 รางวัลรีวิวเวอร์!");
  const [couponSubtitle, setCouponSubtitle] = useState("ขอบคุณที่ให้ feedback");
  const [durationSeconds, setDurationSeconds] = useState(300);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/m/login"); return; }
  }, [user, authLoading]);

  useEffect(() => {
    if (!activeStore) return;
    fetchPromo();
  }, [activeStore]);

  const fetchPromo = async () => {
    if (!activeStore) return;
    setLoading(true);
    const { data } = await supabase
      .from("store_promotions")
      .select("*")
      .eq("store_id", activeStore.id)
      .single();

    if (data) {
      setEnabled(data.enabled);
      setPromoType(data.promo_type as "discount" | "special_item");
      setDiscountPercent(data.discount_percent ?? 10);
      setSpecialItemName(data.special_item_name ?? "");
      setSpecialItemDescription(data.special_item_description ?? "");
      setCouponTitle(data.coupon_title ?? "🎉 รางวัลรีวิวเวอร์!");
      setCouponSubtitle(data.coupon_subtitle ?? "ขอบคุณที่ให้ feedback");
      setDurationSeconds(data.duration_seconds ?? 300);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!activeStore) return;
    setSaving(true);
    try {
      const payload = {
        store_id: activeStore.id,
        enabled,
        promo_type: promoType,
        discount_percent: discountPercent,
        special_item_name: specialItemName,
        special_item_description: specialItemDescription,
        coupon_title: couponTitle,
        coupon_subtitle: couponSubtitle,
        duration_seconds: durationSeconds,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("store_promotions")
        .upsert(payload as any, { onConflict: "store_id" });

      if (error) throw error;
      toast.success(isTh ? "บันทึกโปรโมชั่นสำเร็จ" : "Promotion saved");
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  const durationMinutes = Math.floor(durationSeconds / 60);

  if (authLoading || storesLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate("/m")} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </motion.button>
            <div className="flex-1">
              <h1 className="text-base font-bold tracking-tight text-foreground">
                {isTh ? "ตั้งค่าโปรโมชั่น" : "Promotion Settings"}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {isTh ? "การ์ดโปรโมชั่นหลังให้ฟีดแบค" : "Post-feedback reward card"}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-5">
            {/* Enable toggle */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-elevated border border-border/50 p-4"
            >
              <button
                onClick={() => setEnabled(!enabled)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? "bg-score-emerald/15" : "bg-secondary"}`}>
                    <Gift size={18} className={enabled ? "text-score-emerald" : "text-muted-foreground"} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">
                      {isTh ? "เปิดใช้งานโปรโมชั่น" : "Enable Promotion"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isTh ? "แสดงการ์ดโปรโมชั่นเมื่อลูกค้ารีวิวเสร็จ" : "Show promotion card after review"}
                    </p>
                  </div>
                </div>
                {enabled ? (
                  <ToggleRight size={32} className="text-score-emerald" />
                ) : (
                  <ToggleLeft size={32} className="text-muted-foreground" />
                )}
              </button>
            </motion.div>

            {enabled && (
              <>
                {/* Promo Type */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="space-y-3"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {isTh ? "ประเภทโปรโมชั่น" : "Promotion Type"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPromoType("discount")}
                      className={`rounded-2xl border-2 p-4 text-center transition-all ${
                        promoType === "discount"
                          ? "border-score-emerald/60 bg-score-emerald/10"
                          : "border-border/50 bg-surface-elevated"
                      }`}
                    >
                      <Percent size={24} className={promoType === "discount" ? "text-score-emerald mx-auto mb-2" : "text-muted-foreground mx-auto mb-2"} />
                      <p className="text-xs font-bold text-foreground">{isTh ? "ลดราคา" : "Discount"}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{isTh ? "ลดราคาเปอร์เซ็นต์" : "% off next order"}</p>
                    </button>
                    <button
                      onClick={() => setPromoType("special_item")}
                      className={`rounded-2xl border-2 p-4 text-center transition-all ${
                        promoType === "special_item"
                          ? "border-score-emerald/60 bg-score-emerald/10"
                          : "border-border/50 bg-surface-elevated"
                      }`}
                    >
                      <UtensilsCrossed size={24} className={promoType === "special_item" ? "text-score-emerald mx-auto mb-2" : "text-muted-foreground mx-auto mb-2"} />
                      <p className="text-xs font-bold text-foreground">{isTh ? "เมนูพิเศษ" : "Special Item"}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{isTh ? "แจกเมนูหรือของพิเศษ" : "Free item / special"}</p>
                    </button>
                  </div>
                </motion.div>

                {/* Discount settings */}
                {promoType === "discount" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-surface-elevated border border-border/50 p-4 space-y-3"
                  >
                    <p className="text-xs font-semibold text-foreground">{isTh ? "เปอร์เซ็นต์ส่วนลด" : "Discount Percentage"}</p>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Number(e.target.value))}
                        className="w-24 text-center text-lg font-bold"
                      />
                      <span className="text-2xl font-bold text-muted-foreground">%</span>
                    </div>
                    <div className="flex gap-2">
                      {[5, 10, 15, 20, 30].map((v) => (
                        <button
                          key={v}
                          onClick={() => setDiscountPercent(v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            discountPercent === v
                              ? "bg-score-emerald text-white"
                              : "bg-secondary text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          {v}%
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Special item settings */}
                {promoType === "special_item" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-surface-elevated border border-border/50 p-4 space-y-3"
                  >
                    <div>
                      <label className="text-xs font-semibold text-foreground">{isTh ? "ชื่อเมนู / ของพิเศษ" : "Item Name"}</label>
                      <Input
                        value={specialItemName}
                        onChange={(e) => setSpecialItemName(e.target.value)}
                        placeholder={isTh ? "เช่น ชาเขียวฟรี 1 แก้ว" : "e.g. Free green tea"}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground">{isTh ? "รายละเอียด" : "Description"}</label>
                      <Textarea
                        value={specialItemDescription}
                        onChange={(e) => setSpecialItemDescription(e.target.value)}
                        placeholder={isTh ? "เช่น ขนาดปกติ เฉพาะทานที่ร้าน" : "e.g. Regular size, dine-in only"}
                        rows={2}
                        className="mt-1"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Coupon customization */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl bg-surface-elevated border border-border/50 p-4 space-y-3"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {isTh ? "ข้อความบนคูปอง" : "Coupon Text"}
                  </p>
                  <div>
                    <label className="text-xs font-semibold text-foreground">{isTh ? "หัวข้อ" : "Title"}</label>
                    <Input
                      value={couponTitle}
                      onChange={(e) => setCouponTitle(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">{isTh ? "คำอธิบาย" : "Subtitle"}</label>
                    <Input
                      value={couponSubtitle}
                      onChange={(e) => setCouponSubtitle(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </motion.div>

                {/* Duration */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl bg-surface-elevated border border-border/50 p-4 space-y-3"
                >
                  <p className="text-xs font-semibold text-foreground">{isTh ? "ระยะเวลาคูปอง (นาที)" : "Coupon Duration (min)"}</p>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={durationMinutes}
                      onChange={(e) => setDurationSeconds(Number(e.target.value) * 60)}
                      className="w-24 text-center text-lg font-bold"
                    />
                    <span className="text-sm text-muted-foreground">{isTh ? "นาที" : "min"}</span>
                  </div>
                  <div className="flex gap-2">
                    {[3, 5, 10, 15, 30].map((v) => (
                      <button
                        key={v}
                        onClick={() => setDurationSeconds(v * 60)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          durationMinutes === v
                            ? "bg-score-emerald text-white"
                            : "bg-secondary text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {v} {isTh ? "นาที" : "min"}
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Preview */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {isTh ? "ตัวอย่างการ์ด" : "Card Preview"}
                  </p>
                  <div className="rounded-3xl overflow-hidden border-2 border-amber-400/50 bg-gradient-to-b from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 dark:border-amber-600/30 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center">
                        <Gift size={20} className="text-amber-900" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-amber-900 dark:text-amber-300">{couponTitle}</h3>
                        <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70">{couponSubtitle}</p>
                      </div>
                    </div>
                    <div className="bg-white/60 dark:bg-zinc-900/40 rounded-2xl p-4 text-center border border-amber-200/50 dark:border-amber-700/30">
                      {promoType === "discount" ? (
                        <>
                          <p className="text-3xl font-black text-amber-600 dark:text-amber-400">{discountPercent}% OFF</p>
                          <p className="text-xs text-amber-800/60 dark:text-amber-300/60 mt-1">{isTh ? "ส่วนลดครั้งถัดไป" : "Next order discount"}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-extrabold text-amber-900 dark:text-amber-200">{specialItemName || "—"}</p>
                          {specialItemDescription && (
                            <p className="text-xs text-amber-800/60 dark:text-amber-300/60 mt-1">{specialItemDescription}</p>
                          )}
                          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">🎁 FREE</p>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-amber-700/50 text-center mt-3">
                      ⏱ {durationMinutes} {isTh ? "นาที" : "min"}
                    </p>
                  </div>
                </motion.div>
              </>
            )}

            {/* Save button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-score-emerald text-white text-sm font-bold flex items-center justify-center gap-2 shadow-luxury disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isTh ? "บันทึก" : "Save"}
            </motion.button>
          </div>
        )}

        <MerchantBottomNav />
      </div>
    </PageTransition>
  );
};

export default MerchantPromotions;
