import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Clock, ChefHat, CheckCircle2, XCircle, Receipt, Utensils, Volume2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useLanguage } from "@/lib/language-context";
import { useOrder } from "@/lib/order-context";
import PageTransition from "@/components/PageTransition";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

interface TrackedOrder {
  id: string;
  order_number: number;
  status: string;
  items: any[];
  total_price: number;
  table_number: number | null;
  created_at: string;
  rejection_reason: string | null;
  store_id: string;
  store_name?: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; labelEn: string; color: string; bg: string }> = {
  pending: { icon: <Clock size={18} />, label: "รอร้านยืนยัน", labelEn: "Waiting", color: "text-amber-500", bg: "bg-amber-500/15" },
  accepted: { icon: <ChefHat size={18} />, label: "กำลังทำ", labelEn: "Preparing", color: "text-blue-500", bg: "bg-blue-500/15" },
  served: { icon: <CheckCircle2 size={18} />, label: "เสิร์ฟแล้ว", labelEn: "Served", color: "text-score-emerald", bg: "bg-score-emerald/15" },
  rejected: { icon: <XCircle size={18} />, label: "ปฏิเสธ", labelEn: "Rejected", color: "text-destructive", bg: "bg-destructive/15" },
};

const GuestOrderTracker = () => {
  const navigate = useNavigate();
  const { guestId } = useGuestSession();
  const { language } = useLanguage();
  const { storeId, tableNumber } = useOrder();
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch guest orders
  useEffect(() => {
    if (!guestId) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, items, total_price, table_number, created_at, rejection_reason, store_id")
        .eq("guest_id", guestId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        // Fetch store names
        const storeIds = [...new Set(data.map((o: any) => o.store_id))];
        const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds);
        const storeMap = new Map((stores || []).map((s: any) => [s.id, s.name]));

        setOrders(data.map((o: any) => ({ ...o, store_name: storeMap.get(o.store_id) || "" })));
      }
      setLoading(false);
    })();
  }, [guestId]);

  // Play a short beep for status change
  const playBeep = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.2);
      }, 180);
    } catch {}
  };

  // Realtime updates with notifications
  useEffect(() => {
    if (!guestId) return;
    const channel = supabase
      .channel("guest-orders")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as any;
          if (updated.guest_id === guestId) {
            const oldOrder = orders.find((o) => o.id === updated.id);
            const oldStatus = oldOrder?.status;
            const newStatus = updated.status;

            setOrders((prev) =>
              prev.map((o) =>
                o.id === updated.id
                  ? { ...o, status: newStatus, rejection_reason: updated.rejection_reason }
                  : o
              )
            );

            // Only notify if status actually changed
            if (oldStatus && oldStatus !== newStatus) {
              const cfg = statusConfig[newStatus];
              const orderNum = oldOrder?.order_number || "";

              if (newStatus === "accepted") {
                navigator.vibrate?.([80, 40, 80, 40, 80]);
                playBeep();
                toast({
                  title: language === "th" ? `🍳 ออเดอร์ #${orderNum} กำลังทำ!` : `🍳 Order #${orderNum} is being prepared!`,
                  description: language === "th" ? "ร้านยืนยันออเดอร์แล้ว รอสักครู่" : "Restaurant confirmed. Please wait.",
                });
              } else if (newStatus === "served") {
                navigator.vibrate?.([100, 60, 100, 60, 200]);
                playBeep();
                toast({
                  title: language === "th" ? `✅ ออเดอร์ #${orderNum} เสิร์ฟแล้ว!` : `✅ Order #${orderNum} served!`,
                  description: language === "th" ? "อาหารพร้อมแล้ว!" : "Your food is ready!",
                });
              } else if (newStatus === "rejected") {
                navigator.vibrate?.([200, 100, 200]);
                toast({
                  title: language === "th" ? `❌ ออเดอร์ #${orderNum} ถูกปฏิเสธ` : `❌ Order #${orderNum} rejected`,
                  description: updated.rejection_reason || (language === "th" ? "กรุณาติดต่อร้าน" : "Please contact the restaurant"),
                  variant: "destructive",
                });
              }
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guestId, orders, language]);

  const activeOrders = orders.filter((o) => ["pending", "accepted"].includes(o.status));
  const pastOrders = orders.filter((o) => ["served", "rejected"].includes(o.status));

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="flex items-center gap-3 px-4 py-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <ChevronLeft size={18} className="text-foreground" />
            </motion.button>
            <div>
              <h1 className="text-base font-bold text-foreground">
                {language === "th" ? "📋 ติดตามออเดอร์" : "📋 Track Orders"}
              </h1>
              {tableNumber && (
                <p className="text-[10px] text-muted-foreground">
                  {language === "th" ? `โต๊ะ ${tableNumber}` : `Table ${tableNumber}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="px-4 pt-6 space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 pt-20 gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Utensils size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {language === "th" ? "ยังไม่มีออเดอร์" : "No orders yet"}
            </p>
            {storeId && (
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate(`/store/${storeId}/order`)}
                className="px-6 py-2.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold">
                {language === "th" ? "ไปสั่งอาหาร" : "Order Food"}
              </motion.button>
            )}
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-6">
            {/* Active orders */}
            {activeOrders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  {language === "th" ? "ออเดอร์ปัจจุบัน" : "Active Orders"}
                </h2>
                <AnimatePresence>
                  {activeOrders.map((order) => (
                    <OrderCard key={order.id} order={order} language={language} active />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Past orders */}
            {pastOrders.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                  {language === "th" ? "ออเดอร์ก่อนหน้า" : "Past Orders"}
                </h2>
                {pastOrders.map((order) => (
                  <OrderCard key={order.id} order={order} language={language} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Back to menu button */}
        {storeId && (
          <div className="fixed bottom-6 left-4 right-4 z-40">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate(`/store/${storeId}/order`)}
              className="w-full py-3.5 rounded-2xl bg-secondary text-foreground text-sm font-bold shadow-lg flex items-center justify-center gap-2">
              <Receipt size={18} />
              {language === "th" ? "กลับไปสั่งเพิ่ม" : "Order More"}
            </motion.button>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

const OrderCard = ({ order, language, active }: { order: TrackedOrder; language: string; active?: boolean }) => {
  const cfg = statusConfig[order.status] || statusConfig.pending;
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`rounded-2xl border p-4 space-y-3 ${active ? "border-border bg-card shadow-sm" : "border-border/50 bg-card/50"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
          {order.store_name && (
            <span className="text-xs text-muted-foreground">· {order.store_name}</span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${cfg.bg}`}>
          <span className={cfg.color}>{cfg.icon}</span>
          <span className={`text-[11px] font-bold ${cfg.color}`}>
            {language === "th" ? cfg.label : cfg.labelEn}
          </span>
        </div>
      </div>

      {/* Status animation for active */}
      {active && order.status === "accepted" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10">
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            🍳
          </motion.div>
          <span className="text-xs text-blue-500 font-medium">
            {language === "th" ? "ร้านกำลังทำอาหารของคุณ..." : "Your food is being prepared..."}
          </span>
        </div>
      )}

      {active && order.status === "pending" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
            ⏳
          </motion.div>
          <span className="text-xs text-amber-600 font-medium">
            {language === "th" ? "รอร้านยืนยันออเดอร์..." : "Waiting for confirmation..."}
          </span>
        </div>
      )}

      {/* Rejection reason */}
      {order.status === "rejected" && order.rejection_reason && (
        <div className="px-3 py-2 rounded-xl bg-destructive/10">
          <p className="text-xs text-destructive">{order.rejection_reason}</p>
        </div>
      )}

      {/* Items */}
      <div className="space-y-1">
        {items.slice(0, 4).map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-foreground/80">
              {item.quantity}× {item.name}
            </span>
            <span className="text-muted-foreground">฿{(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        {items.length > 4 && (
          <p className="text-[10px] text-muted-foreground">
            +{items.length - 4} {language === "th" ? "รายการ" : "more"}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(order.created_at), {
            addSuffix: true,
            locale: language === "th" ? th : undefined,
          })}
        </span>
        <span className="text-sm font-bold text-foreground">฿{Number(order.total_price).toLocaleString()}</span>
      </div>
    </motion.div>
  );
};

export default GuestOrderTracker;
