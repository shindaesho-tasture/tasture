import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, Check, Loader2, Sparkles, Dna } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import DishDnaCard from "@/components/menu/DishDnaCard";
import type { DishAnalysis, DishDnaSelection, DishComponent } from "@/lib/dish-dna-types";

/* ─── Analyzing Animation ─── */
const AnalyzingOverlay = ({ dishName }: { dishName: string }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-6">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      className="relative"
    >
      <div className="w-20 h-20 rounded-full border-[3px] border-border border-t-score-emerald" />
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Dna size={28} className="text-score-emerald" strokeWidth={1.5} />
      </motion.div>
    </motion.div>
    <div className="text-center space-y-1.5">
      <p className="text-sm font-semibold text-foreground">กำลังวิเคราะห์</p>
      <p className="text-base font-medium text-score-emerald">"{dishName}"</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mt-2">
        sovereign culinary ai
      </p>
    </div>
  </div>
);

const DishDnaFeedback = () => {
  const navigate = useNavigate();
  const { menuItemId } = useParams<{ menuItemId: string }>();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [dishName, setDishName] = useState("");
  const [components, setComponents] = useState<DishComponent[]>([]);
  const [analyzing, setAnalyzing] = useState(true);
  const [selections, setSelections] = useState<Record<string, DishDnaSelection>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [existingDna, setExistingDna] = useState<Record<string, DishDnaSelection>>({});

  useEffect(() => {
    if (!menuItemId || authLoading) return;
    loadData();
  }, [menuItemId, user, authLoading]);

  const loadData = async () => {
    if (!menuItemId) return;
    setAnalyzing(true);

    try {
      // Get menu item name
      const { data: item } = await supabase
        .from("menu_items")
        .select("name")
        .eq("id", menuItemId)
        .single();
      if (!item) return;
      setDishName(item.name);

      // Try to load cached template first
      const { data: template } = await supabase
        .from("dish_templates")
        .select("components")
        .eq("dish_name", item.name.trim())
        .single();

      if (template?.components) {
        // Use cached template
        const comps = template.components as unknown as DishComponent[];
        setComponents(comps);
      } else {
        // No cache - call analyze-dish and cache result
        const { data, error } = await supabase.functions.invoke("analyze-dish", {
          body: { dishName: item.name },
        });
        if (error) throw error;
        if (data?.components) {
          setComponents(data.components);
          // Cache it
          await supabase.from("dish_templates").upsert(
            {
              dish_name: item.name.trim(),
              components: data.components,
            },
            { onConflict: "dish_name" }
          );
        }
      }

      // Load existing user DNA
      if (user) {
        const { data: dna } = await supabase
          .from("dish_dna")
          .select("*")
          .eq("menu_item_id", menuItemId)
          .eq("user_id", user.id);
        if (dna && dna.length > 0) {
          const map: Record<string, DishDnaSelection> = {};
          dna.forEach((d: any) => {
            map[d.component_name] = {
              component_name: d.component_name,
              component_icon: d.component_icon,
              selected_score: d.selected_score,
              selected_tag: d.selected_tag,
            };
          });
          setExistingDna(map);
          setSelections(map);
        }
      }
    } catch (err: any) {
      console.error("DishDnaFeedback load error:", err);
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSelect = (componentName: string, componentIcon: string, score: -2 | 0 | 2, tag: string) => {
    setSelections((prev) => {
      const current = prev[componentName];
      if (current?.selected_score === score) {
        const next = { ...prev };
        delete next[componentName];
        return next;
      }
      return {
        ...prev,
        [componentName]: {
          component_name: componentName,
          component_icon: componentIcon,
          selected_score: score,
          selected_tag: tag,
        },
      };
    });
  };

  const changedCount = useMemo(() => {
    let count = 0;
    components.forEach((c) => {
      const newSel = selections[c.name];
      const oldSel = existingDna[c.name];
      if (JSON.stringify(newSel) !== JSON.stringify(oldSel)) count++;
    });
    return count;
  }, [selections, existingDna, components]);

  const selectedCount = Object.keys(selections).length;
  const totalComponents = components.length;
  const progress = totalComponents > 0 ? (selectedCount / totalComponents) * 100 : 0;

  const handleSubmit = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!menuItemId) return;
    setSaving(true);
    try {
      await supabase
        .from("dish_dna")
        .delete()
        .eq("menu_item_id", menuItemId)
        .eq("user_id", user.id);

      const rows = Object.values(selections).map((s) => ({
        menu_item_id: menuItemId,
        user_id: user.id,
        component_name: s.component_name,
        component_icon: s.component_icon,
        selected_score: s.selected_score,
        selected_tag: s.selected_tag,
      }));

      if (rows.length > 0) {
        const { error } = await supabase.from("dish_dna").insert(rows);
        if (error) throw error;
      }

      setSaveSuccess(true);
      toast({ title: "✅ บันทึก Dish DNA สำเร็จ", description: `${rows.length} ส่วนประกอบ` });
      setTimeout(() => {
        setSaveSuccess(false);
        navigate(-1);
      }, 1500);
    } catch (err: any) {
      console.error("Save dish DNA error:", err);
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-36">
        {/* ─── Header ─── */}
        <div className="sticky top-0 z-20 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
                {dishName || "Dish DNA"}
              </h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
                เลือกแท็กที่ตรงกับความรู้สึก
              </p>
            </div>
            {!analyzing && totalComponents > 0 && (
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground tabular-nums">{selectedCount}</span>
                  <span className="text-[10px] text-muted-foreground">/{totalComponents}</span>
                </div>
                <div className="w-10 h-1.5 rounded-full bg-border overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-score-emerald"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Content ─── */}
        {analyzing ? (
          <AnalyzingOverlay dishName={dishName} />
        ) : components.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-28 gap-5"
          >
            <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center">
              <Dna size={36} className="text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">ไม่สามารถวิเคราะห์ได้</p>
              <p className="text-[11px] text-muted-foreground mt-1">ลองกลับไปเลือกเมนูอื่น</p>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="px-5 pt-5 pb-2"
            >
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-score-emerald/5 border border-score-emerald/10">
                <Sparkles size={16} className="text-score-emerald mt-0.5 shrink-0" strokeWidth={1.5} />
              <div>
                  <p className="text-[11px] font-medium text-foreground leading-relaxed">
                    แตะส่วนประกอบเพื่อเปิดแท็ก แล้วเลือกแท็กที่ตรงกับความรู้สึก
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-score-emerald mr-0.5 align-middle" /> สุดยอด ·
                    <span className="inline-block w-2 h-2 rounded-full bg-score-slate mx-0.5 align-middle" /> ปกติ ·
                    <span className="inline-block w-2 h-2 rounded-full bg-score-ruby mx-0.5 align-middle" /> ผิดหวัง
                  </p>
                </div>
              </div>
            </motion.div>

            <div className="px-4 pt-3 space-y-4">
              {components.map((comp, i) => (
                <DishDnaCard
                  key={comp.name}
                  component={comp}
                  selection={selections[comp.name] || null}
                  onSelect={(score, tag) => handleSelect(comp.name, comp.icon, score, tag)}
                  index={i}
                />
              ))}
            </div>
          </>
        )}

        {/* ─── Floating Submit ─── */}
        <AnimatePresence>
          {!analyzing && components.length > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-20 left-0 right-0 px-4 z-10"
            >
              <div className="p-1 rounded-[22px] bg-surface-elevated shadow-card-elevated border border-border/30">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={changedCount === 0 || saving}
                  className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[18px] bg-foreground text-background font-semibold text-sm transition-all disabled:opacity-25"
                >
                  <AnimatePresence mode="wait">
                    {saving ? (
                      <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Loader2 size={18} className="animate-spin" />
                      </motion.div>
                    ) : saveSuccess ? (
                      <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2">
                        <Check size={18} strokeWidth={2.5} />
                        <span>สำเร็จ!</span>
                      </motion.div>
                    ) : (
                      <motion.div key="default" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                        <Dna size={18} strokeWidth={2} />
                        <span>
                          บันทึก Dish DNA
                          {changedCount > 0 && <span className="ml-1 opacity-60">({changedCount} เปลี่ยน)</span>}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default DishDnaFeedback;
