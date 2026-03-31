import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Pencil, Check, X, Trash2, FileText, Plus, Globe, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface DishDesc {
  id: string;
  menu_item_id: string;
  component_name: string;
  description: string;
  language: string;
}

interface DishDnaRow {
  menu_item_id: string;
  component_name: string;
  component_icon: string;
  selected_tag: string;
  selected_score: number;
}

const LANG_FLAGS: Record<string, string> = { th: "🇹🇭", en: "🇺🇸", ja: "🇯🇵", zh: "🇨🇳", ko: "🇰🇷" };
const LANG_LABELS: Record<string, string> = { th: "ไทย", en: "English", ja: "日本語", zh: "中文", ko: "한국어" };
const ALL_LANGS = ["th", "en", "ja", "zh", "ko"];

const AdminDishDescriptionEditor = () => {
  const [items, setItems] = useState<DishDesc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newComponent, setNewComponent] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newLang, setNewLang] = useState("th");
  const [newMenuItemId, setNewMenuItemId] = useState("");
  const [adding, setAdding] = useState(false);

  // Menu items for reference
  const [menuItems, setMenuItems] = useState<{ id: string; name: string }[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dish_descriptions")
      .select("*")
      .order("component_name")
      .order("language");
    setItems((data as DishDesc[]) || []);
    setLoading(false);
  };

  const loadMenuItems = async () => {
    const { data } = await supabase
      .from("menu_items")
      .select("id, name")
      .order("name")
      .limit(500);
    setMenuItems(data || []);
  };

  useEffect(() => { load(); loadMenuItems(); }, []);

  const filtered = items.filter((d) => {
    const matchSearch = !search ||
      d.component_name.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    const matchLang = langFilter === "all" || d.language === langFilter;
    return matchSearch && matchLang;
  });

  // Group by component_name
  const grouped = new Map<string, DishDesc[]>();
  filtered.forEach((d) => {
    if (!grouped.has(d.component_name)) grouped.set(d.component_name, []);
    grouped.get(d.component_name)!.push(d);
  });

  const saveEdit = async (item: DishDesc) => {
    if (!editValue.trim()) return;
    const { error } = await supabase
      .from("dish_descriptions")
      .update({ description: editValue.trim() } as any)
      .eq("id", item.id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, description: editValue.trim() } : x));
    setEditingId(null);
    toast.success("บันทึกแล้ว ✓");
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("dish_descriptions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => prev.filter((x) => x.id !== id));
    toast.success("ลบแล้ว ✓");
  };

  const addDescription = async () => {
    const comp = newComponent.trim();
    const desc = newDesc.trim();
    if (!comp || !desc || !newMenuItemId) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setAdding(true);
    const { data, error } = await supabase
      .from("dish_descriptions")
      .insert({ menu_item_id: newMenuItemId, component_name: comp, description: desc, language: newLang } as any)
      .select()
      .single();
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    setItems((prev) => [...prev, data as DishDesc]);
    setNewComponent("");
    setNewDesc("");
    setNewMenuItemId("");
    setShowAdd(false);
    toast.success("เพิ่มคำอธิบายแล้ว ✓");
  };

  // Regenerate
  const [regenerating, setRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState({ done: 0, total: 0 });
  const [showRegenPanel, setShowRegenPanel] = useState(false);
  const [regenLangs, setRegenLangs] = useState<Set<string>>(new Set(ALL_LANGS));

  const toggleRegenLang = (lang: string) => {
    setRegenLangs((prev) => {
      const next = new Set(prev);
      next.has(lang) ? next.delete(lang) : next.add(lang);
      return next;
    });
  };

  const regenerateAll = async () => {
    const selectedLangs = [...regenLangs];
    if (selectedLangs.length === 0) { toast.error("กรุณาเลือกอย่างน้อย 1 ภาษา"); return; }
    const langNames = selectedLangs.map((l) => `${LANG_FLAGS[l]} ${LANG_LABELS[l]}`).join(", ");
    if (!confirm(`⚠️ ลบคำอธิบายภาษา ${langNames} แล้วให้ AI สร้างใหม่?\nอาจใช้เวลาสักครู่`)) return;

    setRegenerating(true);
    setShowRegenPanel(false);
    setRegenProgress({ done: 0, total: 0 });

    try {
      // 1. Delete existing descriptions for selected languages only
      for (const lang of selectedLangs) {
        await supabase.from("dish_descriptions").delete().eq("language", lang);
      }

      // 2. Get all dish_dna grouped by menu_item
      const { data: dnaRows } = await supabase
        .from("dish_dna")
        .select("menu_item_id, component_name, component_icon, selected_tag, selected_score");

      if (!dnaRows || dnaRows.length === 0) {
        toast.info("ไม่พบ Dish DNA สำหรับสร้างคำอธิบาย");
        setRegenerating(false);
        return;
      }

      // Group by menu_item_id
      const byItem = new Map<string, DishDnaRow[]>();
      (dnaRows as DishDnaRow[]).forEach((r) => {
        if (!byItem.has(r.menu_item_id)) byItem.set(r.menu_item_id, []);
        byItem.get(r.menu_item_id)!.push(r);
      });

      // Get menu item names
      const itemIds = [...byItem.keys()];
      const { data: miData } = await supabase
        .from("menu_items")
        .select("id, name")
        .in("id", itemIds);
      const nameMap = new Map((miData || []).map((m) => [m.id, m.name]));

      const jobs: Array<{ menuItemId: string; dishName: string; tags: any[]; lang: string }> = [];
      for (const [menuItemId, rows] of byItem) {
        const dishName = nameMap.get(menuItemId) || "Unknown";
        const tags = rows.map((r) => ({
          ingredient: r.component_name,
          icon: r.component_icon,
          tag: r.selected_tag,
          score: r.selected_score,
        }));
        for (const lang of selectedLangs) {
          jobs.push({ menuItemId, dishName, tags, lang });
        }
      }

      setRegenProgress({ done: 0, total: jobs.length });

      let doneCount = 0;
      for (const job of jobs) {
        try {
          await supabase.functions.invoke("describe-dish", {
            body: {
              dish_name: job.dishName,
              tags: job.tags,
              menu_item_id: job.menuItemId,
              language: job.lang,
            },
          });
        } catch (e) {
          console.error("Regen error:", job.menuItemId, job.lang, e);
        }
        doneCount++;
        setRegenProgress({ done: doneCount, total: jobs.length });
      }

      toast.success(`สร้างคำอธิบายใหม่เสร็จแล้ว ✓ (${doneCount} รายการ)`);
      await load();
    } catch (e) {
      console.error("regenerateAll error:", e);
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setRegenerating(false);
    }
  };

  const languages = [...new Set(items.map((d) => d.language))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FileText size={16} className="text-score-emerald" />
        <h2 className="text-sm font-semibold text-foreground">จัดการคำอธิบายเมนู</h2>
        <span className="text-[10px] text-muted-foreground">{items.length} รายการ</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowRegenPanel((v) => !v)}
            disabled={regenerating}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-[11px] font-semibold disabled:opacity-50"
          >
            <RefreshCw size={13} className={regenerating ? "animate-spin" : ""} />
            {regenerating
              ? `กำลังสร้าง... ${regenProgress.done}/${regenProgress.total}`
              : "สร้างใหม่"}
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-score-emerald text-white text-[11px] font-semibold"
          >
            <Plus size={13} /> เพิ่มคำอธิบาย
          </button>
        </div>
      </div>

      {/* Regenerate language picker */}
      <AnimatePresence>
        {showRegenPanel && !regenerating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">เลือกภาษาที่ต้องการสร้างใหม่</p>
              <div className="flex flex-wrap gap-2">
                {ALL_LANGS.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleRegenLang(lang)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all border ${
                      regenLangs.has(lang)
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {LANG_FLAGS[lang]} {LANG_LABELS[lang]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRegenLangs(new Set(ALL_LANGS))}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  เลือกทั้งหมด
                </button>
                <button
                  onClick={() => setRegenLangs(new Set())}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  ล้างการเลือก
                </button>
                <div className="ml-auto flex gap-2">
                  <button onClick={() => setShowRegenPanel(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary">
                    ยกเลิก
                  </button>
                  <button
                    onClick={regenerateAll}
                    disabled={regenLangs.size === 0}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    สร้างใหม่ ({regenLangs.size} ภาษา)
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-score-emerald/5 border border-score-emerald/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">เพิ่มคำอธิบายเมนูใหม่</p>
              <select
                value={newMenuItemId}
                onChange={(e) => setNewMenuItemId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald"
              >
                <option value="">เลือกเมนู...</option>
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                value={newComponent}
                onChange={(e) => setNewComponent(e.target.value)}
                placeholder="ชื่อส่วนประกอบ (เช่น เส้น, น้ำซุป)"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald placeholder:text-muted-foreground/60"
              />
              <div className="flex gap-2">
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald"
                >
                  {["th", "en", "ja", "zh", "ko"].map((l) => (
                    <option key={l} value={l}>{LANG_FLAGS[l]} {LANG_LABELS[l]}</option>
                  ))}
                </select>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="คำอธิบาย..."
                  onKeyDown={(e) => e.key === "Enter" && addDescription()}
                  className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary">
                  ยกเลิก
                </button>
                <button
                  onClick={addDescription}
                  disabled={adding}
                  className="px-4 py-2 rounded-xl bg-score-emerald text-white text-xs font-semibold disabled:opacity-50"
                >
                  {adding ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search + Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาส่วนประกอบ / คำอธิบาย..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setLangFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
              langFilter === "all" ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
            }`}
          >
            ทั้งหมด
          </button>
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLangFilter(lang)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                langFilter === lang ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
              }`}
            >
              {LANG_FLAGS[lang] || "🌐"} {LANG_LABELS[lang] || lang}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped list */}
      {grouped.size === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">ไม่พบคำอธิบาย</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {[...grouped.entries()].map(([compName, descs]) => (
              <motion.div
                key={compName}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl bg-surface-elevated border border-border/40 overflow-hidden"
              >
                <div className="px-3 py-2 bg-secondary/50 border-b border-border/30">
                  <span className="text-xs font-semibold text-foreground">{compName}</span>
                </div>
                <div className="divide-y divide-border/20">
                  {descs.map((d) => (
                    <div key={d.id} className="flex items-start gap-2 px-3 py-2">
                      <span className="text-sm shrink-0 mt-0.5">{LANG_FLAGS[d.language] || "🌐"}</span>
                      <span className="text-[10px] text-muted-foreground w-6 shrink-0 mt-1">{d.language}</span>

                      {editingId === d.id ? (
                        <div className="flex-1 flex items-start gap-1.5">
                          <textarea
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={2}
                            className="flex-1 px-2 py-1 rounded-lg bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald resize-none"
                          />
                          <button onClick={() => saveEdit(d)} className="p-1 rounded-lg hover:bg-score-emerald/10 text-score-emerald mt-0.5">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground mt-0.5">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="flex-1 text-xs text-foreground leading-relaxed">{d.description}</p>
                          <button
                            onClick={() => { setEditingId(d.id); setEditValue(d.description); }}
                            className="p-1 rounded-lg hover:bg-secondary text-muted-foreground shrink-0"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => deleteItem(d.id)}
                            className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default AdminDishDescriptionEditor;
