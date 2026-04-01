import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChefHat, Check, Clock, Flame, Globe, Volume2, VolumeX, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import PageTransition from "@/components/PageTransition";
import { Skeleton } from "@/components/ui/skeleton";

// Generate a notification beep using Web Audio API
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
    // Three ascending tones
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
  th: "🇹🇭",
  en: "🇬🇧",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "รอรับ", color: "text-amber-700", bg: "bg-amber-100" },
  accepted: { label: "กำลังทำ", color: "text-blue-700", bg: "bg-blue-100" },
  served: { label: "เสิร์ฟแล้ว", color: "text-emerald-700", bg: "bg-emerald-100" },
};

const KitchenDashboard = () => {
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "accepted" | "all">("pending");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );
  const initialLoadDone = useRef(false);
  const [newOrderAlert, setNewOrderAlert] = useState<OrderRow | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const alertTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const REJECT_REASONS = ["วัตถุดิบหมด", "ร้านกำลังจะปิด", "ออเดอร์เยอะเกินไป"];

  const dismissAlert = useCallback(() => {
    setNewOrderAlert(null);
    if (alertTimeout.current) clearTimeout(alertTimeout.current);
  }, []);

  const showNewOrderAlert = useCallback((order: OrderRow) => {
    setNewOrderAlert(order);
    if (alertTimeout.current) clearTimeout(alertTimeout.current);
    alertTimeout.current = setTimeout(() => setNewOrderAlert(null), 8000);
  }, []);

  const requestNotifPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }, []);

  // Fetch orders
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      setLoading(true);
      const { data: store } = await supabase.from("stores").select("name").eq("id", storeId).single();
      if (store) setStoreName(store.name);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("store_id", storeId)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: true });
      setOrders((data as any as OrderRow[]) || []);
      setLoading(false);
    })();
  }, [storeId]);

  // Real-time subscription
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`kitchen-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newOrder = payload.new as any as OrderRow;
            setOrders((prev) => [...prev, newOrder]);
            // Sound + notification for new orders
            if (initialLoadDone.current && newOrder.status === "pending") {
              if (soundEnabled) playOrderBeep();
              sendBrowserNotification(newOrder.order_number, (newOrder.items || []).length);
              navigator.vibrate?.([100, 50, 100, 50, 200]);
              showNewOrderAlert(newOrder);
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
  }, [storeId, soundEnabled]);

  // Mark initial load done after first fetch
  useEffect(() => {
    if (!loading && !initialLoadDone.current) {
      initialLoadDone.current = true;
    }
  }, [loading]);

  const updateStatus = async (orderId: string, status: string, rejection_reason?: string) => {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (rejection_reason) updateData.rejection_reason = rejection_reason;
    await supabase.from("orders").update(updateData).eq("id", orderId);
  };

  const filtered = orders.filter((o) => {
    if (filter === "all") return true;
    return o.status === filter;
  });

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const acceptedCount = orders.filter((o) => o.status === "accepted").length;

  const timeSince = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return "เมื่อกี้";
    if (diff < 60) return `${diff} นาที`;
    return `${Math.floor(diff / 60)} ชม.`;
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-zinc-950 text-white">
        {/* Full-screen new order alert */}
        <AnimatePresence>
          {newOrderAlert && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={dismissAlert}
            >
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="mx-6 w-full max-w-sm rounded-3xl bg-zinc-900 border-2 border-amber-500 shadow-[0_0_60px_rgba(245,158,11,0.3)] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Pulsing header */}
                <div className="bg-amber-500 px-6 py-5 text-center animate-pulse">
                  <span className="text-5xl">🔔</span>
                  <h2 className="text-3xl font-black text-zinc-900 mt-2">ออเดอร์ใหม่!</h2>
                </div>

                {/* Order info */}
                <div className="px-6 py-5 text-center space-y-3">
                  <p className="text-6xl font-black text-white">#{newOrderAlert.order_number}</p>
                  <p className="text-xl text-zinc-400">
                    {(newOrderAlert.items || []).length} รายการ · ฿{Number(newOrderAlert.total_price).toLocaleString()}
                  </p>
                  {/* Item names */}
                  <div className="space-y-1 pt-2">
                    {(newOrderAlert.items || []).slice(0, 5).map((item: any, i: number) => (
                      <p key={i} className="text-lg font-bold text-white">
                        {item.name} × {item.quantity}
                      </p>
                    ))}
                    {(newOrderAlert.items || []).length > 5 && (
                      <p className="text-sm text-zinc-500">+{(newOrderAlert.items || []).length - 5} รายการ</p>
                    )}
                  </div>
                  {newOrderAlert.notes && (
                    <div className="mt-3 px-3 py-2 rounded-xl bg-teal-900/40 border border-teal-700/50">
                      <p className="text-base font-bold text-teal-300">📝 {newOrderAlert.notes}</p>
                    </div>
                  )}
                </div>

                {/* Action buttons / Reject dialog */}
                {!showRejectDialog ? (
                  <div className="px-6 pb-6 flex gap-3">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        updateStatus(newOrderAlert.id, "accepted");
                        dismissAlert();
                      }}
                      className="flex-1 py-4 rounded-2xl bg-amber-500 text-zinc-900 text-xl font-black shadow-lg"
                    >
                      ✅ รับออเดอร์
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => { setRejectReason(""); setShowRejectDialog(true); }}
                      className="px-5 py-4 rounded-2xl bg-red-600 text-white text-sm font-bold"
                    >
                      ❌ ปฏิเสธ
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={dismissAlert}
                      className="px-5 py-4 rounded-2xl bg-zinc-800 text-zinc-400 text-sm font-medium"
                    >
                      ปิด
                    </motion.button>
                  </div>
                ) : (
                  <div className="px-6 pb-6 space-y-3">
                    <p className="text-lg font-bold text-red-400 text-center">เลือกเหตุผลปฏิเสธ</p>
                    <div className="flex flex-wrap gap-2">
                      {REJECT_REASONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setRejectReason(r)}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                            rejectReason === r
                              ? "bg-red-600 border-red-500 text-white"
                              : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <textarea
                      placeholder="เหตุผลอื่น (ถ้ามี)..."
                      value={REJECT_REASONS.includes(rejectReason) ? "" : rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full rounded-xl bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                      rows={2}
                    />
                    <div className="flex gap-3">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        disabled={!rejectReason.trim()}
                        onClick={() => {
                          updateStatus(newOrderAlert.id, "rejected", rejectReason.trim());
                          setShowRejectDialog(false);
                          dismissAlert();
                        }}
                        className="flex-1 py-3 rounded-2xl bg-red-600 text-white text-lg font-bold shadow-lg disabled:opacity-40"
                      >
                        ยืนยันปฏิเสธ
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowRejectDialog(false)}
                        className="px-5 py-3 rounded-2xl bg-zinc-800 text-zinc-400 text-sm font-medium"
                      >
                        ย้อนกลับ
                      </motion.button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Header */}
        <div className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-zinc-800 transition-colors">
              <ChevronLeft size={24} className="text-zinc-400" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ChefHat size={20} className="text-amber-400" />
                <h1 className="text-lg font-bold tracking-tight">ครัว</h1>
              </div>
              <p className="text-xs text-zinc-500 truncate">{storeName}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Notification permission */}
              {notifPermission !== "granted" && (
                <button
                  onClick={requestNotifPermission}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors"
                  title="เปิดแจ้งเตือน"
                >
                  <Bell size={18} className="text-zinc-400" />
                </button>
              )}
              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled((p) => !p)}
                className={`p-2 rounded-xl transition-colors ${soundEnabled ? "bg-amber-500/20" : "bg-zinc-800"}`}
                title={soundEnabled ? "ปิดเสียง" : "เปิดเสียง"}
              >
                {soundEnabled ? <Volume2 size={18} className="text-amber-400" /> : <VolumeX size={18} className="text-zinc-500" />}
              </button>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 animate-pulse">
                  <Flame size={14} className="text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">{pendingCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 px-4 pb-3">
            {(["pending", "accepted", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {f === "pending" ? `รอรับ (${pendingCount})` : f === "accepted" ? `กำลังทำ (${acceptedCount})` : "ทั้งหมด"}
              </button>
            ))}
          </div>
        </div>

        {/* Orders */}
        <div className="px-3 py-3 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border-2 border-zinc-800 bg-zinc-900 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-7 w-16 bg-zinc-800" />
                      <Skeleton className="h-5 w-5 rounded-full bg-zinc-800" />
                      <Skeleton className="h-5 w-14 rounded-full bg-zinc-800" />
                    </div>
                    <Skeleton className="h-4 w-12 bg-zinc-800" />
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <Skeleton className="h-7 w-3/4 bg-zinc-800" />
                    <Skeleton className="h-7 w-1/2 bg-zinc-800" />
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
                    <Skeleton className="h-5 w-16 bg-zinc-800" />
                    <Skeleton className="h-11 w-32 rounded-xl bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <ChefHat size={48} className="text-zinc-700" />
              <p className="text-zinc-500 text-lg">ไม่มีออเดอร์</p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((order) => {
                const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const flag = LANG_FLAGS[order.customer_language] || "🌐";
                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    layout
                    className={`rounded-2xl border-2 overflow-hidden ${
                      order.status === "pending"
                        ? "border-amber-500/50 bg-zinc-900"
                        : order.status === "accepted"
                        ? "border-blue-500/30 bg-zinc-900/80"
                        : "border-zinc-800 bg-zinc-900/50"
                    }`}
                  >
                    {/* Order header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black text-white">#{order.order_number}</span>
                        <span className="text-2xl">{flag}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-zinc-500">
                        <Clock size={14} />
                        <span className="text-xs font-medium">{timeSince(order.created_at)}</span>
                      </div>
                    </div>

                    {/* Items - EXTRA LARGE THAI TEXT */}
                    <div className="px-4 py-3 space-y-2">
                      {(order.items || []).map((item: any, i: number) => (
                        <div key={i} className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <span className="text-2xl font-extrabold text-white leading-tight">
                              {item.name} × {item.quantity}
                            </span>
                            {/* Selected options */}
                            {item.selectedOptions && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {item.selectedOptions.noodleType && (
                                  <span className="text-sm px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300">
                                    🍜 {item.selectedOptions.noodleType}
                                  </span>
                                )}
                                {item.selectedOptions.noodleStyle && (
                                  <span className="text-sm px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300">
                                    🍲 {item.selectedOptions.noodleStyle}
                                  </span>
                                )}
                                {item.selectedOptions.toppings?.map((tp: string) => (
                                  <span key={tp} className="text-sm px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300">
                                    🥩 {tp}
                                  </span>
                                ))}
                                {item.selectedOptions.addOns?.map((ao: string) => (
                                  <span key={ao} className="text-sm px-2 py-0.5 rounded-lg bg-teal-900/50 text-teal-300 border border-teal-700/50">
                                    + {ao}
                                  </span>
                                ))}
                                {item.selectedOptions.size === "พิเศษ" && (
                                  <span className="text-sm px-2 py-0.5 rounded-lg bg-amber-900/50 text-amber-300 font-bold">
                                    ⭐ พิเศษ
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Per-item note */}
                            {item.note && (
                              <div className="mt-1.5 px-2 py-1 rounded-lg bg-yellow-900/40 border border-yellow-700/50">
                                <span className="text-sm text-yellow-300 font-medium">📝 {item.note}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Notes in teal */}
                    {order.notes && (
                      <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-teal-900/30 border border-teal-700/40">
                        <p className="text-base font-bold text-teal-300">📝 {order.notes}</p>
                      </div>
                    )}

                    {/* Price + Actions */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
                      <span className="text-lg font-bold text-zinc-300">฿{Number(order.total_price).toLocaleString()}</span>
                      <div className="flex gap-2">
                        {order.status === "pending" && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(order.id, "accepted")}
                            className="px-6 py-3 rounded-xl bg-amber-500 text-zinc-900 text-lg font-extrabold shadow-lg"
                          >
                            ✅ รับออเดอร์
                          </motion.button>
                        )}
                        {order.status === "accepted" && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => updateStatus(order.id, "served")}
                            className="px-6 py-3 rounded-xl bg-emerald-500 text-zinc-900 text-lg font-extrabold shadow-lg"
                          >
                            🍽️ เสิร์ฟแล้ว
                          </motion.button>
                        )}
                        {order.status === "served" && (
                          <span className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-500 text-sm font-medium">
                            <Check size={16} className="inline mr-1" /> เสร็จสิ้น
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
      </div>
    </PageTransition>
  );
};

export default KitchenDashboard;
