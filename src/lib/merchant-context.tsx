import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
}

const MerchantContext = createContext<MerchantContextType | null>(null);

export const MerchantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <MerchantContext.Provider value={{ stores, activeStore, setActiveStoreId, loading, refetch: fetchStores }}>
      {children}
    </MerchantContext.Provider>
  );
};

export const useMerchant = () => {
  const ctx = useContext(MerchantContext);
  if (!ctx) throw new Error("useMerchant must be used within MerchantProvider");
  return ctx;
};
