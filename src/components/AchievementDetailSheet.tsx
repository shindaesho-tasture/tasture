import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import Confetti from "@/components/Confetti";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";

interface TasteDNA {
  salty: number;
  sweet: number;
  sour: number;
  spicy: number;
  umami: number;
}

interface AchievementCtx {
  emeraldCount: number;
  storeCount: number;
  totalReviews: number;
  tasteDNA: TasteDNA;
  dnaEntryCount: number;
}

interface Achievement {
  id: string;
  icon: string;
  titleKey: string;
  descKey: string;
  check: (ctx: AchievementCtx) => boolean;
  tier: "emerald" | "gold" | "ruby";
}

interface Props {
  open: boolean;
  onClose: () => void;
  badge: Achievement | null;
  ctx: AchievementCtx;
}

/* Progress helpers — return { current, target, pct } */
const getProgress = (badge: Achievement, ctx: AchievementCtx) => {
  const map: Record<string, { current: number; target: number; unitKey: string }> = {
    "first-emerald": { current: ctx.emeraldCount, target: 1, unitKey: "Emerald" },
    "emerald-5": { current: ctx.emeraldCount, target: 5, unitKey: "Emerald" },
    "emerald-20": { current: ctx.emeraldCount, target: 20, unitKey: "Emerald" },
    "store-1": { current: ctx.storeCount, target: 1, unitKey: "profile.stores" },
    "store-10": { current: ctx.storeCount, target: 10, unitKey: "profile.stores" },
    "store-30": { current: ctx.storeCount, target: 30, unitKey: "profile.stores" },
    "reviews-10": { current: ctx.totalReviews, target: 10, unitKey: "profile.reviews" },
    "reviews-50": { current: ctx.totalReviews, target: 50, unitKey: "profile.reviews" },
    "spice-lord": { current: Math.round(ctx.tasteDNA.spicy * 10) / 10, target: 4, unitKey: "taste.spicy" },
    "sweet-tooth": { current: Math.round(ctx.tasteDNA.sweet * 10) / 10, target: 4, unitKey: "taste.sweet" },
    "umami-sage": { current: Math.round(ctx.tasteDNA.umami * 10) / 10, target: 4, unitKey: "taste.umami" },
    "dna-explorer": { current: ctx.dnaEntryCount, target: 5, unitKey: "Dish DNA" },
  };
  const m = map[badge.id] || { current: 0, target: 1, unitKey: "" };
  const pct = Math.min(m.current / m.target, 1);
  return { ...m, pct };
};

const tierColors = {
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500", glow: "shadow-emerald-200" },
  gold: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", bar: "bg-amber-500", glow: "shadow-amber-200" },
  ruby: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", bar: "bg-red-500", glow: "shadow-red-200" },
};

const AchievementDetailSheet = ({ open, onClose, badge, ctx }: Props) => {
  const { language } = useLanguage();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (open && badge && badge.check(ctx)) {
      setShowConfetti(true);
      if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
      const timer = setTimeout(() => setShowConfetti(false), 1200);
      return () => clearTimeout(timer);
    }
    setShowConfetti(false);
  }, [open, badge, ctx]);

  if (!badge) return null;

  const unlocked = badge.check(ctx);
  const { current, target, pct, unitKey } = getProgress(badge, ctx);
  const tc = tierColors[badge.tier];
  const unit = unitKey.includes(".") ? t(unitKey, language) : unitKey;

  const unlockText = {
    th: "✅ ปลดล็อกแล้ว!",
    en: "✅ Unlocked!",
    ja: "✅ アンロック済み！",
    zh: "✅ 已解锁！",
    ko: "✅ 달성 완료!",
  }[language];

  const lockedText = {
    th: "🔒 ยังไม่ปลดล็อก",
    en: "🔒 Locked",
    ja: "🔒 未アンロック",
    zh: "🔒 未解锁",
    ko: "🔒 미달성",
  }[language];

  const progressLabel = {
    th: "ความคืบหน้า",
    en: "Progress",
    ja: "進捗",
    zh: "进度",
    ko: "진행률",
  }[language];

  const congratsText = {
    th: "🎉 ยินดีด้วย! คุณทำสำเร็จแล้ว",
    en: "🎉 Congratulations! You did it!",
    ja: "🎉 おめでとうございます！達成しました！",
    zh: "🎉 恭喜！您已完成！",
    ko: "🎉 축하합니다! 달성했습니다!",
  }[language];

  const remaining = Math.max(0, Math.ceil((target - current) * 10) / 10);
  const remainingText = {
    th: `เหลืออีก ${remaining} ${unit} จะปลดล็อก`,
    en: `${remaining} ${unit} more to unlock`,
    ja: `アンロックまであと ${remaining} ${unit}`,
    zh: `还差 ${remaining} ${unit} 解锁`,
    ko: `달성까지 ${remaining} ${unit} 남음`,
  }[language];

  const tierLabel = {
    th: "ระดับ:",
    en: "Tier:",
    ja: "ティア:",
    zh: "等级：",
    ko: "등급:",
  }[language];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] bg-foreground/50 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-background rounded-t-3xl shadow-luxury overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            <div className="px-6 pb-8">
              {/* Close */}
              <div className="flex justify-end mb-2">
                <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {/* Badge icon + confetti */}
              <div className="relative flex justify-center mb-4">
                {unlocked && <Confetti show={showConfetti} />}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={unlocked ? { scale: [0, 1.2, 1], rotate: [0, -8, 8, 0] } : { scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.1 }}
                  className={cn(
                    "w-24 h-24 rounded-3xl flex items-center justify-center border-2 shadow-lg relative z-10",
                    unlocked ? cn(tc.bg, tc.border, tc.glow) : "bg-muted/50 border-border"
                  )}
                >
                  <span className={cn("text-5xl", !unlocked && "grayscale opacity-50")}>
                    {unlocked ? badge.icon : "🔒"}
                  </span>
                </motion.div>
              </div>

              {/* Title & description */}
              <h2 className={cn("text-xl font-bold text-center mb-1", unlocked ? tc.text : "text-muted-foreground")}>
                {t(badge.titleKey, language)}
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-5">
                {t(badge.descKey, language)}
              </p>

              {/* Status badge */}
              <div className="flex justify-center mb-5">
                <span className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full",
                  unlocked ? cn(tc.bg, tc.text) : "bg-muted text-muted-foreground"
                )}>
                  {unlocked ? unlockText : lockedText}
                </span>
              </div>

              {/* Progress section */}
              <div className={cn("p-4 rounded-2xl border", tc.bg, tc.border)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">{progressLabel}</span>
                  <span className={cn("text-xs font-bold", unlocked ? tc.text : "text-muted-foreground")}>
                    {current >= target ? target : current}/{target} {unit}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    className={cn("h-full rounded-full", tc.bar)}
                  />
                </div>

                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {unlocked ? congratsText : remainingText}
                </p>
              </div>

              {/* Tier info */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="text-xs text-muted-foreground">{tierLabel}</span>
                <span className={cn("text-xs font-bold capitalize", tc.text)}>
                  {badge.tier === "emerald" ? "💎 Emerald" : badge.tier === "gold" ? "🥇 Gold" : "💠 Ruby"}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AchievementDetailSheet;
