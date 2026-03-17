import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

/* ── Confetti / sparkle particles ── */
const PARTICLE_COUNT = 18;
const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899", "#14b8a6"];
const randomBetween = (a: number, b: number) => a + Math.random() * (b - a);

const ConfettiBurst = () => {
  const [particles] = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      angle: (360 / PARTICLE_COUNT) * i + randomBetween(-15, 15),
      distance: randomBetween(60, 130),
      size: randomBetween(4, 8),
      rotation: randomBetween(0, 360),
      shape: i % 3, // 0=circle, 1=star, 2=rect
      delay: randomBetween(0, 0.15),
    }))
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.distance;
        const ty = Math.sin(rad) * p.distance;
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
            animate={{ opacity: 0, x: tx, y: ty, scale: 0.3, rotate: p.rotation + 180 }}
            transition={{ duration: 0.9, delay: p.delay, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2"
            style={{ width: p.size, height: p.size }}
          >
            {p.shape === 0 && <div className="w-full h-full rounded-full" style={{ background: p.color }} />}
            {p.shape === 1 && <span style={{ fontSize: p.size * 1.5, lineHeight: 1, color: p.color }}>✦</span>}
            {p.shape === 2 && <div className="w-full h-full rounded-sm" style={{ background: p.color, transform: `rotate(${p.rotation}deg)` }} />}
          </motion.div>
        );
      })}
    </div>
  );
};

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
  titleTh: string;
  description: string;
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
  const map: Record<string, { current: number; target: number; unit: string }> = {
    "first-emerald": { current: ctx.emeraldCount, target: 1, unit: "Emerald" },
    "emerald-5": { current: ctx.emeraldCount, target: 5, unit: "Emerald" },
    "emerald-20": { current: ctx.emeraldCount, target: 20, unit: "Emerald" },
    "store-1": { current: ctx.storeCount, target: 1, unit: "ร้าน" },
    "store-10": { current: ctx.storeCount, target: 10, unit: "ร้าน" },
    "store-30": { current: ctx.storeCount, target: 30, unit: "ร้าน" },
    "reviews-10": { current: ctx.totalReviews, target: 10, unit: "รีวิว" },
    "reviews-50": { current: ctx.totalReviews, target: 50, unit: "รีวิว" },
    "spice-lord": { current: Math.round(ctx.tasteDNA.spicy * 10) / 10, target: 4, unit: "คะแนนเผ็ด" },
    "sweet-tooth": { current: Math.round(ctx.tasteDNA.sweet * 10) / 10, target: 4, unit: "คะแนนหวาน" },
    "umami-sage": { current: Math.round(ctx.tasteDNA.umami * 10) / 10, target: 4, unit: "คะแนนอูมามิ" },
    "dna-explorer": { current: ctx.dnaEntryCount, target: 5, unit: "Dish DNA" },
  };
  const m = map[badge.id] || { current: 0, target: 1, unit: "" };
  const pct = Math.min(m.current / m.target, 1);
  return { ...m, pct };
};

const tierColors = {
  emerald: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500", glow: "shadow-emerald-200" },
  gold: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", bar: "bg-amber-500", glow: "shadow-amber-200" },
  ruby: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", bar: "bg-red-500", glow: "shadow-red-200" },
};

const AchievementDetailSheet = ({ open, onClose, badge, ctx }: Props) => {
  if (!badge) return null;

  const unlocked = badge.check(ctx);
  const { current, target, pct, unit } = getProgress(badge, ctx);
  const tc = tierColors[badge.tier];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-foreground/50 flex items-end justify-center"
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

              {/* Badge icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                className={cn(
                  "w-24 h-24 rounded-3xl mx-auto flex items-center justify-center mb-4 border-2 shadow-lg",
                  unlocked ? cn(tc.bg, tc.border, tc.glow) : "bg-muted/50 border-border"
                )}
              >
                <span className={cn("text-5xl", !unlocked && "grayscale opacity-50")}>
                  {unlocked ? badge.icon : "🔒"}
                </span>
              </motion.div>

              {/* Title & description */}
              <h2 className={cn("text-xl font-bold text-center mb-1", unlocked ? tc.text : "text-muted-foreground")}>
                {badge.titleTh}
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-5">
                {badge.description}
              </p>

              {/* Status badge */}
              <div className="flex justify-center mb-5">
                <span className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-full",
                  unlocked ? cn(tc.bg, tc.text) : "bg-muted text-muted-foreground"
                )}>
                  {unlocked ? "✅ ปลดล็อกแล้ว!" : "🔒 ยังไม่ปลดล็อก"}
                </span>
              </div>

              {/* Progress section */}
              <div className={cn("p-4 rounded-2xl border", tc.bg, tc.border)}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground">ความคืบหน้า</span>
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
                  {unlocked
                    ? "🎉 ยินดีด้วย! คุณทำสำเร็จแล้ว"
                    : `เหลืออีก ${Math.max(0, Math.ceil((target - current) * 10) / 10)} ${unit} จะปลดล็อก`
                  }
                </p>
              </div>

              {/* Tier info */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="text-xs text-muted-foreground">ระดับ:</span>
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
