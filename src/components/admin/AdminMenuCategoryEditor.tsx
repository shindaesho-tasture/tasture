import { useState, useEffect } from "react";
import { motion, Reorder } from "framer-motion";
import { Plus, Trash2, GripVertical, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEFAULT_CATEGORIES = ["แนะนำ", "ต้ม", "ผัด", "กับข้าว", "ราดข้าว", "ทอด", "ยำ", "อื่นๆ"];
const SITE_CONFIG_KEY = "menu_categories";

const AdminMenuCategoryEditor = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_config")
      .select("value")
      .eq("key", SITE_CONFIG_KEY)
      .maybeSingle();
    if (data?.value && Array.isArray(data.value)) {
      setCategories(data.value as string[]);
    } else {
      setCategories(DEFAULT_CATEGORIES);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_config")
        .upsert({ key: SITE_CONFIG_KEY, value: categories as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
      toast.success("บันทึกหมวดเมนูสำเร็จ ✓");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const name = newCat.trim();
    if (!name) return;
    if (categories.includes(name)) {
      toast.error("หมวดนี้มีอยู่แล้ว");
      return;
    }
    setCategories((prev) => [...prev, name]);
    setNewCat("");
  };

  const removeCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">หมวดหมู่เมนู</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">จัดการหมวดหมู่ที่ร้านค้าใช้จัดเมนู</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-score-emerald text-primary-foreground text-xs font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          บันทึก
        </button>
      </div>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          placeholder="เพิ่มหมวดใหม่..."
          className="flex-1 px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald placeholder:text-muted-foreground/50"
        />
        <button
          onClick={addCategory}
          className="w-10 h-10 rounded-xl bg-score-emerald flex items-center justify-center shrink-0"
        >
          <Plus size={16} className="text-primary-foreground" />
        </button>
      </div>

      {/* Reorderable list */}
      <Reorder.Group axis="y" values={categories} onReorder={setCategories} className="space-y-1.5">
        {categories.map((cat) => (
          <Reorder.Item
            key={cat}
            value={cat}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-elevated border border-border/40 list-none touch-none"
            whileDrag={{ scale: 1.03, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", zIndex: 50 }}
          >
            <GripVertical size={14} className="text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0" />
            <span className="flex-1 text-sm text-foreground font-medium">{cat}</span>
            <button
              onClick={() => removeCategory(cat)}
              className="p-1.5 rounded-lg hover:bg-score-ruby/10 transition-colors"
            >
              <Trash2 size={13} className="text-score-ruby/70" />
            </button>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {categories.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">ยังไม่มีหมวดหมู่</p>
      )}
    </div>
  );
};

export default AdminMenuCategoryEditor;
