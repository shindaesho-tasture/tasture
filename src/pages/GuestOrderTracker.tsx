import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, Clock, ChefHat, CheckCircle2, XCircle,
  Receipt, Plus, BellRing, UtensilsCrossed, Utensils,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useGuestSession } from "@/hooks/use-guest-session";
import { useLanguage } from "@/lib/language-context";
import { useOrder } from "@/lib/order-context";
import PageTransition from "@/components/PageTransition";
import { formatDistanceToNow } from "date-fns";
import { th as thLocale, enUS, ja, zhCN, ko } from "date-fns/locale";

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

const STATUS_STEPS = ["pending", "accepted", "served"] as const;

const localeMap: Record<string, any> = { th: thLocale, en: enUS, ja, zh: zhCN, ko };

const labels: Record<string, Record<string, string>> = {
  title:       { th: "สรุปออเดอร์", en: "Order Summary", ja: "注文概要", zh: "订单汇总", ko: "주문 요약" },
  table:       { th: "โต๊ะ", en: "Table", ja: "テーブル", zh: "桌号", ko: "테이블" },
  active:      { th: "ออเดอร์ปัจจุบัน", en: "Active Orders", ja: "進行中の注文", zh: "当前订单", ko: "진행 중인 주문" },
  past:        { th: "ออเดอร์ก่อนหน้า", en: "Past Orders", ja: "過去の注文", zh: "历史订单", ko: "이전 주문" },
  noOrders:    { th: "ยังไม่มีออเดอร์", en: "No orders yet", ja: "注文はまだありません", zh: "暂无订单", ko: "아직 주문 없음" },
  orderMore:   { th: "สั่งเพิ่ม", en: "Order More", ja: "追加注文", zh: "继续点餐", ko: "추가 주문" },
  requestBill: { th: "เรียกเก็บเงิน", en: "Request Bill", ja: "お会計", zh: "结账", ko: "계산서 요청" },
  billSent:    { th: "แจ้งพนักงานแล้ว", en: "Staff notified", ja: "スタッフに通知済み", zh: "已通知员工", ko: "직원 알림 완료" },
  callWaiter:  { th: "เรียกพนักงาน", en: "Call Waiter", ja: "店員を呼ぶ", zh: "呼叫服务员", ko: "웨이터 호출" },
  pending:     { th: "รอยืนยัน", en: "Waiting", ja: "確認待ち", zh: "等待确认", ko: "대기 중" },
  accepted:    { th: "กำลังทำ", en: "Preparing", ja: "調理中", zh: "制作中", ko: "준비 중" },
  served:      { th: "เสิร์ฟแล้ว", en: "Served", ja: "提供済み", zh: "已上菜", ko: "서빙 완료" },
  rejected:    { th: "ปฏิเสธ", en: "Rejected", ja: "拒否", zh: "已拒绝", ko: "거절됨" },
  waitMsg:     { th: "รอร้านยืนยันออเดอร์...", en: "Waiting for confirmation...", ja: "確認中...", zh: "等待确认中...", ko: "확인 대기 중..." },
  cookMsg:     { th: "ร้านกำลังทำอาหารของคุณ", en: "Your food is being prepared", ja: "料理中です", zh: "正在为您制作", ko: "음식 준비 중" },
  servedMsg:   { th: "อาหารพร้อมแล้ว 🎉", en: "Your food is ready! 🎉", ja: "料理が届きました 🎉", zh: "您的食物已上桌 🎉", ko: "음식이 나왔어요 🎉" },
  moreItems:   { th: "รายการเพิ่มเติม", en: "more items", ja: "品追加", zh: "项更多", ko: "개 더" },
  total:       { th: "รวม", en: "Total", ja: "合計", zh: "总计", ko: "합계" },
};

const L = (key: string, lang: string) => labels[key]?.[lang] ?? labels[key]?.["en"] ?? key;

const playBeep = () => {
  try {
    const ctx = new AudioContext();
    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.18);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.2);
    });
  } catch {}
};

