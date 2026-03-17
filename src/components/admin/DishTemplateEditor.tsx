import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ChevronDown, ChevronUp, Plus, Trash2, Save, Loader2, Pencil, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { DishComponent } from "@/lib/dish-dna-types";

interface DishTemplate {
  id: string;
  dish_name: string;
  components: DishComponent[];
  updated_at: string;
}

const haptic = () => navigator.vibrate?.(8);

const DishTemplateEditor = () => {
  const [templates, setTemplates] = useState<DishTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DishTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newDishName, setNewDishName] = useState("");

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dish_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "โหลดไม่สำเร็จ", description: error.message, variant: "destructive" });
    } else {
      setTemplates((data || []).map((d: any) => ({
        ...d,
        components: (d.components as unknown as DishComponent[]) || [],
      })));
    }
    setLoading(false);
  };

  const startEdit = (template: DishTemplate) => {
    haptic();
    setEditingTemplate(JSON.parse(JSON.stringify(template)));
    setExpandedId(template.id);
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
  };

  const updateComponent = (idx: number, field: keyof DishComponent | "emerald" | "neutral" | "ruby", value: string) => {
    if (!editingTemplate) return;
    const comps = [...editingTemplate.components];
    if (field === "name" || field === "icon") {
      comps[idx] = { ...comps[idx], [field]: value };
    } else if (field === "emerald" || field === "neutral" || field === "ruby") {
      comps[idx] = { ...comps[idx], tags: { ...comps[idx].tags, [field]: value } };
    }
    setEditingTemplate({ ...editingTemplate, components: comps });
  };

  const addComponent = () => {
    if (!editingTemplate) return;
    haptic();
    setEditingTemplate({
      ...editingTemplate,
      components: [
        ...editingTemplate.components,
        { name: "ส่วนประกอบใหม่", icon: "🍽️", tags: { emerald: "สุดยอด", neutral: "ปกติ", ruby: "ผิดหวัง" } },
      ],
    });
  };

  const removeComponent = (idx: number) => {
    if (!editingTemplate) return;
    haptic();
    const comps = [...editingTemplate.components];
    comps.splice(idx, 1);
    setEditingTemplate({ ...editingTemplate, components: comps });
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    setSaving(true);
    haptic();
    const { error } = await supabase
      .from("dish_templates")
      .update({ components: editingTemplate.components as any, updated_at: new Date().toISOString() })
      .eq("id", editingTemplate.id);
    if (error) {
      toast({ title: "บันทึกไม่สำเร็จ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ บันทึกแท็กสำเร็จ" });
      setTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplate.id ? { ...editingTemplate, updated_at: new Date().toISOString() } : t))
      );
      setEditingTemplate(null);
    }
    setSaving(false);
  };

  const filtered = templates.filter(
    (t) => !search || t.dish_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header info */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-accent/10 border border-primary/20 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">🧬</span>
          <span className="text-xs font-semibold text-foreground">จัดการแท็ก Dish DNA</span>
        </div>
        <p className="text-[10px] text-muted-foreground">แก้ไข เพิ่ม หรือลบแท็กของแต่ละส่วนประกอบในเทมเพลต</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="ค้นหาชื่อเมนู..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/50 focus:border-score-emerald/50 transition-colors"
        />
      </div>

      {/* Template list */}
      <div className="space-y-2">
        {filtered.map((template) => {
          const isExpanded = expandedId === template.id;
          const isEditing = editingTemplate?.id === template.id;
          const displayComps = isEditing ? editingTemplate!.components : template.components;

          return (
            <motion.div
              key={template.id}
              layout
              className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 overflow-hidden"
            >
              {/* Row header */}
              <button
                onClick={() => { haptic(); setExpandedId(isExpanded ? null : template.id); if (isEditing) cancelEdit(); }}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-score-emerald/10 flex items-center justify-center text-lg">🧬</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{template.dish_name}</p>
                  <p className="text-[10px] text-muted-foreground">{template.components.length} ส่วนประกอบ</p>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </button>

              {/* Expanded content */}
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
                      {/* Edit/Save buttons */}
                      <div className="flex items-center gap-2 justify-end">
                        {!isEditing ? (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => startEdit(template)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-score-emerald/10 text-score-emerald text-[11px] font-semibold"
                          >
                            <Pencil size={12} /> แก้ไข
                          </motion.button>
                        ) : (
                          <>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={cancelEdit}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-[11px] font-medium"
                            >
                              <X size={12} /> ยกเลิก
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={saveTemplate}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-score-emerald text-white text-[11px] font-semibold disabled:opacity-50"
                            >
                              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              บันทึก
                            </motion.button>
                          </>
                        )}
                      </div>

                      {/* Components */}
                      {displayComps.map((comp, i) => (
                        <div key={i} className="rounded-xl bg-secondary/50 border border-border/40 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <>
                                <input
                                  value={comp.icon}
                                  onChange={(e) => updateComponent(i, "icon", e.target.value)}
                                  className="w-10 h-10 rounded-lg bg-background text-center text-lg border border-border/50 outline-none focus:border-score-emerald/50"
                                />
                                <input
                                  value={comp.name}
                                  onChange={(e) => updateComponent(i, "name", e.target.value)}
                                  className="flex-1 px-2 py-1.5 rounded-lg bg-background text-sm font-medium text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                                />
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => removeComponent(i)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 size={14} />
                                </motion.button>
                              </>
                            ) : (
                              <>
                                <span className="text-lg">{comp.icon}</span>
                                <span className="text-sm font-semibold text-foreground">{comp.name}</span>
                              </>
                            )}
                          </div>

                          {/* Tags */}
                          <div className="space-y-1.5">
                            {(["emerald", "neutral", "ruby"] as const).map((tier) => {
                              const colorClasses = {
                                emerald: "bg-score-emerald/10 text-score-emerald border-score-emerald/30",
                                neutral: "bg-score-slate/10 text-score-slate border-score-slate/30",
                                ruby: "bg-score-ruby/10 text-score-ruby border-score-ruby/30",
                              };
                              const labels = { emerald: "🤩 สุดยอด", neutral: "😐 ปกติ", ruby: "😔 ผิดหวัง" };

                              return (
                                <div key={tier} className="flex items-center gap-2">
                                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md border whitespace-nowrap", colorClasses[tier])}>
                                    {labels[tier]}
                                  </span>
                                  {isEditing ? (
                                    <input
                                      value={comp.tags[tier]}
                                      onChange={(e) => updateComponent(i, tier, e.target.value)}
                                      className="flex-1 px-2 py-1 rounded-lg bg-background text-[12px] text-foreground border border-border/50 outline-none focus:border-score-emerald/50"
                                    />
                                  ) : (
                                    <span className="text-[12px] text-foreground">{comp.tags[tier]}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Add component button */}
                      {isEditing && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={addComponent}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-border/50 text-[11px] font-medium text-muted-foreground hover:border-score-emerald/40 hover:text-score-emerald transition-colors"
                        >
                          <Plus size={14} /> เพิ่มส่วนประกอบ
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">
            {search ? "ไม่พบเทมเพลต" : "ยังไม่มี Dish DNA Template"}
          </p>
        )}
      </div>
    </div>
  );
};

export default DishTemplateEditor;
