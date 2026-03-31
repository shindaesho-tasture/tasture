import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScoreButton from "./ScoreButton";
import { scoreTiers, type CategoryMetric } from "@/lib/categories";
import { useTagTranslations } from "@/hooks/use-tag-translations";

interface MetricRaterProps {
  metric: CategoryMetric;
  value: number | null;
  onChange: (metricId: string, value: number) => void;
  gateState?: Record<string, boolean>;
  onGateChange?: (gateId: string, open: boolean) => void;
  subValues?: Record<string, number | null>;
  onSubChange?: (metricId: string, value: number) => void;
}

const MetricRater = ({
  metric,
  value,
  onChange,
  gateState,
  onGateChange,
  subValues,
  onSubChange,
}: MetricRaterProps) => {
  const hasGate = !!metric.smartGate;
  const gateOpen = gateState?.[metric.id] ?? false;
  const gateAnswered = gateState?.[metric.id] !== undefined;

  // Collect all translatable texts
  const allTexts = useMemo(() => {
    const texts: string[] = [metric.label, ...metric.options];
    if (metric.smartGate) {
      texts.push(metric.smartGate.question);
      if (metric.smartGate.yesLabel) texts.push(metric.smartGate.yesLabel);
      if (metric.smartGate.noLabel) texts.push(metric.smartGate.noLabel);
      metric.smartGate.subMetrics.forEach((sub) => {
        texts.push(sub.label, ...sub.options);
      });
    }
    return texts;
  }, [metric]);

  const { translateTag } = useTagTranslations(allTexts);

  // Contextual label based on score
  const getContextLabel = (score: number | null) => {
    if (score === null) return null;
    if (score === 2) return translateTag(metric.options[0]);
    if (score === -2) return translateTag(metric.options[2]);
    if (score === 0) return translateTag(metric.options[1]);
    return null;
  };

  const getSubContextLabelTranslated = (sub: CategoryMetric, score: number): string | null => {
    if (score === 2) return translateTag(sub.options[0]);
    if (score === -2) return translateTag(sub.options[2]);
    if (score === 0) return translateTag(sub.options[1]);
    return null;
  };

  if (hasGate) {
    return (
      <motion.div
        layout
        className="rounded-2xl bg-surface p-4 space-y-3 border border-border/50"
      >
        {/* Gate Question */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{metric.icon}</span>
            <span className="text-sm font-semibold text-foreground">
              {translateTag(metric.smartGate!.question)}
            </span>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => onGateChange?.(metric.id, true)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                gateAnswered && gateOpen
                  ? "bg-score-emerald text-white"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {translateTag(metric.smartGate!.yesLabel || "มี")}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={() => onGateChange?.(metric.id, false)}
              className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                gateAnswered && !gateOpen
                  ? "bg-score-slate text-white"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {translateTag(metric.smartGate!.noLabel || "ไม่มี")}
            </motion.button>
          </div>
        </div>

        {/* Sub-metrics when gate is open */}
        <AnimatePresence>
          {gateOpen && metric.smartGate!.subMetrics.map((sub) => (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="overflow-hidden"
            >
              <div className="pl-4 border-l-2 border-score-emerald/20 space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{sub.icon}</span>
                  <span className="text-xs font-semibold text-foreground">{translateTag(sub.label)}</span>
                  {subValues?.[sub.id] !== undefined && subValues?.[sub.id] !== null && (
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {getSubContextLabelTranslated(sub, subValues[sub.id]!)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {scoreTiers.map((tier) => (
                    <ScoreButton
                      key={tier.value}
                      {...tier}
                      selected={subValues?.[sub.id] === tier.value}
                      onSelect={(v) => onSubChange?.(sub.id, v)}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      className="rounded-2xl bg-surface p-4 space-y-3 border border-border/50"
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{metric.icon}</span>
        <span className="text-sm font-semibold text-foreground">{translateTag(metric.label)}</span>
        {value !== null && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {getContextLabel(value)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {scoreTiers.map((tier) => (
          <ScoreButton
            key={tier.value}
            {...tier}
            selected={value === tier.value}
            onSelect={(v) => onChange(metric.id, v)}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default MetricRater;
