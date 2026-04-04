import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Gift, Clock, CheckCircle2, Sparkles, UtensilsCrossed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PromoConfig {
  enabled: boolean;
  promo_type: "discount" | "special_item";
  discount_percent: number;
  special_item_name: string;
  special_item_description: string;
  coupon_title: string;
  coupon_subtitle: string;
  duration_seconds: number;
}

interface RewardCouponProps {
  storeId: string;
  dishName: string;
  onStaffConfirm: () => void;
}

const RewardCoupon = ({ storeId, dishName, onStaffConfirm }: RewardCouponProps) => {
  const [promo, setPromo] = useState<PromoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(300);
  const [confirmed, setConfirmed] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("store_promotions")
        .select("*")
        .eq("store_id", storeId)
        .eq("enabled", true)
        .single();

      if (data) {
        setPromo(data as unknown as PromoConfig);
        setTimeLeft(data.duration_seconds ?? 300);
      }
      setLoading(false);
    })();
  }, [storeId]);

  useEffect(() => {
    if (!promo || confirmed || expired) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [promo, confirmed, expired]);

  const handleConfirm = useCallback(() => {
    if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
    setConfirmed(true);
    onStaffConfirm();
  }, [onStaffConfirm]);

  // Don't render anything if no promo or still loading
  if (loading) return null;
  if (!promo) return null;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const progress = timeLeft / promo.duration_seconds;

  if (confirmed) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-3xl bg-score-emerald/10 border-2 border-score-emerald/40 p-6 text-center space-y-3"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <CheckCircle2 size={48} className="text-score-emerald mx-auto" />
        </motion.div>
        <h3 className="text-lg font-bold text-score-emerald">ยืนยันแล้ว!</h3>
        <p className="text-xs text-muted-foreground">คูปองใช้งานได้สำเร็จ</p>
      </motion.div>
    );
  }

  if (expired) {
    return (
      <div className="rounded-3xl bg-secondary/60 border border-border/50 p-6 text-center space-y-2">
        <Clock size={36} className="text-muted-foreground mx-auto opacity-50" />
        <h3 className="text-sm font-medium text-muted-foreground">คูปองหมดอายุแล้ว</h3>
        <p className="text-[10px] text-muted-foreground">ขอบคุณที่ให้รีวิวครับ</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-3xl overflow-hidden border-2 border-amber-400/50 bg-gradient-to-b from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 dark:border-amber-600/30"
    >
      {/* Coupon header */}
      <div className="relative px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 flex items-center justify-center">
            {promo.promo_type === "special_item" ? (
              <UtensilsCrossed size={20} className="text-amber-900" />
            ) : (
              <Gift size={20} className="text-amber-900" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-300">{promo.coupon_title}</h3>
            <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70">{promo.coupon_subtitle}</p>
          </div>
        </div>
        <Sparkles size={16} className="absolute top-4 right-5 text-amber-400 animate-pulse" />
      </div>

      {/* Coupon content */}
      <div className="px-5 pb-3">
        <div className="bg-white/60 dark:bg-zinc-900/40 rounded-2xl p-4 text-center border border-amber-200/50 dark:border-amber-700/30">
          {promo.promo_type === "discount" ? (
            <>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mb-1">ส่วนลดสำหรับ</p>
              <p className="text-lg font-extrabold text-amber-900 dark:text-amber-200 truncate">{dishName}</p>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{promo.discount_percent}% OFF</p>
            </>
          ) : (
            <>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mb-1">ของรางวัล</p>
              <p className="text-lg font-extrabold text-amber-900 dark:text-amber-200">{promo.special_item_name}</p>
              {promo.special_item_description && (
                <p className="text-xs text-amber-700/60 dark:text-amber-400/50 mt-1">{promo.special_item_description}</p>
              )}
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">🎁 FREE</p>
            </>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-amber-200/50 dark:bg-amber-800/30 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-amber-500"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <div className="flex items-center gap-1">
            <Clock size={14} className="text-amber-700 dark:text-amber-400" />
            <span className="text-sm font-bold text-amber-800 dark:text-amber-300 tabular-nums min-w-[3rem]">
              {mins}:{secs.toString().padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>

      {/* Dashed separator */}
      <div className="relative mx-3">
        <div className="border-t-2 border-dashed border-amber-300/60 dark:border-amber-700/40" />
        <div className="absolute -left-5 -top-3 w-6 h-6 rounded-full bg-background" />
        <div className="absolute -right-5 -top-3 w-6 h-6 rounded-full bg-background" />
      </div>

      {/* Staff confirm button */}
      <div className="p-5">
        <p className="text-[10px] text-amber-700/60 dark:text-amber-400/50 text-center mb-3 uppercase tracking-wider">
          ให้พนักงานกดยืนยัน
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleConfirm}
          className="w-full py-4 rounded-2xl bg-amber-500 text-amber-950 text-lg font-extrabold shadow-lg active:bg-amber-600 transition-colors"
        >
          ✅ พนักงานยืนยัน
        </motion.button>
      </div>
    </motion.div>
  );
};

export default RewardCoupon;
