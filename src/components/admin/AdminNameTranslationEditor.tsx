import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Pencil, Check, X, RefreshCw, Store, UtensilsCrossed, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface NameItem {
  id: string;
  name: string;
  type: "store" | "menu";
  storeName?: string; // for menu items
}

interface TagTranslation {
  id: string;
  tag_text: string;
  language: string;
  translated_text: string;
}

const LANGS = ["en", "ja", "zh", "ko"] as const;
const LANG_FLAGS: Record<string, string> = { en: "🇺🇸", ja: "🇯🇵", zh: "🇨🇳", ko: "🇰🇷" };
const LANG_LABELS: Record<string, string> = { en: "English", ja: "日本語", zh: "中文", ko: "한국어" };

const AdminNameTranslationEditor = () => {
  const [items, setItems] = useState<NameItem[]>([]);
  const [translations, setTranslations] = useState<TagTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "store" | "menu">("all");
  const [editingKey, setEditingKey] = useState<string | null>(null); // "id-lang"
  const [editValue, setEditValue] = useState("");
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [menuBatchProgress, setMenuBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [menuTransCount, setMenuTransCount] = useState(0);
  const [allMenuIds, setAllMenuIds] = useState<string[]>([]);
  const load = async () => {
    setLoading(true);
    const [{ data: stores }, { data: menuItems }] = await Promise.all([
      supabase.from("stores").select("id, name").order("name"),
      supabase.from("menu_items").select("id, name, store_id").order("name"),
    ]);

    // Get store names for menu items
    const storeIds = [...new Set((menuItems || []).map((m) => m.store_id))];
    const storeNameMap = new Map<string, string>();
    (stores || []).forEach((s) => storeNameMap.set(s.id, s.name));

    const nameItems: NameItem[] = [
      ...(stores || []).map((s) => ({ id: s.id, name: s.name, type: "store" as const })),
      ...(menuItems || []).map((m) => ({
        id: m.id,
        name: m.name,
        type: "menu" as const,
        storeName: storeNameMap.get(m.store_id) || "—",
      })),
    ];
    setItems(nameItems);

    // Fetch all translations for these names
    const allNames = [...new Set(nameItems.map((n) => n.name))];
    if (allNames.length > 0) {
      // Fetch in batches of 100
      const allTrans: TagTranslation[] = [];
      for (let i = 0; i < allNames.length; i += 100) {
        const batch = allNames.slice(i, i + 100);
        const { data } = await supabase
          .from("tag_translations")
          .select("id, tag_text, language, translated_text")
          .in("tag_text", batch);
        if (data) allTrans.push(...(data as TagTranslation[]));
      }
      setTranslations(allTrans);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchType = typeFilter === "all" || item.type === typeFilter;
      const matchSearch = !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.storeName || "").toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [items, typeFilter, search]);

  // Build translation map: tag_text -> lang -> TagTranslation
  const transMap = useMemo(() => {
    const map = new Map<string, Map<string, TagTranslation>>();
    translations.forEach((t) => {
      if (!map.has(t.tag_text)) map.set(t.tag_text, new Map());
      map.get(t.tag_text)!.set(t.language, t);
    });
    return map;
  }, [translations]);

  const startEdit = (name: string, lang: string, current: string) => {
    setEditingKey(`${name}::${lang}`);
    setEditValue(current);
  };

  const saveEdit = async (name: string, lang: string) => {
    const val = editValue.trim();
    if (!val) return;

    const existing = transMap.get(name)?.get(lang);
    if (existing) {
      const { error } = await supabase
        .from("tag_translations")
        .update({ translated_text: val } as any)
        .eq("id", existing.id);
      if (error) { toast.error(error.message); return; }
      setTranslations((prev) =>
        prev.map((t) => t.id === existing.id ? { ...t, translated_text: val } : t)
      );
    } else {
      const { data, error } = await supabase
        .from("tag_translations")
        .insert({ tag_text: name, language: lang, translated_text: val } as any)
        .select()
        .single();
      if (error) { toast.error(error.message); return; }
      setTranslations((prev) => [...prev, data as TagTranslation]);
    }
    setEditingKey(null);
    toast.success("บันทึกแล้ว ✓");
  };

  const regenerateAI = async (name: string) => {
    setRegenerating(name);
    try {
      const { data, error } = await supabase.functions.invoke("translate-tags", {
        body: { tags: [name], target_languages: [...LANGS] },
      });
      if (error) throw error;
      if (data?.translations) {
        // Refresh translations for this name
        const { data: updated } = await supabase
          .from("tag_translations")
          .select("id, tag_text, language, translated_text")
          .eq("tag_text", name);
        if (updated) {
          setTranslations((prev) => [
            ...prev.filter((t) => t.tag_text !== name),
            ...(updated as TagTranslation[]),
          ]);
        }
        toast.success(`แปล "${name}" ใหม่สำเร็จ ✓`);
      }
    } catch (e: any) {
      toast.error(e.message || "แปลไม่สำเร็จ");
    } finally {
      setRegenerating(null);
    }
  };

  // Count how many names are missing translations
  const missingCount = useMemo(() => {
    let count = 0;
    items.forEach((item) => {
      const langMap = transMap.get(item.name);
      LANGS.forEach((lang) => {
        if (!langMap?.get(lang)) count++;
      });
    });
    return count;
  }, [items, transMap]);

  const batchTranslateAll = useCallback(async () => {
    // Collect all unique names missing at least one language
    const allNames = [...new Set(items.map((i) => i.name))];
    const namesToTranslate = allNames.filter((name) => {
      const langMap = transMap.get(name);
      return LANGS.some((lang) => !langMap?.get(lang));
    });

    if (namesToTranslate.length === 0) {
      toast.info("ทุกชื่อมีคำแปลครบแล้ว ✓");
      return;
    }

    const BATCH_SIZE = 20;
    const totalBatches = Math.ceil(namesToTranslate.length / BATCH_SIZE);
    setBatchProgress({ current: 0, total: namesToTranslate.length });
    let successCount = 0;

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batch = namesToTranslate.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        setBatchProgress({ current: i * BATCH_SIZE, total: namesToTranslate.length });

        const { data, error } = await supabase.functions.invoke("translate-tags", {
          body: { tags: batch, target_languages: [...LANGS] },
        });
        if (error) {
          console.error(`Batch ${i + 1} error:`, error);
          continue;
        }
        successCount += batch.length;

        // Small delay between batches to avoid rate limits
        if (i < totalBatches - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }

      setBatchProgress(null);
      toast.success(`แปลสำเร็จ ${successCount} ชื่อ ✓`);
      // Reload all translations
      await load();
    } catch (e: any) {
      setBatchProgress(null);
      toast.error(e.message || "Batch translate ล้มเหลว");
    }
  }, [items, transMap]);

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
        <Store size={16} className="text-score-emerald" />
        <h2 className="text-sm font-semibold text-foreground">จัดการคำแปลชื่อร้าน / ชื่อเมนู</h2>
        <span className="text-[10px] text-muted-foreground">
          {items.filter((i) => i.type === "store").length} ร้าน · {items.filter((i) => i.type === "menu").length} เมนู
        </span>
        <button
          onClick={batchTranslateAll}
          disabled={!!batchProgress || missingCount === 0}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-score-emerald text-primary-foreground text-[11px] font-semibold disabled:opacity-50 transition-all hover:opacity-90"
        >
          <Zap size={12} />
          {batchProgress
            ? `กำลังแปล ${batchProgress.current}/${batchProgress.total}...`
            : missingCount > 0
              ? `Batch แปลทั้งหมด (${missingCount} ขาด)`
              : "แปลครบแล้ว ✓"}
        </button>
      </div>

      {/* Search + Type Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อร้านหรือเมนู..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald transition-all placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex gap-1.5">
          {([
            { key: "all", label: "ทั้งหมด", icon: null },
            { key: "store", label: "ร้าน", icon: Store },
            { key: "menu", label: "เมนู", icon: UtensilsCrossed },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                typeFilter === f.key
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {f.icon && <f.icon size={12} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">ไม่พบข้อมูล</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 50).map((item) => {
            const langMap = transMap.get(item.name);
            return (
              <motion.div
                key={`${item.type}-${item.id}`}
                layout
                className="rounded-2xl bg-surface-elevated border border-border/40 overflow-hidden"
              >
                {/* Header */}
                <div className="px-3 py-2 bg-secondary/50 border-b border-border/30 flex items-center gap-2">
                  {item.type === "store" ? (
                    <Store size={12} className="text-score-emerald shrink-0" />
                  ) : (
                    <UtensilsCrossed size={12} className="text-score-amber shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-foreground truncate">{item.name}</span>
                  {item.type === "menu" && item.storeName && (
                    <span className="text-[9px] text-muted-foreground ml-auto shrink-0">@ {item.storeName}</span>
                  )}
                  <button
                    onClick={() => regenerateAI(item.name)}
                    disabled={regenerating === item.name}
                    className="ml-auto p-1 rounded-lg hover:bg-score-emerald/10 text-muted-foreground hover:text-score-emerald disabled:opacity-50 shrink-0"
                    title="AI แปลใหม่"
                  >
                    <RefreshCw size={12} className={regenerating === item.name ? "animate-spin" : ""} />
                  </button>
                </div>

                {/* Translations per lang */}
                <div className="divide-y divide-border/20">
                  {LANGS.map((lang) => {
                    const trans = langMap?.get(lang);
                    const key = `${item.name}::${lang}`;
                    const isEditing = editingKey === key;

                    return (
                      <div key={lang} className="flex items-center gap-2 px-3 py-2">
                        <span className="text-sm shrink-0">{LANG_FLAGS[lang]}</span>
                        <span className="text-[10px] text-muted-foreground w-6 shrink-0">{lang}</span>

                        {isEditing ? (
                          <div className="flex-1 flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveEdit(item.name, lang)}
                              className="flex-1 px-2 py-1 rounded-lg bg-background border border-border text-sm text-foreground outline-none focus:ring-1 focus:ring-score-emerald"
                            />
                            <button onClick={() => saveEdit(item.name, lang)} className="p-1 rounded-lg hover:bg-score-emerald/10 text-score-emerald">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingKey(null)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className={`flex-1 text-xs truncate ${trans ? "text-foreground" : "text-muted-foreground/40 italic"}`}>
                              {trans ? trans.translated_text : "— ยังไม่มีคำแปล —"}
                            </span>
                            <button
                              onClick={() => startEdit(item.name, lang, trans?.translated_text || "")}
                              className="p-1 rounded-lg hover:bg-secondary text-muted-foreground shrink-0"
                            >
                              <Pencil size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
          {filtered.length > 50 && (
            <p className="text-center text-[10px] text-muted-foreground py-2">
              แสดง 50 จาก {filtered.length} รายการ — ใช้ช่องค้นหาเพื่อกรอง
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminNameTranslationEditor;
