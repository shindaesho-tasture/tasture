import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, Loader2, Pencil, X, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { categories as defaultCategories, type Category, type CategoryMetric } from "@/lib/categories";
import { useCategories } from "@/hooks/use-categories";

const haptic = () => navigator.vibrate?.(8);

const CategoryMetricEditor = ({
  metric,
  onChange,
  onRemove,
}: {
  metric: CategoryMetric;
  onChange: (m: CategoryMetric) => void;
  onRemove: () => void;
}) => {
  return (
    <div className="rounded-xl bg-background border border-border/40 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={metric.icon}
          onChange={(e) => onChange({ ...metric, icon: e.target.value })}
          className="w-9 h-9 rounded-lg bg-secondary text-center text-base border border-border/50 outline-none focus:border-score-emerald/50"
        />
        <input
          value={metric.label}
          onChange={(e) => onChange({ ...metric, label: e.target.value })}
          placeholder="ชื่อแท็ก"
          className="flex-1 px-2 py-1.5 rounded-lg bg-secondary text-[12px] font-medium text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
        />
        <input
          value={metric.id}
          onChange={(e) => onChange({ ...metric, id: e.target.value })}
          placeholder="ID"
          className="w-20 px-2 py-1.5 rounded-lg bg-secondary text-[10px] text-muted-foreground border border-border/50 outline-none focus:border-score-emerald/50"
        />
        <motion.button whileTap={{ scale: 0.9 }} onClick={onRemove} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 size={13} />
        </motion.button>
      </div>
      {/* Options: +2, 0, -2 labels */}
      <div className="grid grid-cols-3 gap-1.5">
        {(["emerald", "slate", "ruby"] as const).map((tier, i) => {
          const colors = {
            emerald: "border-score-emerald/30 focus:border-score-emerald",
            slate: "border-score-slate/30 focus:border-score-slate",
            ruby: "border-score-ruby/30 focus:border-score-ruby",
          };
          const labels = ["+2", "0", "-2"];
          return (
            <div key={tier} className="space-y-0.5">
              <span className="text-[8px] text-muted-foreground">{labels[i]}</span>
              <input
                value={metric.options[i]}
                onChange={(e) => {
                  const opts = [...metric.options] as [string, string, string];
                  opts[i] = e.target.value;
                  onChange({ ...metric, options: opts });
                }}
                className={cn("w-full px-2 py-1 rounded-md bg-secondary text-[10px] text-foreground border outline-none", colors[tier])}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AdminCategoryEditor = () => {
  const { categories: liveCategories, refresh } = useCategories();
  const [cats, setCats] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setCats(JSON.parse(JSON.stringify(liveCategories)));
  }, [liveCategories]);

  const markChanged = () => setHasChanges(true);

  const updateCat = (idx: number, updates: Partial<Category>) => {
    const next = [...cats];
    next[idx] = { ...next[idx], ...updates };
    setCats(next);
    markChanged();
  };

  const updateMetric = (catIdx: number, metricIdx: number, metric: CategoryMetric) => {
    const next = [...cats];
    const metrics = [...next[catIdx].metrics];
    metrics[metricIdx] = metric;
    next[catIdx] = { ...next[catIdx], metrics };
    setCats(next);
    markChanged();
  };

  const removeMetric = (catIdx: number, metricIdx: number) => {
    haptic();
    const next = [...cats];
    const metrics = [...next[catIdx].metrics];
    metrics.splice(metricIdx, 1);
    next[catIdx] = { ...next[catIdx], metrics };
    setCats(next);
    markChanged();
  };

  const addMetric = (catIdx: number) => {
    haptic();
    const next = [...cats];
    next[catIdx] = {
      ...next[catIdx],
      metrics: [
        ...next[catIdx].metrics,
        { id: `metric-${Date.now()}`, label: "แท็กใหม่", icon: "📊", options: ["ดีมาก", "ปกติ", "แย่"] as [string, string, string] },
      ],
    };
    setCats(next);
    markChanged();
  };

  const addCategory = () => {
    haptic();
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      label: "New Category",
      labelTh: "กลุ่มใหม่",
      icon: "🏪",
      description: "รายละเอียด",
      metrics: [],
    };
    setCats([...cats, newCat]);
    setExpandedCat(newCat.id);
    markChanged();
  };

  const removeCategory = (idx: number) => {
    haptic();
    const next = [...cats];
    next.splice(idx, 1);
    setCats(next);
    markChanged();
  };

  const saveAll = async () => {
    setSaving(true);
    haptic();
    // Clean up smartGate references for simplicity (flatten)
    const cleaned = cats.map((c) => ({
      ...c,
      metrics: c.metrics.map((m) => {
        // Strip smartGate for now to keep it simple
        const { smartGate, ...rest } = m as any;
        return rest as CategoryMetric;
      }),
    }));

    const { error } = await supabase
      .from("site_config")
      .update({ value: cleaned as any, updated_at: new Date().toISOString() })
      .eq("key", "categories");

    if (error) {
      toast({ title: "บันทึกไม่สำเร็จ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ บันทึกหมวดหมู่และแท็กสำเร็จ" });
      setHasChanges(false);
      await refresh();
    }
    setSaving(false);
  };

  const resetToDefaults = () => {
    haptic();
    setCats(JSON.parse(JSON.stringify(defaultCategories)));
    markChanged();
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-accent/10 border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🏷️</span>
          <span className="text-xs font-semibold text-foreground">จัดการกลุ่มร้านและแท็ก</span>
        </div>
        <p className="text-[10px] text-muted-foreground">เพิ่ม ลบ หรือเปลี่ยนชื่อกลุ่มร้าน (หมวดหมู่) และแท็กรีวิว (metrics)</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={addCategory}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-score-emerald/30 text-score-emerald text-[11px] font-semibold hover:bg-score-emerald/5 transition-colors"
        >
          <Plus size={14} /> เพิ่มกลุ่มร้าน
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={resetToDefaults}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-muted-foreground text-[11px] font-medium hover:bg-accent transition-colors"
        >
          รีเซ็ตค่าเดิม
        </motion.button>
      </div>

      {/* Category list */}
      <div className="space-y-2">
        {cats.map((cat, catIdx) => {
          const isExpanded = expandedCat === cat.id;
          return (
            <motion.div key={cat.id} layout className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => { haptic(); setExpandedCat(isExpanded ? null : cat.id); }}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <span className="text-xl">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{cat.labelTh}</p>
                  <p className="text-[10px] text-muted-foreground">{cat.label} · {cat.metrics.length} แท็ก</p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                      {/* Category info edit */}
                      <div className="grid grid-cols-[3rem_1fr] gap-2">
                        <div>
                          <label className="text-[8px] text-muted-foreground">ไอคอน</label>
                          <input
                            value={cat.icon}
                            onChange={(e) => updateCat(catIdx, { icon: e.target.value })}
                            className="w-full h-10 rounded-lg bg-secondary text-center text-lg border border-border/50 outline-none focus:border-score-emerald/50"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <label className="text-[8px] text-muted-foreground">ชื่อไทย</label>
                            <input
                              value={cat.labelTh}
                              onChange={(e) => updateCat(catIdx, { labelTh: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg bg-secondary text-[12px] font-medium text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-muted-foreground">ชื่ออังกฤษ</label>
                            <input
                              value={cat.label}
                              onChange={(e) => updateCat(catIdx, { label: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg bg-secondary text-[11px] text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[8px] text-muted-foreground">ID (ห้ามซ้ำ)</label>
                        <input
                          value={cat.id}
                          onChange={(e) => updateCat(catIdx, { id: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg bg-secondary text-[10px] text-muted-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                        />
                      </div>

                      <div>
                        <label className="text-[8px] text-muted-foreground">รายละเอียด</label>
                        <input
                          value={cat.description}
                          onChange={(e) => updateCat(catIdx, { description: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg bg-secondary text-[11px] text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                        />
                      </div>

                      {/* Metrics */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-muted-foreground">แท็กรีวิว ({cat.metrics.length})</span>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => addMetric(catIdx)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-score-emerald/10 text-score-emerald text-[10px] font-semibold"
                          >
                            <Plus size={11} /> เพิ่มแท็ก
                          </motion.button>
                        </div>
                        {cat.metrics.map((m, mIdx) => (
                          <CategoryMetricEditor
                            key={`${cat.id}-${mIdx}`}
                            metric={m}
                            onChange={(updated) => updateMetric(catIdx, mIdx, updated)}
                            onRemove={() => removeMetric(catIdx, mIdx)}
                          />
                        ))}
                      </div>

                      {/* Delete category */}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => removeCategory(catIdx)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-destructive/30 text-destructive text-[11px] font-medium hover:bg-destructive/5 transition-colors"
                      >
                        <Trash2 size={13} /> ลบกลุ่มนี้
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Floating save */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="sticky bottom-4 z-10"
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={saveAll}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-foreground text-background font-semibold text-sm shadow-card-elevated disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              บันทึกทั้งหมด
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCategoryEditor;
