import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Pencil, Check, X, Trash2, Globe, Plus, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface TagTranslation {
  id: string;
  tag_text: string;
  language: string;
  translated_text: string;
}

const LANG_FLAGS: Record<string, string> = {
  en: "🇺🇸",
  ja: "🇯🇵",
  zh: "🇨🇳",
  ko: "🇰🇷",
  th: "🇹🇭",
};

const LANG_LABELS: Record<string, string> = {
  en: "English",
  ja: "日本語",
  zh: "中文",
  ko: "한국어",
  th: "ไทย",
};

const LANGS = ["en", "ja", "zh", "ko"] as const;

const AdminTagTranslationEditor = () => {
  const [translations, setTranslations] = useState<TagTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTagText, setNewTagText] = useState("");
  const [newLang, setNewLang] = useState("en");
  const [newTranslated, setNewTranslated] = useState("");
  const [adding, setAdding] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [allSourceTags, setAllSourceTags] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data: transData }, { data: dnaData }, { data: menuData }, { data: templateData }] = await Promise.all([
      supabase.from("tag_translations").select("*").order("tag_text").order("language"),
      supabase.from("dish_dna").select("component_name, selected_tag"),
      supabase.from("menu_items").select("textures, toppings, noodle_types, noodle_styles"),
      supabase.from("dish_templates").select("components"),
    ]);
    setTranslations((transData as TagTranslation[]) || []);

    // Collect all unique source tags from DNA, menus, templates
    const sourceTags = new Set<string>();
    (dnaData || []).forEach((d: any) => { sourceTags.add(d.component_name); sourceTags.add(d.selected_tag); });
    (menuData || []).forEach((m: any) => {
      (m.textures || []).forEach((t: string) => sourceTags.add(t));
      (m.toppings || []).forEach((t: string) => sourceTags.add(t));
      (m.noodle_types || []).forEach((t: string) => sourceTags.add(t));
      (m.noodle_styles || []).forEach((t: string) => sourceTags.add(t));
    });
    (templateData || []).forEach((t: any) => {
      const comps = Array.isArray(t.components) ? t.components : [];
      comps.forEach((c: any) => {
        if (c.name) sourceTags.add(c.name);
        (c.tags || []).forEach((tag: any) => {
          if (typeof tag === "string") sourceTags.add(tag);
          else if (tag?.label) sourceTags.add(tag.label);
        });
      });
    });
    setAllSourceTags([...sourceTags].filter(Boolean).sort());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = translations.filter((t) => {
    const matchSearch = !search ||
      t.tag_text.toLowerCase().includes(search.toLowerCase()) ||
      t.translated_text.toLowerCase().includes(search.toLowerCase());
    const matchLang = langFilter === "all" || t.language === langFilter;
    return matchSearch && matchLang;
  });

  // Group by tag_text
  const grouped = new Map<string, TagTranslation[]>();
  filtered.forEach((t) => {
    if (!grouped.has(t.tag_text)) grouped.set(t.tag_text, []);
    grouped.get(t.tag_text)!.push(t);
  });

  const startEdit = (t: TagTranslation) => {
    setEditingId(t.id);
    setEditValue(t.translated_text);
  };

  const saveEdit = async (t: TagTranslation) => {
    if (!editValue.trim()) return;
    const { error } = await supabase
      .from("tag_translations")
      .update({ translated_text: editValue.trim() } as any)
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTranslations((prev) =>
      prev.map((x) => x.id === t.id ? { ...x, translated_text: editValue.trim() } : x)
    );
    setEditingId(null);
    toast.success("บันทึกแล้ว ✓");
  };

  const deleteTranslation = async (id: string) => {
    const { error } = await supabase.from("tag_translations").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTranslations((prev) => prev.filter((x) => x.id !== id));
    toast.success("ลบแล้ว ✓");
  };

  const addTranslation = async () => {
    const tag = newTagText.trim();
    const translated = newTranslated.trim();
    if (!tag || !translated) {
      toast.error("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    setAdding(true);
    const { data, error } = await supabase
      .from("tag_translations")
      .insert({ tag_text: tag, language: newLang, translated_text: translated } as any)
      .select()
      .single();
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTranslations((prev) => [...prev, data as TagTranslation]);
    setNewTagText("");
    setNewTranslated("");
    setShowAdd(false);
    toast.success("เพิ่มคำแปลแล้ว ✓");
  };

  const languages = [...new Set(translations.map((t) => t.language))].sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe size={16} className="text-score-emerald" />
        <h2 className="text-sm font-semibold text-foreground">จัดการคำแปลแท็ก</h2>
        <span className="text-[10px] text-muted-foreground">{translations.length} รายการ</span>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-xl bg-score-emerald text-white text-[11px] font-semibold"
        >
          <Plus size={13} /> เพิ่มคำแปล
        </button>
      </div>

      {/* Add new form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl bg-score-emerald/5 border border-score-emerald/20 p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">เพิ่มคำแปลแท็กใหม่</p>
              <input
                value={newTagText}
                onChange={(e) => setNewTagText(e.target.value)}
                placeholder="แท็กต้นฉบับ (เช่น กรอบ)"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald placeholder:text-muted-foreground/60"
              />
              <div className="flex gap-2">
                <select
                  value={newLang}
                  onChange={(e) => setNewLang(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald"
                >
                  {["en", "ja", "zh", "ko"].map((l) => (
                    <option key={l} value={l}>{LANG_FLAGS[l]} {LANG_LABELS[l]}</option>
                  ))}
                </select>
                <input
                  value={newTranslated}
                  onChange={(e) => setNewTranslated(e.target.value)}
                  placeholder="คำแปล (เช่น Crispy)"
                  onKeyDown={(e) => e.key === "Enter" && addTranslation()}
                  className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald placeholder:text-muted-foreground/60"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-secondary">
                  ยกเลิก
                </button>
                <button
                  onClick={addTranslation}
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
            placeholder="ค้นหาแท็ก..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setLangFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
              langFilter === "all"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            ทั้งหมด
          </button>
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLangFilter(lang)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                langFilter === lang
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground"
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
          <p className="text-sm text-muted-foreground">ไม่พบคำแปล</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {[...grouped.entries()].map(([tagText, items]) => (
              <motion.div
                key={tagText}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl bg-surface-elevated border border-border/40 overflow-hidden"
              >
                <div className="px-3 py-2 bg-secondary/50 border-b border-border/30">
                  <span className="text-xs font-semibold text-foreground">{tagText}</span>
                </div>
                <div className="divide-y divide-border/20">
                  {items.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                      <span className="text-sm shrink-0">{LANG_FLAGS[t.language] || "🌐"}</span>
                      <span className="text-[10px] text-muted-foreground w-6 shrink-0">{t.language}</span>

                      {editingId === t.id ? (
                        <div className="flex-1 flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEdit(t)}
                            className="flex-1 px-2 py-1 rounded-lg bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald"
                          />
                          <button onClick={() => saveEdit(t)} className="p-1 rounded-lg hover:bg-score-emerald/10 text-score-emerald">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-xs text-foreground truncate">{t.translated_text}</span>
                          <button onClick={() => startEdit(t)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground shrink-0">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteTranslation(t.id)} className="p-1 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
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

export default AdminTagTranslationEditor;
