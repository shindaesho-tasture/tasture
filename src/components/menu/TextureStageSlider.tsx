import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TextureStageValues {
  initial: number;
  mastication: number;
  residual: number;
}

interface TextureStageSliderProps {
  dishName: string;
  values: TextureStageValues;
  onChange: (values: TextureStageValues) => void;
  translateTag?: (t: string) => string;
}

const STAGES = [
  {
    key: "initial" as const,
    emoji: "🦷",
    labelTh: "คำแรก",
    labelEn: "Initial Bite",
    desc: "ความรู้สึกแรกเมื่อกัดคำแรก",
    labels: ["นุ่มละลาย", "นุ่ม", "พอดี", "เด้งหนึบ", "แข็งกรอบ"],
  },
  {
    key: "mastication" as const,
    emoji: "🫠",
    labelTh: "เคี้ยว",
    labelEn: "Mastication",
    desc: "ความรู้สึกขณะเคี้ยว",
    labels: ["ละลายง่าย", "เนียน", "สมดุล", "เหนียวนุ่ม", "ต้องเคี้ยวนาน"],
  },
  {
    key: "residual" as const,
    emoji: "✨",
    labelTh: "หลังกลืน",
    labelEn: "Residual",
    desc: "ความรู้สึกที่เหลืออยู่หลังกลืน",
    labels: ["สะอาดโล่ง", "เบาๆ", "พอดี", "ติดปาก", "ค้างหนัก"],
  },
];

const LEVEL_COLORS = [
  "bg-score-emerald",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-orange-400",
  "bg-score-ruby",
];

const TextureStageSlider = ({ dishName, values, onChange, translateTag }: TextureStageSliderProps) => {
  const [activeStage, setActiveStage] = useState(0);
  const stage = STAGES[activeStage];
  const currentValue = values[stage.key];

  const handleSliderChange = (level: number) => {
    if (navigator.vibrate) navigator.vibrate(8);
    onChange({ ...values, [stage.key]: level });
  };

  const tt = (text: string) => translateTag ? translateTag(text) : text;

  const allFilled = values.initial > 0 && values.mastication > 0 && values.residual > 0;

  return (
    <div className="space-y-4">
      {/* Stage tabs */}
      <div className="flex gap-1 p-1 rounded-2xl bg-secondary/60">
        {STAGES.map((s, i) => {
          const filled = values[s.key] > 0;
          return (
            <button
              key={s.key}
              onClick={() => { setActiveStage(i); if (navigator.vibrate) navigator.vibrate(8); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all",
                activeStage === i
                  ? "bg-surface-elevated shadow-luxury text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-base">{s.emoji}</span>
              <span>{tt(s.labelTh)}</span>
              {filled && <span className="w-1.5 h-1.5 rounded-full bg-score-emerald" />}
            </button>
          );
        })}
      </div>

      {/* Active stage content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stage.key}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {/* Stage header */}
          <div className="text-center">
            <span className="text-3xl">{stage.emoji}</span>
            <h3 className="text-base font-bold text-foreground mt-1">{tt(stage.labelTh)}</h3>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase">{stage.labelEn}</p>
            <p className="text-xs text-muted-foreground mt-1">{tt(stage.desc)}</p>
          </div>

          {/* 5-level selector */}
          <div className="space-y-3">
            {stage.labels.map((label, i) => {
              const level = i + 1;
              const isSelected = currentValue === level;
              return (
                <motion.button
                  key={level}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSliderChange(level)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all",
                    isSelected
                      ? "border-score-emerald bg-score-emerald/10 shadow-luxury"
                      : "border-border/50 bg-surface-elevated hover:border-border"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold transition-colors",
                    isSelected ? `${LEVEL_COLORS[i]} text-white` : "bg-secondary text-muted-foreground"
                  )}>
                    {level}
                  </div>
                  <div className="flex-1 text-left">
                    <span className={cn(
                      "text-sm font-medium",
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {tt(label)}
                    </span>
                  </div>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5 rounded-full bg-score-emerald flex items-center justify-center"
                    >
                      <span className="text-white text-xs">✓</span>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Summary mini-bar when all filled */}
      {allFilled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-4 py-3 rounded-2xl bg-score-emerald/10 border border-score-emerald/30"
        >
          <span className="text-xs font-medium text-score-emerald">Texture Profile</span>
          <div className="flex items-center gap-2">
            {STAGES.map((s) => (
              <div key={s.key} className="flex items-center gap-1">
                <span className="text-xs">{s.emoji}</span>
                <span className="text-xs font-bold text-foreground">{values[s.key]}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default TextureStageSlider;
