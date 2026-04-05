import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { toast } from "sonner";

/**
 * Shared hook for merchant pages:
 * 1. Auto-subscribes to push notifications
 * 2. Plays alert sound + browser notification on new orders/waiter calls/bill requests
 * 3. Can be used on ANY merchant page — sound works globally
 */

let sharedAudioCtx: AudioContext | null = null;

// Module-level dedup: tracks recently-notified event IDs to prevent double-firing
// when both the global provider and a page-level subscription receive the same INSERT.
const notifiedIds = new Set<string>();
const markNotified = (id: string) => {
  notifiedIds.add(id);
  setTimeout(() => notifiedIds.delete(id), 5000);
};
const alreadyNotified = (id: string) => notifiedIds.has(id);
const getAudioCtx = (): AudioContext => {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioCtx;
};

const unlockAudio = () => {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();
  } catch {}
};

const playAlertSound = () => {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(1.0, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    // Play 3 rounds of the alert for better attention
    for (let round = 0; round < 3; round++) {
      const offset = round * 0.65;
      playTone(880,  offset + 0,    0.15);
      playTone(1100, offset + 0.18, 0.15);
      playTone(1320, offset + 0.36, 0.20);
    }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
  } catch {}
};

const sendBrowserNotification = (title: string, body: string, tag: string) => {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/placeholder.svg", tag });
  } catch {}
};

interface UseMerchantNotificationsOptions {
  storeId: string | null;
  userId: string | null;
  /** Set false to disable sound (e.g. if the page has its own sound system) */
  soundEnabled?: boolean;
  /** Called when a new order arrives */
  onNewOrder?: (order: any) => void;
  language?: string;
}

export const useMerchantNotifications = ({
  storeId,
  userId,
  soundEnabled = true,
  onNewOrder,
  language = "th",
}: UseMerchantNotificationsOptions) => {
  const isTh = language === "th";
  const initialLoadDone = useRef(false);

  // Push notification subscription — auto-subscribes
  const {
    isSubscribed: pushSubscribed,
    isSupported: pushSupported,
    loading: pushLoading,
    subscribe: pushSubscribe,
  } = usePushNotifications(storeId, userId);

  // Unlock audio on first interaction
  useEffect(() => {
    const handler = () => unlockAudio();
    document.addEventListener("pointerdown", handler, { once: true });
    document.addEventListener("keydown", handler, { once: true });
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, []);

  // Auto-subscribe to push when permission granted
  useEffect(() => {
    if (
      pushSupported &&
      !pushSubscribed &&
      !pushLoading &&
      storeId &&
      userId &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      pushSubscribe();
    }
  }, [pushSupported, pushSubscribed, pushLoading, storeId, userId]);

  // Mark initial load done after a small delay
  useEffect(() => {
    if (!storeId) return;
    const timer = setTimeout(() => {
      initialLoadDone.current = true;
    }, 3000);
    return () => clearTimeout(timer);
  }, [storeId]);

  // Realtime listener for new orders, waiter calls, bill requests
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`merchant-global-notif-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (!initialLoadDone.current) return;
          const order = payload.new as any;
          const dedupKey = `order-${order.id}`;
          if (alreadyNotified(dedupKey)) return;
          markNotified(dedupKey);
          if (soundEnabled) playAlertSound();
          const orderTitle = `🔔 ${isTh ? "ออเดอร์ใหม่" : "New order"} #${order.order_number}`;
          const orderBody = `฿${Number(order.total_price || 0).toLocaleString()}`;
          sendBrowserNotification(orderTitle, orderBody, `order-${order.order_number}`);
          toast(orderTitle, { description: orderBody, duration: Infinity });
          onNewOrder?.(order);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waiter_calls", filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (!initialLoadDone.current) return;
          const call = payload.new as any;
          const dedupKey = `waiter-${call.id}`;
          if (alreadyNotified(dedupKey)) return;
          markNotified(dedupKey);
          if (soundEnabled) playAlertSound();
          const waiterTitle = `🙋 ${isTh ? "เรียกพนักงาน" : "Waiter call"}`;
          const waiterBody = `${isTh ? "โต๊ะ" : "Table"} ${call.table_number}`;
          sendBrowserNotification(waiterTitle, waiterBody, `waiter-${call.id}`);
          toast(waiterTitle, { description: waiterBody, duration: Infinity });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bill_requests", filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (!initialLoadDone.current) return;
          const bill = payload.new as any;
          const dedupKey = `bill-${bill.id}`;
          if (alreadyNotified(dedupKey)) return;
          markNotified(dedupKey);
          if (soundEnabled) playAlertSound();
          const billTitle = `💰 ${isTh ? "เรียกเก็บเงิน" : "Bill request"}`;
          const billBody = `${isTh ? "โต๊ะ" : "Table"} ${bill.table_number} — ฿${Number(bill.total_amount || 0).toLocaleString()}`;
          sendBrowserNotification(billTitle, billBody, `bill-${bill.id}`);
          toast(billTitle, { description: billBody, duration: Infinity });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, soundEnabled, isTh]);

  const requestPermissionAndSubscribe = useCallback(async () => {
    unlockAudio();
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === "granted" && pushSupported && !pushSubscribed) {
      await pushSubscribe();
    }
    return perm;
  }, [pushSupported, pushSubscribed, pushSubscribe]);

  return {
    pushSubscribed,
    pushSupported,
    pushLoading,
    requestPermissionAndSubscribe,
    unlockAudio,
  };
};
