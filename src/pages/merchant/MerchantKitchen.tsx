import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChefHat, Check, Clock, Flame, Volume2, VolumeX, Bell, X, ShoppingBag, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Notification beep via Web Audio API
const playOrderBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    playTone(880, 0, 0.15);
    playTone(1100, 0.18, 0.15);
    playTone(1320, 0.36, 0.25);
  } catch (e) {
    console.warn("Audio not supported", e);
  }
};

const sendBrowserNotification = (orderNumber: number, itemCount: number) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(`🔔 ออเดอร์ใหม่ #${orderNumber}`, {
      body: `${itemCount} รายการ`,
      icon: "/placeholder.svg",
      tag: `order-${orderNumber}`,
    });
  } catch (e) {
    console.warn("Notification failed", e);
  }
};

interface OrderRow {
  id: string;
  order_number: number;
  items: any[];
  status: string;
  customer_language: string;
  total_price: number;
  created_at: string;
  notes: string | null;
}

const LANG_FLAGS: Record<string, string> = {
  th: "🇹🇭", en: "🇬🇧", zh: "🇨🇳", ja: "🇯🇵", ko: "🇰🇷",
};

const MerchantKitchen = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { activeStore, loading: storeLoading } = useMerchant();
  const isTh = language === "th";

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "accepted" | "all">("pending");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );
  const [rejectTarget, setRejectTarget] = useState<OrderRow | null>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/m/login", { replace: true }); return; }
  }, [user, authLoading]);

  // Fetch today's orders
  const fetchOrders = useCallback(async () => {
    if (!activeStore) return;
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("store_id", activeStore.id)
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: true });
    setOrders((data as any as OrderRow[]) || []);
    setLoading(false);
  }, [activeStore]);

  useEffect(() => {
    if (!activeStore) return;
    fetchOrders();
  }, [activeStore, fetchOrders]);

  // Mark initial load done
  useEffect(() => {
    if (!loading && !initialLoadDone.current) initialLoadDone.current = true;
  }, [loading]);

  // Realtime subscription
  useEffect(() => {
    if (!activeStore) return;

    const channel = supabase
      .channel(`m-kitchen-${activeStore.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${activeStore.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as any as OrderRow;
            setOrders((prev) => [...prev, newOrder]);
            if (initialLoadDone.current && newOrder.status === "pending") {
              if (soundEnabled) playOrderBeep();
              sendBrowserNotification(newOrder.order_number, (newOrder.items || []).length);
              navigator.vibrate?.([100, 50, 100, 50, 200]);
            }
          } else if (payload.eventType === "UPDATE") {
            setOrders((prev) =>
              prev.map((o) => (o.id === (payload.new as any).id ? (payload.new as any as OrderRow) : o))
            );
          } else if (payload.eventType === "DELETE") {
            setOrders((prev) => prev.filter((o) => o.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeStore, soundEnabled]);

  const requestNotifPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }, []);

  const updateStatus = async (orderId: string, status: string) => {
    await supabase.from("orders").update({ status, updated_at: new Date().toISOString() } as any).eq("id", orderId);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    await updateStatus(rejectTarget.id, "rejected");
    setRejectTarget(null);
  };

  const filtered = orders.filter((o) => {
    if (filter === "all") return o.status !== "rejected";
    return o.status === filter;
  });

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const acceptedCount = orders.filter((o) => o.status === "accepted").length;
  const servedCount = orders.filter((o) => o.status === "served").length;
  const todayRevenue = orders.filter((o) => o.status !== "rejected").reduce((sum, o) => sum + Number(o.total_price || 0), 0);

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return isTh ? "เมื่อกี้" : "now";
    if (diff < 60) return `${diff} ${isTh ? "นาที" : "min"}`;
    return `${Math.floor(diff / 60)} ${isTh ? "ชม." : "hr"}`;
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: isTh ? "รอรับ" : "Pending", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/20" },
    accepted: { label: isTh ? "กำลังทำ" : "Cooking", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/20" },
    served: { label: isTh ? "เสิร์ฟแล้ว" : "Served", color: "text-score-emerald", bg: "bg-score-emerald/10" },
    rejected: { label: isTh ? "ปฏิเสธ" : "Rejected", color: "text-destructive", bg: "bg-destructive/10" },
  };

  const isReady = !authLoading && !storeLoading;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <ChefHat size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold tracking-tight text-foreground">
                {isTh ? "ครัว" : "Kitchen"}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {activeStore?.name || ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {notifPermission !== "granted" && (
                <button onClick={requestNotifPermission}
                  className="p-2 rounded-xl bg-secondary hover:bg-accent transition-colors">
                  <Bell size={16} className="text-muted-foreground" />
                </button>
              )}
              <button
                onClick={() => setSoundEnabled((p) => !p)}
                className={`p-2 rounded-xl transition-colors ${soundEnabled ? "bg-amber-500/15" : "bg-secondary"}`}
              >
                {soundEnabled
                  ? <Volume2 size={16} className="text-amber-600 dark:text-amber-400" />
                  : <VolumeX size={16} className="text-muted-foreground" />}
              </button>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 animate-pulse">
                  <Flame size={13} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{pendingCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Summary Stats Bar */}
          <div className="flex gap-2 px-4 pb-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-score-emerald/10">
              <TrendingUp size={12} className="text-score-emerald" />
              <span className="text-[10px] font-bold text-score-emerald">฿{todayRevenue.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary">
              <ShoppingBag size={12} className="text-muted-foreground" />
              <span className="text-[10px] font-bold text-foreground">{orders.filter(o => o.status !== "rejected").length}</span>
              <span className="text-[10px] text-muted-foreground">{isTh ? "ออเดอร์" : "orders"}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary">
              <Check size={12} className="text-score-emerald" />
              <span className="text-[10px] font-bold text-foreground">{servedCount}</span>
              <span className="text-[10px] text-muted-foreground">{isTh ? "เสร็จ" : "done"}</span>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-4 pb-3">
            {(["pending", "accepted", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filter === f
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:bg-accent"
                }`}
              >
                {f === "pending"
                  ? `${isTh ? "รอรับ" : "Pending"} (${pendingCount})`
                  : f === "accepted"
                  ? `${isTh ? "กำลังทำ" : "Cooking"} (${acceptedCount})`
                  : isTh ? "ทั้งหมด" : "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Orders List */}
        <div className="px-3 py-3 space-y-3">
          {!isReady || loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-7 w-16" />
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                <ChefHat size={32} className="text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">
                {isTh ? "ไม่มีออเดอร์" : "No orders"}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((order) => {
                const cfg = statusConfig[order.status] || statusConfig.pending;
                const flag = LANG_FLAGS[order.customer_language] || "🌐";
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    layout
                    className={`rounded-2xl border overflow-hidden bg-card ${
                      order.status === "pending"
                        ? "border-amber-500/40 shadow-md"
                        : order.status === "accepted"
                        ? "border-blue-500/30"
                        : "border-border"
                    }`}
                  >
                    {/* Order header */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl font-black text-foreground">#{order.order_number}</span>
                        <span className="text-lg">{flag}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock size={12} />
                        <span className="text-[10px] font-medium">{timeSince(order.created_at)}</span>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="px-4 py-2.5 space-y-1.5">
                      {(order.items || []).map((item: any, i: number) => (
                        <div key={i}>
                          <span className="text-lg font-extrabold text-foreground leading-tight">
                            {item.name} × {item.quantity}
                          </span>
                          {item.selectedOptions && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.selectedOptions.noodleType && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-foreground">
                                  🍜 {item.selectedOptions.noodleType}
                                </span>
                              )}
                              {item.selectedOptions.noodleStyle && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-foreground">
                                  🍲 {item.selectedOptions.noodleStyle}
                                </span>
                              )}
                              {item.selectedOptions.toppings?.map((tp: string) => (
                                <span key={tp} className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-foreground">
                                  🥩 {tp}
                                </span>
                              ))}
                              {item.selectedOptions.addOns?.map((ao: string) => (
                                <span key={ao} className="text-[10px] px-1.5 py-0.5 rounded-md bg-score-emerald/10 text-score-emerald border border-score-emerald/20">
                                  + {ao}
                                </span>
                              ))}
                              {item.selectedOptions.size === "พิเศษ" && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold">
                                  ⭐ พิเศษ
                                </span>
                              )}
                            </div>
                          )}
                          {item.note && (
                            <div className="mt-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">📝 {item.note}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Order notes */}
                    {order.notes && (
                      <div className="mx-4 mb-2 px-2.5 py-1.5 rounded-xl bg-score-emerald/5 border border-score-emerald/20">
                        <p className="text-xs font-bold text-score-emerald">📝 {order.notes}</p>
                      </div>
                    )}

                    {/* Price + Actions */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
                      <span className="text-sm font-bold text-foreground">฿{Number(order.total_price).toLocaleString()}</span>
                      <div className="flex gap-2">
                        {order.status === "pending" && (
                          <>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { setRejectTarget(order); navigator.vibrate?.(8); }}
                              className="px-3 py-2 rounded-xl border border-destructive/30 text-destructive text-xs font-bold hover:bg-destructive/5 transition-colors"
                            >
                              <X size={14} className="inline mr-0.5" />
                              {isTh ? "ปฏิเสธ" : "Reject"}
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { updateStatus(order.id, "accepted"); navigator.vibrate?.(8); }}
                              className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-extrabold shadow-lg"
                            >
                              ✅ {isTh ? "รับออเดอร์" : "Accept"}
                            </motion.button>
                          </>
                        )}
                        {order.status === "accepted" && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { updateStatus(order.id, "served"); navigator.vibrate?.(8); }}
                            className="px-4 py-2 rounded-xl bg-score-emerald text-white text-xs font-extrabold shadow-lg"
                          >
                            🍽️ {isTh ? "เสิร์ฟแล้ว" : "Served"}
                          </motion.button>
                        )}
                        {order.status === "served" && (
                          <span className="px-3 py-1.5 rounded-xl bg-secondary text-muted-foreground text-[10px] font-medium">
                            <Check size={12} className="inline mr-0.5" /> {isTh ? "เสร็จสิ้น" : "Done"}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Reject Confirmation Dialog */}
        <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isTh ? "ปฏิเสธออเดอร์?" : "Reject Order?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isTh
                  ? `ออเดอร์ #${rejectTarget?.order_number} จะถูกปฏิเสธ ลูกค้าจะได้รับแจ้ง`
                  : `Order #${rejectTarget?.order_number} will be rejected. The customer will be notified.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isTh ? "ยกเลิก" : "Cancel"}</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isTh ? "ปฏิเสธออเดอร์" : "Reject Order"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <MerchantBottomNav />
      </div>
    </PageTransition>
  );
};

export default MerchantKitchen;