const GuestOrderTracker = () => {
  const navigate = useNavigate();
  const { guestId } = useGuestSession();
  const { language } = useLanguage();
  const { storeId, tableNumber } = useOrder();
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [billRequested, setBillRequested] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const ordersRef = useRef<TrackedOrder[]>([]);
  ordersRef.current = orders;

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
        const storeIds = [...new Set(data.map((o: any) => o.store_id))];
        const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds);
        const storeMap = new Map((stores || []).map((s: any) => [s.id, s.name]));
        setOrders(data.map((o: any) => ({ ...o, store_name: storeMap.get(o.store_id) || "" })));
      }
      setLoading(false);
    })();
  }, [guestId]);

  // Realtime
  useEffect(() => {
    if (!guestId) return;
    const channel = supabase
      .channel("guest-order-summary")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const updated = payload.new as any;
        if (updated.guest_id !== guestId) return;
        const old = ordersRef.current.find((o) => o.id === updated.id);
        const prev = old?.status;
        const next = updated.status;
        setOrders((prev) =>
          prev.map((o) => o.id === updated.id ? { ...o, status: next, rejection_reason: updated.rejection_reason } : o)
        );
        if (prev && prev !== next) {
          playBeep();
          if (next === "accepted") navigator.vibrate?.([80, 40, 80, 40, 80]);
          if (next === "served") navigator.vibrate?.([100, 60, 200]);
          toast({
            title: next === "accepted"
              ? `🍳 #${old?.order_number} ${L("cookMsg", language)}`
              : next === "served"
              ? `✅ #${old?.order_number} ${L("servedMsg", language)}`
              : next === "rejected"
              ? `❌ #${old?.order_number} ${L("rejected", language)}`
              : "",
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [guestId, language]);

  const handleRequestBill = async () => {
    if (!storeId || requestingBill) return;
    setRequestingBill(true);
    try {
      await supabase.from("bill_requests" as any).insert({
        store_id: storeId,
        table_number: tableNumber || 0,
        guest_id: guestId,
        total_amount: orders.reduce((s, o) => s + Number(o.total_price), 0),
      } as any);
      setBillRequested(true);
      navigator.vibrate?.([50, 30, 80]);
      supabase.functions.invoke("send-push", {
        body: {
          store_id: storeId,
          title: `💰 เรียกเก็บเงิน${tableNumber ? ` โต๊ะ ${tableNumber}` : ""}`,
          body: `฿${orders.reduce((s, o) => s + Number(o.total_price), 0).toLocaleString()}`,
          url: `/kitchen/${storeId}`,
          tag: `bill-request-${Date.now()}`,
        },
      }).catch(() => {});
      toast({ title: `💰 ${L("billSent", language)}` });
    } catch {}
    setRequestingBill(false);
  };

  const handleCallWaiter = async () => {
    if (!storeId || callingWaiter) return;
    setCallingWaiter(true);
    navigator.vibrate?.([50, 30, 50]);
    supabase.functions.invoke("send-push", {
      body: {
        store_id: storeId,
        title: `🔔 เรียกพนักงาน${tableNumber ? ` โต๊ะ ${tableNumber}` : ""}`,
        body: language === "th" ? "ลูกค้าเรียกพนักงาน" : "Customer called for staff",
        url: `/kitchen/${storeId}`,
        tag: `call-waiter-${Date.now()}`,
      },
    }).catch(() => {});
    toast({ title: `🔔 ${L("callWaiter", language)}` });
    setTimeout(() => setCallingWaiter(false), 3000);
  };

  const activeOrders = orders.filter((o) => ["pending", "accepted"].includes(o.status));
  const pastOrders = orders.filter((o) => ["served", "rejected"].includes(o.status));
  const hasActive = activeOrders.length > 0;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-36">
        {/* Header */}
        <div className="sticky top-0 z-30 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              <ChevronLeft size={18} className="text-foreground" />
            </motion.button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-foreground">{L("title", language)}</h1>
              {tableNumber && (
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {L("table", language)} {tableNumber}
                </p>
              )}
            </div>
            {tableNumber && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCallWaiter}
                disabled={callingWaiter}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold disabled:opacity-50"
              >
                <BellRing size={14} />
                {L("callWaiter", language)}
              </motion.button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="px-4 pt-6 space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-secondary animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 pt-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Utensils size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{L("noOrders", language)}</p>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-5">
            {/* Active orders */}
            {hasActive && (
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-1">
                  {L("active", language)}
                </p>
                <AnimatePresence>
                  {activeOrders.map((order) => (
                    <ActiveOrderCard key={order.id} order={order} language={language} />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Past orders */}
            {pastOrders.length > 0 && (
              <div className="space-y-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-1">
                  {L("past", language)}
                </p>
                {pastOrders.map((order) => (
                  <PastOrderCard key={order.id} order={order} language={language} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {orders.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-8 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent">
            <div className="flex gap-2">
              {storeId && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(`/store/${storeId}/order`)}
                  className="flex-1 py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 shadow-luxury"
                >
                  <Plus size={16} />
                  {L("orderMore", language)}
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleRequestBill}
                disabled={requestingBill || billRequested}
                className={`flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                  billRequested
                    ? "bg-secondary text-muted-foreground"
                    : "bg-amber-500 text-white shadow-lg"
                }`}
              >
                <Receipt size={16} />
                {billRequested ? L("billSent", language) : L("requestBill", language)}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

/* ── Active order card with status steps ── */
const ActiveOrderCard = ({ order, language }: { order: TrackedOrder; language: string }) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const stepIdx = STATUS_STEPS.indexOf(order.status as any);

  const stepLabel = [L("pending", language), L("accepted", language), L("served", language)];
  const stepIcon = [
    <Clock size={14} />, <ChefHat size={14} />, <UtensilsCrossed size={14} />,
  ];

  const statusMsg: Record<string, string> = {
    pending: L("waitMsg", language),
    accepted: L("cookMsg", language),
    served: L("servedMsg", language),
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
          {order.store_name && <span className="text-xs text-muted-foreground">· {order.store_name}</span>}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(order.created_at), {
            addSuffix: true,
            locale: localeMap[language] || enUS,
          })}
        </span>
      </div>

      {/* Status steps */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= stepIdx;
            const active = i === stepIdx;
            return (
              <div key={step} className="flex-1 flex flex-col items-center gap-1 relative">
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`absolute top-[14px] left-1/2 w-full h-0.5 transition-colors duration-500 ${i < stepIdx ? "bg-score-emerald" : "bg-border"}`} />
                )}
                <motion.div
                  animate={active ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ repeat: active ? Infinity : 0, duration: 1.5 }}
                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-500 ${
                    done ? "bg-score-emerald text-white" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {stepIcon[i]}
                </motion.div>
                <span className={`text-[9px] font-semibold text-center transition-colors duration-300 ${done ? "text-score-emerald" : "text-muted-foreground"}`}>
                  {stepLabel[i]}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status message */}
        <AnimatePresence mode="wait">
          <motion.div
            key={order.status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 ${
              order.status === "accepted" ? "bg-blue-500/10" :
              order.status === "served"   ? "bg-score-emerald/10" : "bg-amber-500/10"
            }`}
          >
            <motion.span
              animate={order.status === "pending" ? { scale: [1, 1.2, 1] } : order.status === "accepted" ? { rotate: [0, 10, -10, 0] } : {}}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              {order.status === "pending" ? "⏳" : order.status === "accepted" ? "🍳" : "✅"}
            </motion.span>
            <span className={`text-xs font-medium ${
              order.status === "accepted" ? "text-blue-600 dark:text-blue-400" :
              order.status === "served"   ? "text-score-emerald" : "text-amber-600 dark:text-amber-400"
            }`}>
              {statusMsg[order.status]}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Items */}
      <div className="px-4 pb-3 space-y-1.5">
        {items.slice(0, 5).map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-foreground/80">{item.quantity}× {item.name}</span>
            <span className="text-muted-foreground font-medium">฿{(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-[10px] text-muted-foreground">+{items.length - 5} {L("moreItems", language)}</p>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-secondary/30">
        <span className="text-xs text-muted-foreground">{L("total", language)}</span>
        <span className="text-sm font-bold text-foreground">฿{Number(order.total_price).toLocaleString()}</span>
      </div>
    </motion.div>
  );
};

/* ── Past order card ── */
const PastOrderCard = ({ order, language }: { order: TrackedOrder; language: string }) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const served = order.status === "served";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
          {order.store_name && <span className="text-xs text-muted-foreground">· {order.store_name}</span>}
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
          served ? "bg-score-emerald/10 text-score-emerald" : "bg-destructive/10 text-destructive"
        }`}>
          {served ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {served ? L("served", language) : L("rejected", language)}
        </div>
      </div>

      {order.status === "rejected" && order.rejection_reason && (
        <div className="px-4 pb-2">
          <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-xl">{order.rejection_reason}</p>
        </div>
      )}

      <div className="px-4 pb-3 space-y-1">
        {items.slice(0, 3).map((item: any, i: number) => (
          <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{item.quantity}× {item.name}</span>
            <span>฿{(item.price * item.quantity).toLocaleString()}</span>
          </div>
        ))}
        {items.length > 3 && <p className="text-[10px] text-muted-foreground">+{items.length - 3} {L("moreItems", language)}</p>}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: localeMap[language] || enUS })}
        </span>
        <span className="text-sm font-bold text-foreground">฿{Number(order.total_price).toLocaleString()}</span>
      </div>
    </motion.div>
  );
};

export default GuestOrderTracker;
