import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft, Clock, ChefHat, UtensilsCrossed, CheckCircle2,
  XCircle, Receipt, Plus, BellRing,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/language-context";
import { useOrder } from "@/lib/order-context";
import PageTransition from "@/components/PageTransition";
import { formatDistanceToNow } from "date-fns";
import { th as thLocale, enUS, ja, zhCN, ko } from "date-fns/locale";

interface Order {
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
  notes?: string | null;
}

const localeMap: Record<string, any> = { th: thLocale, en: enUS, ja, zh: zhCN, ko };

const STATUS_STEPS = ["pending", "accepted", "served"] as const;

const L: Record<string, Record<string, string>> = {
  title:        { th: "สรุปออเดอร์", en: "Order Summary", ja: "注文概要", zh: "订单汇总", ko: "주문 요약" },
  table:        { th: "โต๊ะ", en: "Table", ja: "テーブル", zh: "桌号", ko: "테이블" },
  pending:      { th: "รอยืนยัน", en: "Waiting", ja: "確認待ち", zh: "等待确认", ko: "대기 중" },
  accepted:     { th: "กำลังทำ", en: "Preparing", ja: "調理中", zh: "制作中", ko: "준비 중" },
  served:       { th: "เสิร์ฟแล้ว", en: "Served", ja: "提供済み", zh: "已上菜", ko: "서빙 완료" },
  rejected:     { th: "ปฏิเสธ", en: "Rejected", ja: "拒否", zh: "已拒绝", ko: "거절됨" },
  waitMsg:      { th: "รอร้านยืนยันออเดอร์...", en: "Waiting for confirmation...", ja: "確認中...", zh: "等待确认中...", ko: "확인 대기 중..." },
  cookMsg:      { th: "ร้านกำลังทำอาหารของคุณ", en: "Your food is being prepared", ja: "料理中です", zh: "正在为您制作", ko: "음식 준비 중" },
  servedMsg:    { th: "🎉 อาหารพร้อมแล้ว!", en: "🎉 Your food is ready!", ja: "🎉 料理が届きました!", zh: "🎉 您的食物已上桌!", ko: "🎉 음식이 나왔어요!" },
  rejectedMsg:  { th: "ออเดอร์ถูกปฏิเสธ", en: "Order was rejected", ja: "注文が拒否されました", zh: "订单被拒绝", ko: "주문이 거절되었습니다" },
  orderMore:    { th: "สั่งเพิ่ม", en: "Order More", ja: "追加注文", zh: "继续点餐", ko: "추가 주문" },
  requestBill:  { th: "เรียกเก็บเงิน", en: "Request Bill", ja: "お会計", zh: "结账", ko: "계산서 요청" },
  billSent:     { th: "แจ้งพนักงานแล้ว", en: "Staff notified", ja: "スタッフに通知済み", zh: "已通知员工", ko: "직원 알림 완료" },
  callWaiter:   { th: "เรียกพนักงาน", en: "Call Waiter", ja: "店員を呼ぶ", zh: "呼叫服务员", ko: "웨이터 호출" },
  total:        { th: "รวม", en: "Total", ja: "合計", zh: "总计", ko: "합계" },
  items:        { th: "รายการ", en: "items", ja: "品", zh: "项", ko: "개" },
  notes:        { th: "หมายเหตุ", en: "Notes", ja: "メモ", zh: "备注", ko: "메모" },
  loading:      { th: "กำลังโหลด...", en: "Loading...", ja: "読み込み中...", zh: "加载中...", ko: "로딩 중..." },
  notFound:     { th: "ไม่พบออเดอร์", en: "Order not found", ja: "注文が見つかりません", zh: "未找到订单", ko: "주문을 찾을 수 없습니다" },
};

const t = (key: string, lang: string) => L[key]?.[lang] ?? L[key]?.["en"] ?? key;

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

const GuestOrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { storeId } = useOrder();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [billRequested, setBillRequested] = useState(false);
  const [requestingBill, setRequestingBill] = useState(false);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const orderRef = useRef<Order | null>(null);
  orderRef.current = order;

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, items, total_price, table_number, created_at, rejection_reason, store_id, notes")
        .eq("id", orderId)
        .single();

      if (data) {
        const { data: store } = await supabase.from("stores").select("name").eq("id", data.store_id).single();
        setOrder({ ...data as any, store_name: store?.name || "" });
      }
      setLoading(false);
    })();
  }, [orderId]);

  // Realtime status updates
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-detail-${orderId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const updated = payload.new as any;
          const prev = orderRef.current?.status;
          const next = updated.status;
          setOrder((o) => o ? { ...o, status: next, rejection_reason: updated.rejection_reason } : o);
          if (prev && prev !== next) {
            playBeep();
            if (next === "accepted") navigator.vibrate?.([80, 40, 80, 40, 80]);
            if (next === "served") navigator.vibrate?.([100, 60, 200]);
            toast({
              title: next === "accepted" ? `🍳 ${t("cookMsg", language)}`
                   : next === "served"   ? t("servedMsg", language)
                   : next === "rejected" ? `❌ ${t("rejectedMsg", language)}`
                   : "",
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, language]);

  const handleRequestBill = async () => {
    if (!order || requestingBill) return;
    setRequestingBill(true);
    try {
      await supabase.from("bill_requests" as any).insert({
        store_id: order.store_id,
        table_number: order.table_number || 0,
        total_amount: Number(order.total_price),
      } as any);
      setBillRequested(true);
      navigator.vibrate?.([50, 30, 80]);
      supabase.functions.invoke("send-push", {
        body: {
          store_id: order.store_id,
          title: `💰 เรียกเก็บเงิน${order.table_number ? ` โต๊ะ ${order.table_number}` : ""}`,
          body: `฿${Number(order.total_price).toLocaleString()}`,
          url: `/kitchen/${order.store_id}`,
          tag: `bill-${Date.now()}`,
        },
      }).catch(() => {});
      toast({ title: `💰 ${t("billSent", language)}` });
    } catch {}
    setRequestingBill(false);
  };

  const handleCallWaiter = async () => {
    if (!order || callingWaiter) return;
    setCallingWaiter(true);
    navigator.vibrate?.([50, 30, 50]);
    supabase.functions.invoke("send-push", {
      body: {
        store_id: order.store_id,
        title: `🔔 เรียกพนักงาน${order.table_number ? ` โต๊ะ ${order.table_number}` : ""}`,
        body: language === "th" ? "ลูกค้าเรียกพนักงาน" : "Customer called for staff",
        url: `/kitchen/${order.store_id}`,
        tag: `waiter-${Date.now()}`,
      },
    }).catch(() => {});
    toast({ title: `🔔 ${t("callWaiter", language)}` });
    setTimeout(() => setCallingWaiter(false), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">{t("notFound", language)}</p>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const stepIdx = STATUS_STEPS.indexOf(order.status as any);
  const isRejected = order.status === "rejected";
  const isDone = order.status === "served" || isRejected;
  const activeStoreId = order.store_id || storeId;

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
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-foreground">
                {t("title", language)} #{order.order_number}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {order.store_name}{order.table_number ? ` · ${t("table", language)} ${order.table_number}` : ""}
              </p>
            </div>
            {order.table_number && !isDone && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCallWaiter}
                disabled={callingWaiter}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold disabled:opacity-50"
              >
                <BellRing size={14} />
                {t("callWaiter", language)}
              </motion.button>
            )}
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Status steps */}
          {!isRejected && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                {STATUS_STEPS.map((step, i) => {
                  const done = i <= stepIdx;
                  const active = i === stepIdx;
                  const icons = [<Clock size={14} />, <ChefHat size={14} />, <UtensilsCrossed size={14} />];
                  return (
                    <div key={step} className="flex-1 flex flex-col items-center gap-1 relative">
                      {i < STATUS_STEPS.length - 1 && (
                        <div className={`absolute top-[14px] left-1/2 w-full h-0.5 transition-colors duration-700 ${i < stepIdx ? "bg-score-emerald" : "bg-border"}`} />
                      )}
                      <motion.div
                        animate={active ? { scale: [1, 1.15, 1] } : {}}
                        transition={{ repeat: active ? Infinity : 0, duration: 1.5 }}
                        className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-500 ${done ? "bg-score-emerald text-white" : "bg-secondary text-muted-foreground"}`}
                      >
                        {icons[i]}
                      </motion.div>
                      <span className={`text-[9px] font-semibold text-center transition-colors duration-300 ${done ? "text-score-emerald" : "text-muted-foreground"}`}>
                        {t(step, language)}
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
                  exit={{ opacity: 0 }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${
                    order.status === "accepted" ? "bg-blue-500/10" :
                    order.status === "served"   ? "bg-score-emerald/10" : "bg-amber-500/10"
                  }`}
                >
                  <motion.span
                    animate={
                      order.status === "pending"  ? { scale: [1, 1.2, 1] } :
                      order.status === "accepted" ? { rotate: [0, 10, -10, 0] } : {}
                    }
                    transition={{ repeat: Infinity, duration: 1.2 }}
                  >
                    {order.status === "pending" ? "⏳" : order.status === "accepted" ? "🍳" : "✅"}
                  </motion.span>
                  <span className={`text-xs font-medium ${
                    order.status === "accepted" ? "text-blue-600 dark:text-blue-400" :
                    order.status === "served"   ? "text-score-emerald" : "text-amber-600 dark:text-amber-400"
                  }`}>
                    {order.status === "pending" ? t("waitMsg", language) :
                     order.status === "accepted" ? t("cookMsg", language) :
                     t("servedMsg", language)}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Rejected */}
          {isRejected && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <XCircle size={20} className="text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-destructive">{t("rejectedMsg", language)}</p>
                {order.rejection_reason && <p className="text-xs text-destructive/70 mt-1">{order.rejection_reason}</p>}
              </div>
            </div>
          )}

          {/* Order items */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                {items.length} {t("items", language)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(order.created_at), {
                  addSuffix: true,
                  locale: localeMap[language] || enUS,
                })}
              </span>
            </div>

            <div className="divide-y divide-border/30">
              {items.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium">
                      <span className="text-muted-foreground mr-1">{item.quantity}×</span>
                      {language !== "th" && item.nameTranslations?.[language]
                        ? item.nameTranslations[language]
                        : item.name}
                    </p>
                    {language !== "th" && item.nameTranslations?.[language] && (
                      <p className="text-[10px] text-muted-foreground">{item.name}</p>
                    )}
                    {item.note && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">📝 {item.note}</p>
                    )}
                    {(item.selectedOptions?.noodleType || item.selectedOptions?.noodleStyle || item.selectedOptions?.toppings?.length > 0 || item.selectedOptions?.addOns?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {item.selectedOptions?.noodleType && (
                          <span className="text-[9px] text-muted-foreground">
                            🍜 {item.optionTranslations?.noodleTypeTranslations?.[item.selectedOptions.noodleType]?.[language] || item.selectedOptions.noodleType}
                          </span>
                        )}
                        {item.selectedOptions?.noodleStyle && (
                          <span className="text-[9px] text-muted-foreground">
                            🍲 {item.optionTranslations?.noodleStyleTranslations?.[item.selectedOptions.noodleStyle]?.[language] || item.selectedOptions.noodleStyle}
                          </span>
                        )}
                        {item.selectedOptions?.toppings?.map((tp: string) => (
                          <span key={tp} className="text-[9px] text-muted-foreground">
                            + {item.optionTranslations?.toppingTranslations?.[tp]?.[language] || tp}
                          </span>
                        ))}
                        {item.selectedOptions?.addOns?.map((ao: string) => (
                          <span key={ao} className="text-[9px] text-muted-foreground">+ {ao}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-foreground ml-3">
                    ฿{(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="px-4 py-3 border-t border-border/30 bg-secondary/20">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">{t("notes", language)}</p>
                <p className="text-xs text-foreground">{order.notes}</p>
              </div>
            )}

            {/* Total */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
              <span className="text-sm font-bold text-muted-foreground">{t("total", language)}</span>
              <span className="text-xl font-bold text-foreground">฿{Number(order.total_price).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Bottom action buttons */}
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-8 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="flex gap-2">
            {activeStoreId && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate(`/store/${activeStoreId}/order`)}
                className="flex-1 py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 shadow-luxury"
              >
                <Plus size={16} />
                {t("orderMore", language)}
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleRequestBill}
              disabled={requestingBill || billRequested}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                billRequested ? "bg-secondary text-muted-foreground" : "bg-amber-500 text-white shadow-lg"
              }`}
            >
              <Receipt size={16} />
              {billRequested ? t("billSent", language) : t("requestBill", language)}
            </motion.button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default GuestOrderDetail;
