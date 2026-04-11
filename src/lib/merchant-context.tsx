import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language-context";

export interface MerchantStore {
  id: string;
  name: string;
  category_id: string | null;
  verified: boolean;
  logo_url: string | null;
  role: "owner" | "manager" | "staff";
}

interface MerchantContextType {
  stores: MerchantStore[];
  activeStore: MerchantStore | null;
  setActiveStoreId: (id: string) => void;
  loading: boolean;
  refetch: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
}

// Shared AudioContext — created once on first user gesture to avoid autoplay block
let _audioCtx: AudioContext | null = null;

const getAudioCtx = (): AudioContext | null => {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (_audioCtx.state === "suspended") {
      _audioCtx.resume();
    }
    return _audioCtx;
  } catch {
    return null;
  }
};

// Unlock AudioContext on first touch/click
if (typeof window !== "undefined") {
  const unlock = () => { getAudioCtx(); document.removeEventListener("touchstart", unlock); document.removeEventListener("click", unlock); };
  document.addEventListener("touchstart", unlock, { once: true });
  document.addEventListener("click", unlock, { once: true });
}

const playOrderBeep = () => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.5, ctx.currentTime + start);
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

const MerchantContext = createContext<MerchantContextType | null>(null);

export const MerchantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { language: _language } = useLanguage();
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    try { return localStorage.getItem("merchant-sound") !== "false"; } catch { return true; }
  });
  const initialLoadDone = useRef(false);

  const setSoundEnabled = (v: boolean) => {
    setSoundEnabledState(v);
    try { localStorage.setItem("merchant-sound", String(v)); } catch {}
  };

  const fetchStores = async () => {
    if (!user) {
      setStores([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1) Stores owned by user
    const { data: owned } = await supabase
      .from("stores")
      .select("id, name, category_id, verified, logo_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const ownedStores: MerchantStore[] = (owned || []).map((s) => ({
      ...s,
      role: "owner" as const,
    }));

    // 2) Stores where user is a member
    const { data: memberships } = await supabase
      .from("store_members")
      .select("store_id, role")
      .eq("user_id", user.id);

    let memberStores: MerchantStore[] = [];
    if (memberships && memberships.length > 0) {
      const memberStoreIds = memberships
        .map((m) => m.store_id)
        .filter((id) => !ownedStores.some((o) => o.id === id));

      if (memberStoreIds.length > 0) {
        const { data: mStores } = await supabase
          .from("stores")
          .select("id, name, category_id, verified, logo_url")
          .in("id", memberStoreIds);

        memberStores = (mStores || []).map((s) => ({
          ...s,
          role: (memberships.find((m) => m.store_id === s.id)?.role || "staff") as MerchantStore["role"],
        }));
      }
    }

    const allStores = [...ownedStores, ...memberStores];
    setStores(allStores);
    if (allStores.length > 0 && !activeStoreId) {
      setActiveStoreId(allStores[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStores();
  }, [user]);

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;

  // Global order sound notification for all merchant pages
  useEffect(() => {
    if (!activeStore) return;
    initialLoadDone.current = false;
    const timer = setTimeout(() => { initialLoadDone.current = true; }, 2000);

    const channel = supabase
      .channel(`global-orders-${activeStore.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${activeStore.id}` },
        (payload) => {
          if (!initialLoadDone.current) return;
          const order = payload.new as any;
          if (order.status === "pending" && soundEnabled) {
            playOrderBeep();
            navigator.vibrate?.([100, 50, 100, 50, 200]);
          }
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [activeStore?.id, soundEnabled]);

  return (
    <MerchantContext.Provider value={{ stores, activeStore, setActiveStoreId, loading, refetch: fetchStores, soundEnabled, setSoundEnabled }}>
      {children}
    </MerchantContext.Provider>
  );
};

export const useMerchant = () => {
  const ctx = useContext(MerchantContext);
  if (!ctx) throw new Error("useMerchant must be used within MerchantProvider");
  return ctx;
};
