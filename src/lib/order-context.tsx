import { createContext, useContext, useState, type ReactNode } from "react";

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  type: string;
  note?: string;
  selectedOptions?: {
    noodleType?: string;
    noodleTypePrice?: number;
    noodleStyle?: string;
    noodleStylePrice?: number;
    toppings?: string[];
    size?: "ธรรมดา" | "พิเศษ";
    addOns?: string[];
  };
}

interface OrderContextType {
  items: OrderItem[];
  storeId: string | null;
  storeName: string | null;
  addItem: (item: OrderItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateItemNote: (menuItemId: string, note: string) => void;
  clearOrder: () => void;
  setOrderStore: (id: string, name: string) => void;
  totalItems: number;
  totalPrice: number;
}

const OrderContext = createContext<OrderContextType | null>(null);

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  const addItem = (item: OrderItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.menuItemId);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === item.menuItemId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (menuItemId: string) => {
    setItems((prev) => prev.filter((i) => i.menuItemId !== menuItemId));
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i))
    );
  };

  const updateItemNote = (menuItemId: string, note: string) => {
    setItems((prev) =>
      prev.map((i) => (i.menuItemId === menuItemId ? { ...i, note } : i))
    );
  };

  const clearOrder = () => {
    setItems([]);
    setStoreId(null);
    setStoreName(null);
  };

  const setOrderStore = (id: string, name: string) => {
    if (storeId && storeId !== id) {
      setItems([]);
    }
    setStoreId(id);
    setStoreName(name);
  };

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <OrderContext.Provider
      value={{
        items,
        storeId,
        storeName,
        addItem,
        removeItem,
        updateQuantity,
        clearOrder,
        setOrderStore,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export const useOrder = () => {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrder must be used within OrderProvider");
  return ctx;
};
