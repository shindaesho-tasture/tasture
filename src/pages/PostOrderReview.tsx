import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Dna,
  Sparkles,
  Store,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useOrder } from "@/lib/order-context";
import { categories, scoreTiers, getScoreTier, type Category } from "@/lib/categories";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import MetricRater from "@/components/MetricRater";
import DishDnaCard from "@/components/menu/DishDnaCard";
import SensorySliderCard from "@/components/menu/SensorySliderCard";
import BalanceSpiderChart from "@/components/menu/BalanceSpiderChart";
import type { DishComponent, DishDnaSelection } from "@/lib/dish-dna-types";
import type { SensoryAxis } from "@/lib/sensory-types";

/* ─── Step Types ─── */
type StepType = "store-review" | "dish-dna" | "sensory" | "results";

interface Step {
  type: StepType;
  label: string;
  icon: string;
  menuItemId?: string;
  menuItemName?: string;
}

/* ─── Combined Result ─── */
interface CombinedResult {
  storeScore: number | null;
  storeMetricCount: number;
  dishScores: { name: string; dnaScore: number | null; sensoryScore: number | null }[];
  overallScore: number | null;
}

const PostOrderReview = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, storeId, storeName, clearOrder } = useOrder();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  // Store review state
  const [storeScores, setStoreScores] = useState<Record<string, number | null>>({});
  const [gateState, setGateState] = useState<Record<string, boolean>>({});
  const [subScores, setSubScores] = useState<Record<string, number | null>>({});

  // Dish DNA state per menu item
  const [dnaComponents, setDnaComponents] = useState<Record<string, DishComponent[]>>({});
  const [dnaSelections, setDnaSelections] = useState<Record<string, Record<string, DishDnaSelection>>>({});
  const [dnaLoading, setDnaLoading] = useState<Record<string, boolean>>({});

  // Sensory state per menu item
  const [sensoryAxes, setSensoryAxes] = useState<Record<string, SensoryAxis[]>>({});
  const [sensoryValues, setSensoryValues] = useState<Record<string, Record<string, number>>>({});
  const [sensoryLoading, setSensoryLoading] = useState<Record<string, boolean>>({});

  const [saving, setSaving] = useState(false);

  // Build steps
  const steps = useMemo<Step[]>(() => {
    const s: Step[] = [{ type: "store-review", label: "รีวิวร้าน", icon: "🏪" }];
    items.forEach((item) => {
      s.push({ type: "dish-dna", label: item.name, icon: "🧬", menuItemId: item.menuItemId, menuItemName: item.name });
    });
    items.forEach((item) => {
      s.push({ type: "sensory", label: item.name, icon: "🎯", menuItemId: item.menuItemId, menuItemName: item.name });
    });
    s.push({ type: "results", label: "สรุปผล", icon: "📊" });
    return s;
  }, [items]);

  const step = steps[currentStep];
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Redirect if no order
  useEffect(() => {
    if (!storeId || items.length === 0) {
      navigate("/store-list");
    }
  }, [storeId, items, navigate]);

  // Load store category
  useEffect(() => {
    if (!storeId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("stores").select("category_id").eq("id", storeId).single();
      if (data?.category_id) {
        const cat = categories.find((c) => c.id === data.category_id);
        setCategory(cat || categories[0]);
      } else {
        setCategory(categories[0]);
      }
      setLoading(false);
    })();
  }, [storeId]);

  // Load Dish DNA when step changes to dish-dna
  useEffect(() => {
    if (step?.type !== "dish-dna" || !step.menuItemId || !step.menuItemName) return;
    const id = step.menuItemId;
    if (dnaComponents[id]) return; // already loaded

    (async () => {
      setDnaLoading((prev) => ({ ...prev, [id]: true }));
      try {
        // Check cache
        const { data: template } = await supabase
          .from("dish_templates")
          .select("components")
          .eq("dish_name", step.menuItemName!.trim())
          .single();

        if (template?.components) {
          setDnaComponents((prev) => ({ ...prev, [id]: template.components as unknown as DishComponent[] }));
        } else {
          const { data, error } = await supabase.functions.invoke("analyze-dish", {
            body: { dishName: step.menuItemName },
          });
          if (error) throw error;
          if (data?.components) {
            setDnaComponents((prev) => ({ ...prev, [id]: data.components }));
            await supabase.from("dish_templates").upsert(
              { dish_name: step.menuItemName!.trim(), components: data.components },
              { onConflict: "dish_name" }
            );
          }
        }
      } catch (err) {
        console.error("DNA load error:", err);
      } finally {
        setDnaLoading((prev) => ({ ...prev, [id]: false }));
      }
    })();
  }, [currentStep, step]);

  // Load Sensory when step changes to sensory
  useEffect(() => {
    if (step?.type !== "sensory" || !step.menuItemId || !step.menuItemName) return;
    const id = step.menuItemId;
    if (sensoryAxes[id]) return;

    (async () => {
      setSensoryLoading((prev) => ({ ...prev, [id]: true }));
      try {
        const { data, error } = await supabase.functions.invoke("analyze-sensory", {
          body: { dishName: step.menuItemName },
        });
        if (error) throw error;
        if (data?.axes) {
          setSensoryAxes((prev) => ({ ...prev, [id]: data.axes }));
          const defaults: Record<string, number> = {};
          data.axes.forEach((a: SensoryAxis) => { defaults[a.name] = 3; });
          setSensoryValues((prev) => ({ ...prev, [id]: defaults }));
        }
      } catch (err) {
        console.error("Sensory load error:", err);
      } finally {
        setSensoryLoading((prev) => ({ ...prev, [id]: false }));
      }
    })();
  }, [currentStep, step]);

  // ─── Store Review Handlers ───
  const handleStoreScore = (metricId: string, value: number) => {
    setStoreScores((prev) => ({ ...prev, [metricId]: prev[metricId] === value ? null : value }));
  };

  const handleGate = (gateId: string, open: boolean) => {
    setGateState((prev) => ({ ...prev, [gateId]: open }));
    if (!open) {
      const metric = category?.metrics.find((m) => m.id === gateId);
      if (metric?.smartGate) {
        const cleared: Record<string, number | null> = {};
        metric.smartGate.subMetrics.forEach((sub) => { cleared[sub.id] = null; });
        setSubScores((prev) => ({ ...prev, ...cleared }));
      }
    }
  };

  const handleSubScore = (metricId: string, value: number) => {
    setSubScores((prev) => ({ ...prev, [metricId]: prev[metricId] === value ? null : value }));
  };

  // ─── DNA Handlers ───
  const handleDnaSelect = (menuItemId: string, componentName: string, componentIcon: string, score: -2 | 0 | 2, tag: string) => {
    setDnaSelections((prev) => {
      const itemSelections = { ...(prev[menuItemId] || {}) };
      const current = itemSelections[componentName];
      if (current?.selected_score === score) {
        delete itemSelections[componentName];
      } else {
        itemSelections[componentName] = {
          component_name: componentName,
          component_icon: componentIcon,
          selected_score: score,
          selected_tag: tag,
        };
      }
      return { ...prev, [menuItemId]: itemSelections };
    });
  };

  // ─── Sensory Handlers ───
  const handleSensoryChange = (menuItemId: string, axisName: string, level: number) => {
    setSensoryValues((prev) => ({
      ...prev,
      [menuItemId]: { ...(prev[menuItemId] || {}), [axisName]: level },
    }));
  };

  // ─── Compute Results ───
  const computeResults = (): CombinedResult => {
    // Store score
    const storeVals: number[] = [];
    if (category) {
      category.metrics.forEach((m) => {
        if (m.smartGate) {
          if (gateState[m.id]) {
            m.smartGate.subMetrics.forEach((sub) => {
              const v = subScores[sub.id];
              if (v !== null && v !== undefined) storeVals.push(v);
            });
          }
        } else {
          const v = storeScores[m.id];
          if (v !== null && v !== undefined) storeVals.push(v);
        }
      });
    }
    const storeScore = storeVals.length > 0 ? storeVals.reduce((a, b) => a + b, 0) / storeVals.length : null;

    // Per-dish scores
    const dishScores = items.map((item) => {
      const id = item.menuItemId;
      // DNA average
      const sel = dnaSelections[id] || {};
      const dnaVals = Object.values(sel).map((s) => s.selected_score);
      const dnaScore = dnaVals.length > 0 ? dnaVals.reduce((a, b) => a + b, 0) / dnaVals.length : null;

      // Sensory balance
      const axes = sensoryAxes[id] || [];
      const vals = sensoryValues[id] || {};
      let sensoryScore: number | null = null;
      if (axes.length > 0) {
        const levels = Object.values(vals);
        if (levels.length > 0) {
          const balanceDistance = levels.reduce((sum, v) => sum + Math.abs(v - 3), 0) / levels.length;
          sensoryScore = Math.round((2 - balanceDistance * 2) * 10) / 10;
        }
      }

      return { name: item.name, dnaScore, sensoryScore };
    });

    // Overall combined
    const allScores: number[] = [];
    if (storeScore !== null) allScores.push(storeScore);
    dishScores.forEach((d) => {
      if (d.dnaScore !== null) allScores.push(d.dnaScore);
      if (d.sensoryScore !== null) allScores.push(d.sensoryScore);
    });
    const overallScore = allScores.length > 0 ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null;

    return { storeScore, storeMetricCount: storeVals.length, dishScores, overallScore };
  };

  // ─── Save All ───
  const handleSaveAll = async () => {
    if (!user || !storeId) { navigate("/auth"); return; }
    setSaving(true);
    try {
      // Save store reviews
      const storeRows: { store_id: string; user_id: string; metric_id: string; score: number }[] = [];
      if (category) {
        category.metrics.forEach((m) => {
          if (m.smartGate) {
            if (gateState[m.id]) {
              m.smartGate.subMetrics.forEach((sub) => {
                const v = subScores[sub.id];
                if (v !== null && v !== undefined) {
                  storeRows.push({ store_id: storeId, user_id: user.id, metric_id: sub.id, score: v });
                }
              });
            }
          } else {
            const v = storeScores[m.id];
            if (v !== null && v !== undefined) {
              storeRows.push({ store_id: storeId, user_id: user.id, metric_id: m.id, score: v });
            }
          }
        });
      }
      if (storeRows.length > 0) {
        await supabase.from("reviews").upsert(storeRows, { onConflict: "store_id,user_id,metric_id" });
      }

      // Save dish DNA per item
      for (const item of items) {
        const sel = dnaSelections[item.menuItemId] || {};
        const rows = Object.values(sel).map((s) => ({
          menu_item_id: item.menuItemId,
          user_id: user.id,
          component_name: s.component_name,
          component_icon: s.component_icon,
          selected_score: s.selected_score,
          selected_tag: s.selected_tag,
        }));
        if (rows.length > 0) {
          await supabase.from("dish_dna").delete().eq("menu_item_id", item.menuItemId).eq("user_id", user.id);
          await supabase.from("dish_dna").insert(rows);
        }
      }

      // Save sensory as menu_reviews (average balance score)
      for (const item of items) {
        const axes = sensoryAxes[item.menuItemId] || [];
        const vals = sensoryValues[item.menuItemId] || {};
        if (axes.length > 0) {
          const levels = Object.values(vals);
          if (levels.length > 0) {
            const balanceDistance = levels.reduce((sum, v) => sum + Math.abs(v - 3), 0) / levels.length;
            // Map to allowed values: {-2, 0, 2}
            const score = balanceDistance <= 0.5 ? 2 : balanceDistance <= 1.5 ? 0 : -2;
            await supabase.from("menu_reviews").upsert(
              { menu_item_id: item.menuItemId, user_id: user.id, score },
              { onConflict: "menu_item_id,user_id" }
            );
          }
        }
      }

      toast({ title: "✅ บันทึกรีวิวทั้งหมดสำเร็จ" });
    } catch (err: any) {
      console.error("Save error:", err);
      toast({ title: "บันทึกไม่สำเร็จ", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    clearOrder();
    navigate("/");
  };

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      // Auto-save on results step
      if (steps[currentStep + 1].type === "results") handleSaveAll();
      setCurrentStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
    else navigate(-1);
  };

  if (loading || authLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
        </div>
      </PageTransition>
    );
  }

  const results = step?.type === "results" ? computeResults() : null;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-32">
        {/* ─── Header ─── */}
        <div className="sticky top-0 z-20 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <motion.button whileTap={{ scale: 0.9 }} onClick={goBack} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
                {step?.icon} {step?.type === "store-review" ? "รีวิวร้าน" : step?.type === "dish-dna" ? `DNA: ${step.menuItemName}` : step?.type === "sensory" ? `รสชาติ: ${step.menuItemName}` : "สรุปผลรีวิว"}
              </h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-0.5">
                {storeName} · {currentStep + 1}/{totalSteps}
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-[2px] bg-border">
            <motion.div className="h-full bg-score-emerald" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
          </div>
        </div>

        {/* ─── Step Content ─── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {/* Store Review */}
            {step?.type === "store-review" && category && (
              <div className="px-4 pt-4 space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-score-emerald/5 border border-score-emerald/10">
                  <Store size={16} className="text-score-emerald mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-[11px] font-medium text-foreground">{category.labelTh}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">ให้คะแนนประสบการณ์ร้านอาหาร</p>
                  </div>
                </div>
                {category.metrics.map((metric, i) => (
                  <motion.div key={metric.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <MetricRater
                      metric={metric}
                      value={storeScores[metric.id] ?? null}
                      onChange={handleStoreScore}
                      gateState={gateState}
                      onGateChange={handleGate}
                      subValues={subScores}
                      onSubChange={handleSubScore}
                    />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Dish DNA */}
            {step?.type === "dish-dna" && step.menuItemId && (
              <div className="px-4 pt-4 space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-score-emerald/5 border border-score-emerald/10">
                  <Dna size={16} className="text-score-emerald mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-[11px] font-medium text-foreground">เลือกแท็กที่ตรงกับความรู้สึก</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-score-emerald mr-0.5 align-middle" /> สุดยอด ·
                      <span className="inline-block w-2 h-2 rounded-full bg-score-slate mx-0.5 align-middle" /> ปกติ ·
                      <span className="inline-block w-2 h-2 rounded-full bg-score-ruby mx-0.5 align-middle" /> ผิดหวัง
                    </p>
                  </div>
                </div>
                {dnaLoading[step.menuItemId] ? (
                  <AnalyzingSpinner label="กำลังวิเคราะห์ส่วนประกอบ..." />
                ) : (dnaComponents[step.menuItemId] || []).length === 0 ? (
                  <EmptyState label="ไม่สามารถวิเคราะห์ได้" />
                ) : (
                  (dnaComponents[step.menuItemId] || []).map((comp, i) => (
                    <DishDnaCard
                      key={comp.name}
                      component={comp}
                      selection={(dnaSelections[step.menuItemId!] || {})[comp.name] || null}
                      onSelect={(score, tag) => handleDnaSelect(step.menuItemId!, comp.name, comp.icon, score, tag)}
                      index={i}
                    />
                  ))
                )}
              </div>
            )}

            {/* Sensory Feedback */}
            {step?.type === "sensory" && step.menuItemId && (
              <div className="px-4 pt-4 space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-score-emerald/5 border border-score-emerald/10">
                  <Sparkles size={16} className="text-score-emerald mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div>
                    <p className="text-[11px] font-medium text-foreground">ปรับระดับรสชาติ</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Level 3 = สมดุลพอดี (เขียวมรกต)</p>
                  </div>
                </div>
                {sensoryLoading[step.menuItemId] ? (
                  <AnalyzingSpinner label="AI กำลังวิเคราะห์แกนรสชาติ..." />
                ) : (sensoryAxes[step.menuItemId] || []).length === 0 ? (
                  <EmptyState label="ไม่สามารถวิเคราะห์ได้" />
                ) : (
                  <>
                    {(sensoryAxes[step.menuItemId] || []).length >= 3 && (
                      <div className="bg-secondary/30 rounded-2xl p-4">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-[0.15em] mb-2 text-center">
                          Balance Spider Chart
                        </p>
                        <BalanceSpiderChart
                          axes={sensoryAxes[step.menuItemId] || []}
                          values={sensoryValues[step.menuItemId] || {}}
                        />
                      </div>
                    )}
                    {(sensoryAxes[step.menuItemId] || []).map((axis, i) => (
                      <SensorySliderCard
                        key={axis.name}
                        axis={axis}
                        value={(sensoryValues[step.menuItemId!] || {})[axis.name] ?? 3}
                        onChange={(level) => handleSensoryChange(step.menuItemId!, axis.name, level)}
                        index={i}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Results */}
            {step?.type === "results" && results && (
              <div className="px-4 pt-4 space-y-4">
                {/* Overall Score */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="flex flex-col items-center py-8 gap-4"
                >
                  <div className={cn(
                    "w-24 h-24 rounded-full flex items-center justify-center border-4",
                    results.overallScore !== null && results.overallScore >= 1 ? "border-score-emerald bg-score-emerald/10" :
                    results.overallScore !== null && results.overallScore >= 0 ? "border-score-mint bg-score-mint/10" :
                    results.overallScore !== null && results.overallScore >= -1 ? "border-score-amber bg-score-amber/10" :
                    "border-score-ruby bg-score-ruby/10"
                  )}>
                    <span className={cn(
                      "text-2xl font-bold tabular-nums",
                      results.overallScore !== null && results.overallScore >= 1 ? "text-score-emerald" :
                      results.overallScore !== null && results.overallScore >= 0 ? "text-score-mint" :
                      results.overallScore !== null && results.overallScore >= -1 ? "text-score-amber" :
                      "text-score-ruby"
                    )}>
                      {results.overallScore !== null ? (results.overallScore > 0 ? "+" : "") + results.overallScore.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-foreground">คะแนนรวม</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{storeName}</p>
                  </div>
                </motion.div>

                {/* Store Review Score */}
                {results.storeScore !== null && (
                  <ScoreSection
                    icon="🏪"
                    title="ประสบการณ์ร้าน"
                    score={results.storeScore}
                    subtitle={`${results.storeMetricCount} ตัวชี้วัด`}
                  />
                )}

                {/* Dish Scores */}
                {results.dishScores.map((dish, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="rounded-2xl bg-surface-elevated border border-border/50 shadow-luxury p-4 space-y-3"
                  >
                    <h3 className="text-sm font-semibold text-foreground">{dish.name}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {dish.dnaScore !== null && (
                        <div className="p-3 rounded-xl bg-secondary/50 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Dish DNA</p>
                          <p className={cn(
                            "text-lg font-bold mt-1 tabular-nums",
                            dish.dnaScore >= 1 ? "text-score-emerald" :
                            dish.dnaScore >= 0 ? "text-score-mint" :
                            dish.dnaScore >= -1 ? "text-score-amber" : "text-score-ruby"
                          )}>
                            {dish.dnaScore > 0 ? "+" : ""}{dish.dnaScore.toFixed(1)}
                          </p>
                        </div>
                      )}
                      {dish.sensoryScore !== null && (
                        <div className="p-3 rounded-xl bg-secondary/50 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">รสชาติ</p>
                          <p className={cn(
                            "text-lg font-bold mt-1 tabular-nums",
                            dish.sensoryScore >= 1 ? "text-score-emerald" :
                            dish.sensoryScore >= 0 ? "text-score-mint" :
                            dish.sensoryScore >= -1 ? "text-score-amber" : "text-score-ruby"
                          )}>
                            {dish.sensoryScore > 0 ? "+" : ""}{dish.sensoryScore.toFixed(1)}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* ─── Bottom Navigation ─── */}
        <div className="fixed bottom-0 left-0 right-0 z-30 glass-effect glass-border">
          <div className="px-4 py-4 flex gap-3">
            {step?.type === "results" ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleFinish}
                className="flex-1 py-3.5 rounded-2xl bg-foreground text-background text-sm font-bold"
              >
                กลับหน้าหลัก
              </motion.button>
            ) : (
              <>
                {currentStep > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={goBack}
                    className="px-5 py-3.5 rounded-2xl bg-secondary text-foreground text-sm font-medium"
                  >
                    ย้อนกลับ
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={goNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-score-emerald text-primary-foreground text-sm font-bold shadow-luxury"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <span>{currentStep === totalSteps - 2 ? "ดูผลสรุป" : "ถัดไป"}</span>
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </>
                  )}
                </motion.button>
              </>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

/* ─── Helpers ─── */
const AnalyzingSpinner = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center py-16 gap-3">
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-10 h-10 rounded-full border-[2px] border-border border-t-score-emerald" />
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center py-16 gap-3">
    <Dna size={32} className="text-muted-foreground" />
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
);

const ScoreSection = ({ icon, title, score, subtitle }: { icon: string; title: string; score: number; subtitle: string }) => {
  const tier = getScoreTier(score);
  const colorMap: Record<string, string> = {
    emerald: "text-score-emerald",
    mint: "text-score-mint",
    slate: "text-score-slate",
    amber: "text-score-amber",
    ruby: "text-score-ruby",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-2xl bg-surface-elevated border border-border/50 shadow-luxury p-4 flex items-center gap-4"
    >
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <span className={cn("text-xl font-bold tabular-nums", colorMap[tier])}>
        {score > 0 ? "+" : ""}{score.toFixed(1)}
      </span>
    </motion.div>
  );
};

export default PostOrderReview;
