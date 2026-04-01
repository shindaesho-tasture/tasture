import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Minus, Plus, Trash2, CheckCircle2, ShoppingBag } from "lucide-react";
import { useOrder } from "@/lib/order-context";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useGuestSession } from "@/hooks/use-guest-session";
import { toast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";
import { useState } from "react";

const OrderSummary = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { guestId } = useGuestSession();
  const { items, storeName, storeId, updateQuantity, removeItem, clearOrder, totalItems, totalPrice } = useOrder();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
              </motion.div>
            ))}
            <div className="rounded-2xl bg-secondary/60 px-4 py-4 mt-4">
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
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleConfirm}
              className="w-full py-4 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold shadow-luxury">
              {t("orderSum.confirmBtn", language)} · ฿{totalPrice.toLocaleString()}
            </motion.button>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
};

export default OrderSummary;
