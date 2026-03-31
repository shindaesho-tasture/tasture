import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Sparkles, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage, LANGUAGES, type AppLanguage } from "@/lib/language-context";
import { toast } from "sonner";

interface Translation {
  language: string;
  name: string;
  description: string;
}

interface MenuTranslationSheetProps {
  open: boolean;
  onClose: () => void;
  menuItemId: string;
  menuItemName: string;
  menuItemDescription?: string | null;
}

const TARGET_LANGS = LANGUAGES.filter((l) => l.code !== "th");

const MenuTranslationSheet = ({ open, onClose, menuItemId, menuItemName, menuItemDescription }: MenuTranslationSheetProps) => {
  const { t } = useLanguage();
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchTranslations();
  }, [open, menuItemId]);

  const fetchTranslations = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("menu_translations")
      .select("language, name, description")
      .eq("menu_item_id", menuItemId);
    const map: Record<string, Translation> = {};
    (data || []).forEach((row: any) => {
      map[row.language] = { language: row.language, name: row.name, description: row.description || "" };
    });
    setTranslations(map);
    setLoading(false);
  };

  const handleAiTranslate = async () => {
    setAiLoading(true);
    try {
      const emptyLangs = TARGET_LANGS.filter((l) => !translations[l.code]?.name).map((l) => l.code);
      const langsToTranslate = emptyLangs.length > 0 ? emptyLangs : TARGET_LANGS.map((l) => l.code);

      const { data, error } = await supabase.functions.invoke("translate-menu", {
        body: { menu_item_ids: [menuItemId], target_languages: langsToTranslate },
      });
      if (error) throw error;
      await fetchTranslations();
      toast.success("AI แปลสำเร็จ ✓");
    } catch (e: any) {
      toast.error(e.message || "แปลไม่สำเร็จ");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rows = Object.values(translations).filter((t) => t.name.trim());
      if (rows.length === 0) {
        toast.error("กรุณากรอกชื่อแปลอย่างน้อย 1 ภาษา");
        setSaving(false);
        return;
      }
      const upsertData = rows.map((t) => ({
        menu_item_id: menuItemId,
        language: t.language,
        name: t.name.trim(),
        description: t.description.trim() || null,
      }));
      const { error } = await supabase
        .from("menu_translations")
        .upsert(upsertData as any, { onConflict: "menu_item_id,language" });
      if (error) throw error;
      toast.success(t("common.save") + " ✓");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (lang: string, field: "name" | "description", value: string) => {
    setTranslations((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], language: lang, [field]: value, ...(prev[lang] ? {} : { name: "", description: "" }) },
    }));
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/40 flex items-end justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-background rounded-t-3xl max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-background z-10 px-5 pt-5 pb-3 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">🌐 แปลเมนู</h2>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{menuItemName}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* AI translate button */}
          <button
            onClick={handleAiTranslate}
            disabled={aiLoading}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-primary/80 to-primary/60 text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {aiLoading ? "กำลังแปล..." : "AI แปลอัตโนมัติ"}
          </button>
        </div>

        {/* Translation fields per language */}
        <div className="px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            TARGET_LANGS.map((lang) => {
              const tr = translations[lang.code] || { language: lang.code, name: "", description: "" };
              return (
                <div key={lang.code} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{lang.flag}</span>
                    <span className="text-sm font-medium text-foreground">{lang.nativeLabel}</span>
                  </div>
                  <input
                    type="text"
                    value={tr.name}
                    onChange={(e) => updateField(lang.code, "name", e.target.value)}
                    placeholder={`ชื่อเมนู (${lang.label})`}
                    className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50"
                  />
                  <textarea
                    value={tr.description}
                    onChange={(e) => updateField(lang.code, "description", e.target.value)}
                    placeholder={`คำอธิบาย (${lang.label})`}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-secondary text-sm text-foreground outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/50 resize-none"
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Save button */}
        <div className="sticky bottom-0 bg-background px-5 py-4 border-t border-border/30">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-score-emerald text-primary-foreground font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {t("common.save")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MenuTranslationSheet;
