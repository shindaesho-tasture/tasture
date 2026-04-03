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
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    playTone(880, 0, 0.15);
    playTone(1100, 0.18, 0.15);
    playTone(1320, 0.36, 0.25);
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
          if (soundEnabled) playAlertSound();
          sendBrowserNotification(
            `🔔 ${isTh ? "ออเดอร์ใหม่" : "New order"} #${order.order_number}`,
            `฿${Number(order.total_price || 0).toLocaleString()}`,
            `order-${order.order_number}`
          );
          onNewOrder?.(order);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "waiter_calls", filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (!initialLoadDone.current) return;
          const call = payload.new as any;
          if (soundEnabled) playAlertSound();
          sendBrowserNotification(
            `🙋 ${isTh ? "เรียกพนักงาน" : "Waiter call"}`,
            `${isTh ? "โต๊ะ" : "Table"} ${call.table_number}`,
            `waiter-${call.id}`
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bill_requests", filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (!initialLoadDone.current) return;
          const bill = payload.new as any;
          if (soundEnabled) playAlertSound();
          sendBrowserNotification(
            `💰 ${isTh ? "เรียกเก็บเงิน" : "Bill request"}`,
            `${isTh ? "โต๊ะ" : "Table"} ${bill.table_number} — ฿${Number(bill.total_amount || 0).toLocaleString()}`,
            `bill-${bill.id}`
          );
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
