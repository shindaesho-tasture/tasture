import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BHIK3u2ro1weGCDJLw9GxnGckG9hLpWFS-dcuN5bKdyr0Pcdq5d3uF6lhtF9klibVMyNiMygeM0C91DR7eX-Y6A";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const usePushNotifications = (storeId: string | null, userId: string | null) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported && storeId && userId) checkSubscription();
  }, [storeId, userId]);

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (!reg) { setIsSubscribed(false); return; }
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!storeId || !userId || loading) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setLoading(false);
        return false;
      }

      const reg = await navigator.serviceWorker.register("/sw-push.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();
      await supabase.from("push_subscriptions" as any).upsert({
        user_id: userId,
        store_id: storeId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh || "",
        auth: json.keys?.auth || "",
      } as any, { onConflict: "user_id,store_id,endpoint" });

      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [storeId, userId, loading]);

  const unsubscribe = useCallback(async () => {
    if (!storeId || !userId) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await supabase.from("push_subscriptions" as any).delete().eq("user_id", userId).eq("store_id", storeId).eq("endpoint", sub.endpoint);
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  }, [storeId, userId]);

  return { isSubscribed, isSupported, loading, subscribe, unsubscribe };
};
