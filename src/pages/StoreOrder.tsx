import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ShoppingBag, Plus, Minus, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrder } from "@/lib/order-context";
import PageTransition from "@/components/PageTransition";

interface MenuItemRow {
  id: string;
  name: string;
  price: number;
  price_special: number | null;
  type: string;
  noodle_types: string[] | null;
  noodle_styles: string[] | null;
  toppings: string[] | null;
}

interface DnaTag {
  component_icon: string;
  component_name: string;
  selected_tag: string;
  selected_score: number;
  count: number;
}

const StoreOrder = () => {
  const navigate = useNavigate();
  const { storeId } = useParams<{ storeId: string }>();
  const { items, addItem, updateQuantity, removeItem, setOrderStore, totalItems, totalPrice } = useOrder();
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [dnaByItem, setDnaByItem] = useState<Map<string, DnaTag[]>>(new Map());

  // Noodle options popup state
  const [optionsItem, setOptionsItem] = useState<MenuItemRow | null>(null);
  const [selectedNoodleType, setSelectedNoodleType] = useState<string>("");
  const [selectedNoodleStyle, setSelectedNoodleStyle] = useState<string>("");
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);

  useEffect(() => {
    if (!storeId) return;
    fetchData();
  }, [storeId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storeRes, menuRes] = await Promise.all([
        supabase.from("stores").select("name").eq("id", storeId!).single(),
        supabase
          .from("menu_items")
          .select("id, name, price, price_special, type, noodle_types, noodle_styles, toppings")
          .eq("store_id", storeId!)
          .order("name"),
      ]);

      if (storeRes.data) {
        setStoreName(storeRes.data.name);
        setOrderStore(storeId!, storeRes.data.name);
      }
      setMenuItems(menuRes.data || []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const getItemQuantity = (menuItemId: string) => {
    return items.find((i) => i.menuItemId === menuItemId)?.quantity || 0;
  };

  const hasOptions = (item: MenuItemRow) => {
    return (
      (item.noodle_types && item.noodle_types.length > 0) ||
      (item.noodle_styles && item.noodle_styles.length > 0) ||
      (item.toppings && item.toppings.length > 0)
    );
  };

  const openOptionsPopup = (item: MenuItemRow) => {
    setOptionsItem(item);
    setSelectedNoodleType(item.noodle_types?.[0] || "");
    setSelectedNoodleStyle(item.noodle_styles?.[0] || "");
    setSelectedToppings([]);
  };

  const handleAddWithOptions = () => {
    if (!optionsItem) return;
    addItem({
      menuItemId: optionsItem.id,
      name: optionsItem.name,
      price: optionsItem.price,
      quantity: 1,
      type: optionsItem.type,
      selectedOptions: {
        noodleType: selectedNoodleType || undefined,
        noodleStyle: selectedNoodleStyle || undefined,
        toppings: selectedToppings.length > 0 ? selectedToppings : undefined,
      },
    });
    setOptionsItem(null);
  };

  const handleAddSimple = (item: MenuItemRow) => {
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      type: item.type,
    });
  };

  const handleMinus = (menuItemId: string) => {
    const qty = getItemQuantity(menuItemId);
    if (qty <= 1) {
      removeItem(menuItemId);
    } else {
      updateQuantity(menuItemId, qty - 1);
    }
  };

  const toggleTopping = (t: string) => {
    setSelectedToppings((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const typeEmoji: Record<string, string> = {
    noodle: "🍜",
    dual_price: "💰",
    standard: "🍽️",
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-32">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate("/store-list")}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground truncate">
                {storeName || "เมนู"}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                เลือกเมนูสั่งอาหาร
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
              <span className="text-xs text-muted-foreground">กำลังโหลดเมนู...</span>
            </div>
          ) : menuItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-sm text-muted-foreground">ยังไม่มีเมนูในร้านนี้</p>
            </div>
          ) : (
            <AnimatePresence>
              {menuItems.map((item, i) => {
                const qty = getItemQuantity(item.id);
                const orderItem = items.find((oi) => oi.menuItemId === item.id);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.35 }}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      qty > 0
                        ? "bg-score-emerald/5 border-score-emerald/30 shadow-md"
                        : "bg-surface-elevated border-border/50 shadow-luxury"
                    }`}
                  >
                    <div className="px-4 py-3 flex items-center gap-3">
                      <span className="text-xl flex-shrink-0">
                        {typeEmoji[item.type] || "🍽️"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-score-emerald">
                            ฿{item.price}
                          </span>
                          {item.price_special && (
                            <span className="text-[10px] text-muted-foreground">
                              พิเศษ ฿{item.price_special}
                            </span>
                          )}
                        </div>
                        {/* Show selected options */}
                        {orderItem?.selectedOptions && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {orderItem.selectedOptions.noodleType && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
                                {orderItem.selectedOptions.noodleType}
                              </span>
                            )}
                            {orderItem.selectedOptions.noodleStyle && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
                                {orderItem.selectedOptions.noodleStyle}
                              </span>
                            )}
                            {orderItem.selectedOptions.toppings?.map((t) => (
                              <span
                                key={t}
                                className="text-[9px] px-1.5 py-0.5 rounded-md bg-score-emerald/10 text-score-emerald"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quantity controls */}
                      {qty === 0 ? (
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() =>
                            hasOptions(item) ? openOptionsPopup(item) : handleAddSimple(item)
                          }
                          className="w-9 h-9 rounded-xl bg-score-emerald flex items-center justify-center shadow-sm"
                        >
                          <Plus size={16} strokeWidth={2.5} className="text-primary-foreground" />
                        </motion.button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => handleMinus(item.id)}
                            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
                          >
                            <Minus size={14} strokeWidth={2} className="text-foreground" />
                          </motion.button>
                          <span className="text-sm font-bold text-foreground w-5 text-center">
                            {qty}
                          </span>
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() =>
                              hasOptions(item) ? openOptionsPopup(item) : handleAddSimple(item)
                            }
                            className="w-8 h-8 rounded-lg bg-score-emerald flex items-center justify-center"
                          >
                            <Plus size={14} strokeWidth={2} className="text-primary-foreground" />
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Options Popup */}
        <AnimatePresence>
          {optionsItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-foreground/40 flex items-end justify-center"
              onClick={() => setOptionsItem(null)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 380, damping: 34 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-background rounded-t-3xl shadow-luxury overflow-hidden"
              >
                {/* Popup Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground">{optionsItem.name}</h3>
                    <p className="text-xs text-score-emerald font-semibold mt-0.5">
                      ฿{optionsItem.price}
                    </p>
                  </div>
                  <button
                    onClick={() => setOptionsItem(null)}
                    className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
                  >
                    <X size={16} strokeWidth={2} className="text-muted-foreground" />
                  </button>
                </div>

                <div className="px-5 pb-6 space-y-5 max-h-[60vh] overflow-y-auto">
                  {/* Noodle Types */}
                  {optionsItem.noodle_types && optionsItem.noodle_types.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🍜 เลือกเส้น
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.noodle_types.map((nt) => (
                          <motion.button
                            key={nt}
                            whileTap={{ scale: 0.93 }}
                            onClick={() => setSelectedNoodleType(nt)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                              selectedNoodleType === nt
                                ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                                : "bg-surface-elevated text-foreground border-border/50"
                            }`}
                          >
                            {nt}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Noodle Styles */}
                  {optionsItem.noodle_styles && optionsItem.noodle_styles.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🍲 เลือกแบบ
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.noodle_styles.map((ns) => (
                          <motion.button
                            key={ns}
                            whileTap={{ scale: 0.93 }}
                            onClick={() => setSelectedNoodleStyle(ns)}
                            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                              selectedNoodleStyle === ns
                                ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                                : "bg-surface-elevated text-foreground border-border/50"
                            }`}
                          >
                            {ns}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Toppings */}
                  {optionsItem.toppings && optionsItem.toppings.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        🥩 เลือกท็อปปิ้ง (เลือกได้หลายอย่าง)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {optionsItem.toppings.map((t) => {
                          const selected = selectedToppings.includes(t);
                          return (
                            <motion.button
                              key={t}
                              whileTap={{ scale: 0.93 }}
                              onClick={() => toggleTopping(t)}
                              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                                selected
                                  ? "bg-score-emerald text-primary-foreground border-score-emerald shadow-sm"
                                  : "bg-surface-elevated text-foreground border-border/50"
                              }`}
                            >
                              {selected && <Check size={12} strokeWidth={2.5} />}
                              {t}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div className="px-5 pb-8 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAddWithOptions}
                    className="w-full py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold shadow-luxury"
                  >
                    เพิ่มลงออเดอร์
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating order button */}
        <AnimatePresence>
          {totalItems > 0 && !optionsItem && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed bottom-6 left-4 right-4 z-40"
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => navigate("/order-summary")}
                className="w-full flex items-center justify-between px-5 py-4 rounded-2xl bg-score-emerald text-primary-foreground shadow-luxury"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag size={20} strokeWidth={2} />
                  <span className="text-sm font-bold">ดูออเดอร์</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs opacity-80">{totalItems} รายการ</span>
                  <span className="text-sm font-bold">฿{totalPrice.toLocaleString()}</span>
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
};

export default StoreOrder;
