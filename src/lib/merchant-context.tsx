import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface MerchantStore {
  id: string;
  name: string;
  category_id: string | null;
  verified: boolean;
  logo_url: string | null;
}

interface MerchantContextType {
  stores: MerchantStore[];
  activeStore: MerchantStore | null;
  setActiveStoreId: (id: string) => void;
  loading: boolean;
}

const MerchantContext = createContext<MerchantContextType | null>(null);

export const MerchantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [stores, setStores] = useState<MerchantStore[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStores([]);
      setLoading(false);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("stores")
        .select("id, name, category_id, verified, logo_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const list = data || [];
      setStores(list);
      if (list.length > 0 && !activeStoreId) {
        setActiveStoreId(list[0].id);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const activeStore = stores.find((s) => s.id === activeStoreId) || stores[0] || null;

  return (
    <MerchantContext.Provider value={{ stores, activeStore, setActiveStoreId, loading }}>
      {children}
    </MerchantContext.Provider>
  );
};

export const useMerchant = () => {
  const ctx = useContext(MerchantContext);
  if (!ctx) throw new Error("useMerchant must be used within MerchantProvider");
  return ctx;
};
