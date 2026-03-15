import { createContext, useContext, useState, type ReactNode } from "react";

export interface StoreData {
  name: string;
  pinLocation: { lat: number; lng: number } | null;
  menuPhoto: string | null; // base64 data URL
  categoryId: string | null;
}

interface StoreContextType {
  store: StoreData;
  setStore: (data: Partial<StoreData>) => void;
  resetStore: () => void;
}

const defaultStore: StoreData = {
  name: "",
  pinLocation: null,
  menuPhoto: null,
  categoryId: null,
};

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [store, setStoreState] = useState<StoreData>(defaultStore);

  const setStore = (data: Partial<StoreData>) => {
    setStoreState((prev) => ({ ...prev, ...data }));
  };

  const resetStore = () => setStoreState(defaultStore);

  return (
    <StoreContext.Provider value={{ store, setStore, resetStore }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
};
