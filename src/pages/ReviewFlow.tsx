import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Check, RotateCcw } from "lucide-react";
import { categories, scoreTiers } from "@/lib/categories";
import MetricRater from "@/components/MetricRater";
import ResultCard from "@/components/ResultCard";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { toast } from "@/hooks/use-toast";
import type { ResultCardData, MetricScore } from "@/lib/scoring";

const ReviewFlow = () => {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = categories.find((c) => c.id === categoryId);

  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [gateState, setGateState] = useState<Record<string, boolean>>({});
  const [subScores, setSubScores] = useState<Record<string, number | null>>({});
  const [showResult, setShowResult] = useState(false);

  const filledCount = useMemo(() => {
    if (!category) return 0;
    let count = 0;
    category.metrics.forEach((m) => {
      if (m.smartGate) {
        if (gateState[m.id] !== undefined) {
          count++;
          if (gateState[m.id]) {
            m.smartGate.subMetrics.forEach((sub) => {
              if (subScores[sub.id] !== null && subScores[sub.id] !== undefined) count++;
            });
          }
        }
      } else {
        if (scores[m.id] !== null && scores[m.id] !== undefined) count++;
      }
    });
    return count;
  }, [scores, gateState, subScores, category]);

  const totalMetrics = useMemo(() => {
    if (!category) return 0;
    let count = 0;
    category.metrics.forEach((m) => {
      if (m.smartGate) {
        count++;
        if (gateState[m.id]) count += m.smartGate.subMetrics.length;
      } else {
        count++;
      }
    });
    return count;
  }, [category, gateState]);

  // Build ResultCardData from user scores
  const resultData = useMemo<ResultCardData | null>(() => {
    if (!category) return null;
    const metricScores: MetricScore[] = [];

    category.metrics.forEach((m) => {
      if (m.smartGate) {
        if (gateState[m.id]) {
          m.smartGate.subMetrics.forEach((sub) => {
            const val = subScores[sub.id];
            if (val !== null && val !== undefined) {
              metricScores.push({
                id: sub.id,
                label: sub.label,
                icon: sub.icon,
                score: val,
                reviewCount: 1,
                positiveLabel: sub.options[0],
                neutralLabel: sub.options[1],
                negativeLabel: sub.options[2],
              });
            }
          });
        }
      } else {
        const val = scores[m.id];
        if (val !== null && val !== undefined) {
          metricScores.push({
            id: m.id,
            label: m.label,
            icon: m.icon,
            score: val,
            reviewCount: 1,
            positiveLabel: m.options[0],
            neutralLabel: m.options[1],
            negativeLabel: m.options[2],
          });
        }
      }
    });

    return {
      id: `review-${categoryId}`,
      name: "รีวิวของคุณ",
      categoryIcon: category.icon,
      categoryLabel: category.label,
      metrics: metricScores,
    };
  }, [category, categoryId, scores, subScores, gateState]);

  if (!category) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">ไม่พบหมวดหมู่นี้</p>
      </div>
    );
  }

  const handleScore = (metricId: string, value: number) => {
    setScores((prev) => ({
      ...prev,
      [metricId]: prev[metricId] === value ? null : value,
    }));
  };

  const handleGate = (gateId: string, open: boolean) => {
    setGateState((prev) => ({ ...prev, [gateId]: open }));
    if (!open) {
      const metric = category.metrics.find((m) => m.id === gateId);
      if (metric?.smartGate) {
        const cleared: Record<string, number | null> = {};
        metric.smartGate.subMetrics.forEach((sub) => {
          cleared[sub.id] = null;
        });
        setSubScores((prev) => ({ ...prev, ...cleared }));
      }
    }
  };

  const handleSubScore = (metricId: string, value: number) => {
    setSubScores((prev) => ({
      ...prev,
      [metricId]: prev[metricId] === value ? null : value,
    }));
  };

  const progress = totalMetrics > 0 ? (filledCount / totalMetrics) * 100 : 0;

  const handleSubmit = () => {
    toast({
      title: "✅ บันทึกรีวิวสำเร็จ",
      description: `${category.labelTh} — ${filledCount}/${totalMetrics} metrics rated`,
    });
    setShowResult(true);
  };

  const handleReset = () => {
    setShowResult(false);
    setScores({});
    setGateState({});
    setSubScores({});
  };

  // ─── Result View ───
  if (showResult && resultData && resultData.metrics.length > 0) {
    return (
      <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate("/categories")}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold tracking-tight text-foreground">
                สรุปผลรีวิว
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {category.label}
              </p>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="px-4 pt-4"
        >
          <ResultCard data={resultData} />
        </motion.div>

        {/* Actions */}
        <div className="px-4 pt-4 space-y-2.5">
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-secondary text-foreground font-semibold text-sm"
          >
            <RotateCcw size={16} strokeWidth={2} />
            รีวิวอีกครั้ง
          </motion.button>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/categories")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-foreground text-background font-semibold text-sm shadow-luxury"
          >
            กลับหน้าหมวดหมู่
          </motion.button>
        </div>

        <BottomNav />
      </div>
    );
  }

  // ─── Rating View ───
  return (
    <div className="min-h-screen bg-background pb-32">
      <div className="sticky top-0 z-10 glass-effect glass-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate("/categories")}
            className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{category.icon}</span>
              <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
                {category.labelTh}
              </h1>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
              {category.label}
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {filledCount}/{totalMetrics}
          </span>
        </div>
        <div className="h-[2px] bg-border">
          <motion.div
            className="h-full bg-score-emerald"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="px-4 pt-4 space-y-3"
      >
        {category.metrics.map((metric, index) => (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <MetricRater
              metric={metric}
              value={scores[metric.id] ?? null}
              onChange={handleScore}
              gateState={gateState}
              onGateChange={handleGate}
              subValues={subScores}
              onSubChange={handleSubScore}
            />
          </motion.div>
        ))}
      </motion.div>

      <div className="fixed bottom-20 left-0 right-0 px-4 z-10">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={filledCount === 0}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-foreground text-background font-semibold text-sm shadow-luxury transition-opacity disabled:opacity-30"
        >
          <Check size={18} strokeWidth={2} />
          บันทึกรีวิว
        </motion.button>
      </div>

      <BottomNav />
    </div>
  );
};

export default ReviewFlow;
