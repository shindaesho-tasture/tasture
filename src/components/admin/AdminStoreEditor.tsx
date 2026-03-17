import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Save, Loader2, Pencil, Trash2, Plus, ChevronDown, UtensilsCrossed,
  MapPin, Image as ImageIcon, Store,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { categories } from "@/lib/categories";

interface StoreData {
  id: string;
  name: string;
  category_id: string | null;
  verified: boolean;
  pin_lat: number | null;
  pin_lng: number | null;
  menu_photo: string | null;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  price_special: number | null;
  type: string;
  image_url: string | null;
}

interface ReviewTag {
  metric_id: string;
  avg_score: number;
  count: number;
}

interface AdminStoreEditorProps {
  storeId: string;
  onClose: () => void;
  onUpdated: () => void;
}

const haptic = () => navigator.vibrate?.(8);

type EditorTab = "info" | "menu" | "feedback";

const AdminStoreEditor = ({ storeId, onClose, onUpdated }: AdminStoreEditorProps) => {
  const [tab, setTab] = useState<EditorTab>("info");
  const [confirmDeleteStore, setConfirmDeleteStore] = useState(false);
  const [store, setStore] = useState<StoreData | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reviewTags, setReviewTags] = useState<ReviewTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit states
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [showCatPicker, setShowCatPicker] = useState(false);

  // Menu edit
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuForm, setMenuForm] = useState({ name: "", price: 0, price_special: null as number | null, type: "standard" });
  const [addingMenu, setAddingMenu] = useState(false);

  useEffect(() => {
    loadStore();
  }, [storeId]);

  const loadStore = async () => {
    setLoading(true);
    const [{ data: storeData }, { data: items }, { data: reviews }] = await Promise.all([
      supabase.from("stores").select("id, name, category_id, verified, pin_lat, pin_lng, menu_photo").eq("id", storeId).single(),
      supabase.from("menu_items").select("id, name, price, price_special, type, image_url").eq("store_id", storeId).order("created_at"),
      supabase.from("reviews").select("metric_id, score").eq("store_id", storeId),
    ]);
    if (storeData) {
      setStore(storeData);
      setEditName(storeData.name);
      setEditCategory(storeData.category_id);
    }
    setMenuItems(items || []);

    // Aggregate review scores
    const map = new Map<string, { total: number; count: number }>();
    (reviews || []).forEach((r) => {
      const cur = map.get(r.metric_id) || { total: 0, count: 0 };
      cur.total += r.score;
      cur.count++;
      map.set(r.metric_id, cur);
    });
    setReviewTags([...map.entries()].map(([metric_id, v]) => ({
      metric_id,
      avg_score: v.total / v.count,
      count: v.count,
    })));
    setLoading(false);
  };

  const saveStoreInfo = async () => {
    if (!store) return;
    setSaving(true);
    haptic();
    const { error } = await supabase.from("stores").update({
      name: editName.trim(),
      category_id: editCategory,
    }).eq("id", store.id);
    if (error) {
      toast({ title: "บันทึกไม่สำเร็จ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ อัพเดตร้านแล้ว" });
      setStore({ ...store, name: editName.trim(), category_id: editCategory });
      onUpdated();
    }
    setSaving(false);
  };

  const startEditMenu = (item: MenuItem) => {
    haptic();
    setEditingMenuId(item.id);
    setMenuForm({ name: item.name, price: item.price, price_special: item.price_special, type: item.type });
    setAddingMenu(false);
  };

  const startAddMenu = () => {
    haptic();
    setEditingMenuId(null);
    setMenuForm({ name: "", price: 0, price_special: null, type: "standard" });
    setAddingMenu(true);
  };

  const saveMenuItem = async () => {
    if (!menuForm.name.trim()) return;
    setSaving(true);
    haptic();

    if (addingMenu) {
      const { data, error } = await supabase.from("menu_items").insert({
        store_id: storeId,
        name: menuForm.name.trim(),
        price: menuForm.price,
        price_special: menuForm.price_special,
        type: menuForm.type,
      }).select().single();
      if (error) {
        toast({ title: "เพิ่มไม่สำเร็จ", description: error.message, variant: "destructive" });
      } else if (data) {
        setMenuItems((prev) => [...prev, data]);
        setAddingMenu(false);
        toast({ title: "✅ เพิ่มเมนูแล้ว" });
      }
    } else if (editingMenuId) {
      const { error } = await supabase.from("menu_items").update({
        name: menuForm.name.trim(),
        price: menuForm.price,
        price_special: menuForm.price_special,
        type: menuForm.type,
      }).eq("id", editingMenuId);
      if (error) {
        toast({ title: "บันทึกไม่สำเร็จ", description: error.message, variant: "destructive" });
      } else {
        setMenuItems((prev) => prev.map((m) => m.id === editingMenuId ? { ...m, ...menuForm, name: menuForm.name.trim() } : m));
        setEditingMenuId(null);
        toast({ title: "✅ อัพเดตเมนูแล้ว" });
      }
    }
    setSaving(false);
  };

  const deleteMenuItem = async (id: string) => {
    haptic();
    await supabase.from("menu_reviews").delete().eq("menu_item_id", id);
    await supabase.from("dish_dna").delete().eq("menu_item_id", id);
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) {
      toast({ title: "ลบไม่สำเร็จ", description: error.message, variant: "destructive" });
    } else {
      setMenuItems((prev) => prev.filter((m) => m.id !== id));
      toast({ title: "🗑️ ลบเมนูแล้ว" });
    }
  };

  const scoreColor = (s: number) => {
    if (s >= 1.5) return "text-score-emerald bg-score-emerald/10";
    if (s >= 0.5) return "text-score-mint bg-score-mint/10";
    if (s >= -0.4) return "text-score-slate bg-score-slate/10";
    if (s >= -1.4) return "text-score-amber bg-score-amber/10";
    return "text-score-ruby bg-score-ruby/10";
  };

  const catInfo = categories.find((c) => c.id === editCategory);
  const metricLabel = (id: string) => {
    for (const cat of categories) {
      for (const m of cat.metrics) {
        if (m.id === id) return { label: m.label, icon: m.icon };
        if (m.smartGate) {
          for (const sub of m.smartGate.subMetrics) {
            if (sub.id === id) return { label: sub.label, icon: sub.icon };
          }
        }
      }
    }
    return { label: id, icon: "📊" };
  };

  const tabItems: { id: EditorTab; label: string }[] = [
    { id: "info", label: "ข้อมูลร้าน" },
    { id: "menu", label: `เมนู (${menuItems.length})` },
    { id: "feedback", label: `แท็ก (${reviewTags.length})` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 max-h-[90vh] bg-background rounded-t-[24px] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 shrink-0">
          <Store size={18} className="text-score-emerald" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{store?.name || "..."}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Admin Editor</p>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} className="p-2 rounded-lg hover:bg-secondary">
            <X size={18} className="text-muted-foreground" />
          </motion.button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-border/20 shrink-0">
          {tabItems.map((t) => (
            <button
              key={t.id}
              onClick={() => { haptic(); setTab(t.id); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                tab === t.id ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ─── Info Tab ─── */}
              {tab === "info" && store && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-muted-foreground">ชื่อร้าน</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground border border-border/50 outline-none focus:border-score-emerald/50 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-muted-foreground">หมวดหมู่</label>
                    <button
                      onClick={() => setShowCatPicker(!showCatPicker)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground border border-border/50"
                    >
                      <span>{catInfo ? `${catInfo.icon} ${catInfo.labelTh}` : "ไม่ระบุ"}</span>
                      <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", showCatPicker && "rotate-180")} />
                    </button>
                    <AnimatePresence>
                      {showCatPicker && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {categories.map((cat) => (
                              <button
                                key={cat.id}
                                onClick={() => { setEditCategory(cat.id); setShowCatPicker(false); }}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors text-left",
                                  editCategory === cat.id ? "bg-score-emerald/10 text-score-emerald border border-score-emerald/30" : "bg-secondary/50 text-foreground border border-border/30"
                                )}
                              >
                                <span>{cat.icon}</span>
                                <span className="truncate">{cat.labelTh}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {store.pin_lat && store.pin_lng && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border/30">
                      <MapPin size={14} className="text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">
                        {store.pin_lat.toFixed(4)}, {store.pin_lng.toFixed(4)}
                      </span>
                    </div>
                  )}

                  {store.menu_photo && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">รูปเมนู</label>
                      <div className="w-full h-32 rounded-xl overflow-hidden bg-secondary">
                        <img src={store.menu_photo} alt="menu" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={saveStoreInfo}
                    disabled={saving || !editName.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-foreground text-background font-semibold text-sm disabled:opacity-30"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    บันทึกข้อมูลร้าน
                  </motion.button>
                </div>
              )}

              {/* ─── Menu Tab ─── */}
              {tab === "menu" && (
                <div className="space-y-3">
                  {/* Add button */}
                  {!addingMenu && !editingMenuId && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={startAddMenu}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-score-emerald/30 text-score-emerald text-[12px] font-semibold hover:bg-score-emerald/5 transition-colors"
                    >
                      <Plus size={15} /> เพิ่มเมนูใหม่
                    </motion.button>
                  )}

                  {/* Add/Edit form */}
                  <AnimatePresence>
                    {(addingMenu || editingMenuId) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-xl bg-score-emerald/5 border border-score-emerald/20 p-3 space-y-2.5 overflow-hidden"
                      >
                        <p className="text-[11px] font-semibold text-foreground">{addingMenu ? "เพิ่มเมนูใหม่" : "แก้ไขเมนู"}</p>
                        <input
                          placeholder="ชื่อเมนู"
                          value={menuForm.name}
                          onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-background text-sm text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] text-muted-foreground">ราคา</label>
                            <input
                              type="number"
                              value={menuForm.price}
                              onChange={(e) => setMenuForm({ ...menuForm, price: Number(e.target.value) })}
                              className="w-full px-3 py-2 rounded-lg bg-background text-sm text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-muted-foreground">ราคาพิเศษ</label>
                            <input
                              type="number"
                              value={menuForm.price_special ?? ""}
                              onChange={(e) => setMenuForm({ ...menuForm, price_special: e.target.value ? Number(e.target.value) : null })}
                              placeholder="—"
                              className="w-full px-3 py-2 rounded-lg bg-background text-sm text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {["standard", "noodle", "dual_price"].map((t) => (
                            <button
                              key={t}
                              onClick={() => setMenuForm({ ...menuForm, type: t })}
                              className={cn("px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors",
                                menuForm.type === t ? "bg-foreground text-background border-transparent" : "bg-secondary text-muted-foreground border-border/30"
                              )}
                            >
                              {t === "standard" ? "ทั่วไป" : t === "noodle" ? "ก๋วยเตี๋ยว" : "ราคาคู่"}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            onClick={() => { setAddingMenu(false); setEditingMenuId(null); }}
                            className="px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-[11px] font-medium"
                          >
                            ยกเลิก
                          </button>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={saveMenuItem}
                            disabled={saving || !menuForm.name.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-score-emerald text-white text-[11px] font-semibold disabled:opacity-50"
                          >
                            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            {addingMenu ? "เพิ่ม" : "บันทึก"}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Menu list */}
                  {menuItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated border border-border/40">
                      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <UtensilsCrossed size={16} className="text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground truncate">{item.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-score-emerald font-bold">฿{item.price}</span>
                          {item.price_special && <span className="text-[10px] text-muted-foreground line-through">฿{item.price_special}</span>}
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{item.type}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => startEditMenu(item)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                          <Pencil size={13} className="text-muted-foreground" />
                        </motion.button>
                        <ConfirmDelete onDelete={() => deleteMenuItem(item.id)} />
                      </div>
                    </div>
                  ))}
                  {menuItems.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-10">ยังไม่มีเมนู</p>
                  )}
                </div>
              )}

              {/* ─── Feedback Tags Tab ─── */}
              {tab === "feedback" && (
                <div className="space-y-3">
                  {reviewTags.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-10">ยังไม่มีฟีดแบค</p>
                  ) : (
                    reviewTags
                      .sort((a, b) => b.count - a.count)
                      .map((tag) => {
                        const info = metricLabel(tag.metric_id);
                        return (
                          <div key={tag.metric_id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated border border-border/40">
                            <span className="text-lg">{info.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-foreground">{info.label}</p>
                              <p className="text-[10px] text-muted-foreground">{tag.count} รีวิว</p>
                            </div>
                            <span className={cn("px-2.5 py-1 rounded-lg text-[12px] font-bold tabular-nums", scoreColor(tag.avg_score))}>
                              {tag.avg_score > 0 ? "+" : ""}{tag.avg_score.toFixed(1)}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const ConfirmDelete = ({ onDelete }: { onDelete: () => void }) => {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (confirm) { const t = setTimeout(() => setConfirm(false), 3000); return () => clearTimeout(t); }
  }, [confirm]);
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => { if (confirm) { onDelete(); setConfirm(false); } else { haptic(); setConfirm(true); } }}
      className={cn("p-1.5 rounded-lg transition-colors", confirm ? "bg-destructive/15 text-destructive" : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive")}
    >
      <Trash2 size={13} />
    </motion.button>
  );
};

export default AdminStoreEditor;
