import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-context";
import { useTagTranslations } from "@/hooks/use-tag-translations";

interface AddOn {
  id: string;
  name: string;
  price: number;
  category: string;
  sort_order: number;
}

const DEFAULT_CATEGORIES = ["เนื้อสัตว์", "ผัก", "ซอส", "อื่นๆ"];

const AddOnManager = ({ menuItemId }: { menuItemId: string }) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [customCat, setCustomCat] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: addOns = [], isLoading } = useQuery({
    queryKey: ["menu-addons", menuItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_addons")
        .select("id, name, price, category, sort_order")
        .eq("menu_item_id", menuItemId)
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as AddOn[];
    },
  });

  // Collect add-on categories + names for translation
  const allTranslatableTexts = useMemo(() => {
    const texts = new Set<string>(DEFAULT_CATEGORIES);
    addOns.forEach((a: AddOn) => {
      texts.add(a.category);
      texts.add(a.name);
    });
    return Array.from(texts);
  }, [addOns]);
  const { translateTag } = useTagTranslations(allTranslatableTexts);

  const addMutation = useMutation({
    mutationFn: async () => {
      const finalCat = category === "__custom" ? customCat.trim() : category;
      if (!name.trim() || !finalCat) throw new Error("กรุณากรอกชื่อและหมวดหมู่");
      const { error } = await supabase.from("menu_addons").insert({
        menu_item_id: menuItemId,
        name: name.trim(),
        price: Number(price) || 0,
        category: finalCat,
        sort_order: addOns.length,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-addons", menuItemId] });
      setName("");
      setPrice("");
      setShowForm(false);
      toast.success("เพิ่ม add-on ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_addons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-addons", menuItemId] });
      setDeleteConfirm(null);
      toast.success("ลบแล้ว ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Group by category
  const grouped = addOns.reduce<Record<string, AddOn[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] || []).push(a);
    return acc;
  }, {});

  const categoryEmoji: Record<string, string> = {
    "เนื้อสัตว์": "🥩",
    "ผัก": "🥬",
    "ซอส": "🫙",
    "อื่นๆ": "➕",
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Add-on / ท็อปปิ้งเพิ่มเงิน
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-[10px] font-medium text-score-emerald"
        >
          <Plus size={12} /> เพิ่ม
        </button>
      </div>

      {/* Grouped add-ons */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-1">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
            {categoryEmoji[cat] || "📦"} {translateTag(cat)}
          </span>
          {items.map((a) => (
            <motion.div
              key={a.id}
              layout
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/60 text-xs"
            >
              <span className="text-foreground font-medium">{translateTag(a.name)}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">+฿{a.price}</span>
                {deleteConfirm === a.id ? (
                  <motion.button
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    onClick={() => deleteMutation.mutate(a.id)}
                    className="px-2 py-0.5 rounded bg-score-ruby text-white text-[9px] font-medium"
                  >
                    ยืนยัน
                  </motion.button>
                ) : (
                  <button onClick={() => setDeleteConfirm(a.id)}>
                    <Trash2 size={12} className="text-score-ruby/60" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ))}

      {addOns.length === 0 && !isLoading && !showForm && (
        <p className="text-[10px] text-muted-foreground text-center py-2">ยังไม่มี add-on</p>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 p-3 rounded-xl bg-secondary/40 border border-border/30">
              {/* Category chips */}
              <div>
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">หมวดหมู่</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DEFAULT_CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all ${
                        category === c
                          ? "bg-score-emerald text-primary-foreground shadow-sm"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      {categoryEmoji[c] || "📦"} {translateTag(c)}
                    </button>
                  ))}
                  <button
                    onClick={() => setCategory("__custom")}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all ${
                      category === "__custom"
                        ? "bg-score-emerald text-primary-foreground shadow-sm"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    ✏️ กำหนดเอง
                  </button>
                </div>
                {category === "__custom" && (
                  <input
                    value={customCat}
                    onChange={(e) => setCustomCat(e.target.value)}
                    placeholder="ชื่อหมวดหมู่"
                    className="w-full mt-1.5 px-3 py-2 rounded-xl bg-secondary text-xs text-foreground outline-none focus:ring-1 focus:ring-score-emerald"
                  />
                )}
              </div>

              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อ add-on"
                  className="flex-1 px-3 py-2 rounded-xl bg-secondary text-xs text-foreground outline-none focus:ring-1 focus:ring-score-emerald"
                />
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="฿ ราคา"
                  className="w-20 px-3 py-2 rounded-xl bg-secondary text-xs text-foreground outline-none focus:ring-1 focus:ring-score-emerald"
                />
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => addMutation.mutate()}
                  disabled={addMutation.isPending}
                  className="flex-1 py-2 rounded-xl bg-score-emerald text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Save size={12} /> บันทึก
                </motion.button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-2 rounded-xl bg-secondary text-xs text-muted-foreground"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddOnManager;
