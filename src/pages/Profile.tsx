import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Gem, Store, ChefHat, LogIn, ChevronRight } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/* ── Types ── */
interface TasteDNA {
  salty: number;
  sweet: number;
  sour: number;
  spicy: number;
  umami: number;
}

interface EmeraldDish {
  id: string;
  name: string;
  storeName: string;
  date: string;
}

interface StoreVerdict {
  storeId: string;
  storeName: string;
  visits: number;
  consistent: boolean;
  lastVisit: string;
}

interface Achievement {
  id: string;
  icon: string;
  title: string;
  titleTh: string;
  description: string;
  check: (ctx: AchievementCtx) => boolean;
  tier: "emerald" | "gold" | "ruby";
}

interface AchievementCtx {
  emeraldCount: number;
  storeCount: number;
  totalReviews: number;
  tasteDNA: TasteDNA;
  dnaEntryCount: number;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: "first-emerald", icon: "💎", title: "First Emerald", titleTh: "เพชรดวงแรก", description: "ให้คะแนน +2 ครั้งแรก", check: (c) => c.emeraldCount >= 1, tier: "emerald" },
  { id: "emerald-5", icon: "💎", title: "Emerald Collector", titleTh: "นักสะสมเพชร", description: "สะสม Emerald 5 ดวง", check: (c) => c.emeraldCount >= 5, tier: "emerald" },
  { id: "emerald-20", icon: "👑", title: "Emerald Crown", titleTh: "มงกุฎเพชร", description: "สะสม Emerald 20 ดวง", check: (c) => c.emeraldCount >= 20, tier: "gold" },
  { id: "store-1", icon: "🏪", title: "First Visit", titleTh: "ก้าวแรก", description: "รีวิวร้านแรก", check: (c) => c.storeCount >= 1, tier: "emerald" },
  { id: "store-10", icon: "🗺️", title: "10 Stores", titleTh: "นักสำรวจ", description: "เยือน 10 ร้าน", check: (c) => c.storeCount >= 10, tier: "gold" },
  { id: "store-30", icon: "🌍", title: "World Taster", titleTh: "ผู้พิชิตโลกรส", description: "เยือน 30 ร้าน", check: (c) => c.storeCount >= 30, tier: "ruby" },
  { id: "reviews-10", icon: "📝", title: "10 Reviews", titleTh: "นักวิจารณ์", description: "รีวิว 10 เมนู", check: (c) => c.totalReviews >= 10, tier: "emerald" },
  { id: "reviews-50", icon: "🔥", title: "50 Reviews", titleTh: "จอมวิจารณ์", description: "รีวิว 50 เมนู", check: (c) => c.totalReviews >= 50, tier: "gold" },
  { id: "spice-lord", icon: "🌶️", title: "Spice Lord", titleTh: "ราชาความเผ็ด", description: "Taste DNA เผ็ดสูงสุด", check: (c) => c.tasteDNA.spicy >= 4, tier: "ruby" },
  { id: "sweet-tooth", icon: "🍯", title: "Sweet Tooth", titleTh: "คนรักหวาน", description: "Taste DNA หวานสูงสุด", check: (c) => c.tasteDNA.sweet >= 4, tier: "gold" },
  { id: "umami-sage", icon: "🍄", title: "Umami Sage", titleTh: "ปราชญ์อูมามิ", description: "Taste DNA อูมามิสูงสุด", check: (c) => c.tasteDNA.umami >= 4, tier: "emerald" },
  { id: "dna-explorer", icon: "🧬", title: "DNA Explorer", titleTh: "นักวิเคราะห์ DNA", description: "ส่ง Dish DNA 5 ครั้ง", check: (c) => c.dnaEntryCount >= 5, tier: "emerald" },
];

/* ── Helpers ── */
const formatDate = (iso: string) => {
  const d = new Date(iso);
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${(d.getFullYear() + 543) % 100}`;
};

/* ── Spider Chart Component ── */
const TasteDNAChart = ({ dna }: { dna: TasteDNA }) => {
  const axes = [
    { name: "เค็ม", key: "salty" as keyof TasteDNA },
    { name: "หวาน", key: "sweet" as keyof TasteDNA },
    { name: "เปรี้ยว", key: "sour" as keyof TasteDNA },
    { name: "เผ็ด", key: "spicy" as keyof TasteDNA },
    { name: "อูมามิ", key: "umami" as keyof TasteDNA },
  ];

  const cx = 120, cy = 120, maxR = 85, rings = 5, n = axes.length;
  const angleStep = (2 * Math.PI) / n;

  const getPoint = (index: number, level: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (level / rings) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const dataPoints = axes.map((a, i) => getPoint(i, Math.min(dna[a.key], 5)));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[260px] mx-auto">
      <defs>
        <radialGradient id="emeraldGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(163,78%,20%)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(163,78%,20%)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Grid rings */}
      {[1, 2, 3, 4, 5].map((ring) => {
        const pts = axes.map((_, i) => getPoint(i, ring));
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
        return <path key={ring} d={d} fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.6} />;
      })}

      {/* Axis lines */}
      {axes.map((_, i) => {
        const outer = getPoint(i, 5);
        return <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="hsl(var(--border))" strokeWidth={0.5} />;
      })}

      {/* Data fill */}
      <motion.path
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        d={dataPath}
        fill="url(#emeraldGlow)"
        stroke="hsl(163,78%,20%)"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <motion.circle
          key={i}
          initial={{ r: 0 }}
          animate={{ r: 3.5 }}
          transition={{ delay: 0.4 + i * 0.08 }}
          cx={p.x} cy={p.y}
          fill="hsl(163,78%,20%)"
          stroke="white"
          strokeWidth={2}
        />
      ))}

      {/* Labels */}
      {axes.map((a, i) => {
        const lp = getPoint(i, 6.2);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            fill="hsl(var(--muted-foreground))" fontSize="10" fontWeight="500">
            {a.name}
          </text>
        );
      })}
    </svg>
  );
};

/* ── Main Page ── */
const Profile = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; email: string | null } | null>(null);
  const [emeraldCount, setEmeraldCount] = useState(0);
  const [storeCount, setStoreCount] = useState(0);
  const [tasteDNA, setTasteDNA] = useState<TasteDNA>({ salty: 0, sweet: 0, sour: 0, spicy: 0, umami: 0 });
  const [emeraldDishes, setEmeraldDishes] = useState<EmeraldDish[]>([]);
  const [verdicts, setVerdicts] = useState<StoreVerdict[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [dnaEntryCount, setDnaEntryCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Profile
      const { data: prof } = await supabase.from("profiles").select("display_name, email").eq("id", user.id).single();
      if (prof) setProfile(prof);

      // Menu reviews (+2 = emerald)
      const { data: reviews } = await supabase.from("menu_reviews").select("id, score, menu_item_id, created_at").eq("user_id", user.id);
      if (!reviews) return;

      const emeralds = reviews.filter((r) => r.score === 2);
      setEmeraldCount(emeralds.length);
      setTotalReviews(reviews.length);

      // Get all reviewed item IDs
      const itemIds = [...new Set(reviews.map((r) => r.menu_item_id))];
      if (itemIds.length === 0) return;

      const { data: items } = await supabase.from("menu_items").select("id, name, store_id").in("id", itemIds);
      if (!items) return;

      const itemMap = new Map(items.map((it) => [it.id, it]));
      const storeIds = [...new Set(items.map((it) => it.store_id))];
      setStoreCount(storeIds.length);

      const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds);
      const storeMap = new Map((stores || []).map((s) => [s.id, s.name]));

      // Emerald Vault
      const vault: EmeraldDish[] = emeralds
        .filter((r) => itemMap.has(r.menu_item_id))
        .map((r) => {
          const item = itemMap.get(r.menu_item_id)!;
          return {
            id: r.id,
            name: item.name,
            storeName: storeMap.get(item.store_id) || "—",
            date: r.created_at,
          };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEmeraldDishes(vault);

      // Taste DNA from sensory feedback (dish_dna with taste-related components)
      const { data: dnaEntries } = await supabase
        .from("dish_dna")
        .select("component_name, selected_score")
        .eq("user_id", user.id);

      setDnaEntryCount(dnaEntries?.length || 0);
      if (dnaEntries && dnaEntries.length > 0) {
        const tasteMap: Record<string, { total: number; count: number }> = {};
        const tasteKeywords: Record<string, keyof TasteDNA> = {
          "เค็ม": "salty", "salty": "salty", "salt": "salty",
          "หวาน": "sweet", "sweet": "sweet", "sugar": "sweet",
          "เปรี้ยว": "sour", "sour": "sour", "acid": "sour",
          "เผ็ด": "spicy", "spicy": "spicy", "chili": "spicy",
          "อูมามิ": "umami", "umami": "umami", "savory": "umami",
        };

        for (const entry of dnaEntries) {
          const lower = entry.component_name.toLowerCase();
          for (const [keyword, key] of Object.entries(tasteKeywords)) {
            if (lower.includes(keyword)) {
              if (!tasteMap[key]) tasteMap[key] = { total: 0, count: 0 };
              tasteMap[key].total += entry.selected_score;
              tasteMap[key].count += 1;
            }
          }
        }

        const dna: TasteDNA = { salty: 0, sweet: 0, sour: 0, spicy: 0, umami: 0 };
        for (const [key, val] of Object.entries(tasteMap)) {
          // Normalize to 0-5 scale (scores are -2 to +2, map to 0-5)
          dna[key as keyof TasteDNA] = Math.max(0, Math.min(5, ((val.total / val.count) + 2) * 1.25));
        }
        setTasteDNA(dna);
      }

      // Verdict History — group reviews by store, check consistency
      const storeReviewGroups: Record<string, number[]> = {};
      for (const rev of reviews) {
        const item = itemMap.get(rev.menu_item_id);
        if (!item) continue;
        if (!storeReviewGroups[item.store_id]) storeReviewGroups[item.store_id] = [];
        storeReviewGroups[item.store_id].push(rev.score);
      }

      const storeReviewDates: Record<string, string[]> = {};
      for (const rev of reviews) {
        const item = itemMap.get(rev.menu_item_id);
        if (!item) continue;
        if (!storeReviewDates[item.store_id]) storeReviewDates[item.store_id] = [];
        storeReviewDates[item.store_id].push(rev.created_at);
      }

      const vList: StoreVerdict[] = storeIds.map((sid) => {
        const scores = storeReviewGroups[sid] || [];
        const dates = storeReviewDates[sid] || [];
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const latestDate = dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || "";
        return {
          storeId: sid,
          storeName: storeMap.get(sid) || "—",
          visits: scores.length,
          consistent: avg >= 0, // positive avg = consistent
          lastVisit: latestDate,
        };
      }).sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());

      setVerdicts(vList);
    };

    load();
  }, [user]);

  const palateLevel = Math.min(99, Math.floor((emeraldCount * 3 + storeCount * 2) * 1.5));
  const hasTasteDNA = Object.values(tasteDNA).some((v) => v > 0);

  const achievementCtx: AchievementCtx = { emeraldCount, storeCount, totalReviews, tasteDNA, dnaEntryCount };
  const unlockedBadges = ACHIEVEMENTS.filter((a) => a.check(achievementCtx));
  const lockedBadges = ACHIEVEMENTS.filter((a) => !a.check(achievementCtx));

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" />
        </div>
      </PageTransition>
    );
  }

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-24">
          <div className="flex flex-col items-center justify-center h-[70vh] gap-4 px-6">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center" style={{ boxShadow: "0 0 0 3px hsl(163,78%,20%), 0 0 20px hsla(163,78%,20%,0.3)" }}>
              <Crown size={28} strokeWidth={1.5} className="text-score-emerald" />
            </div>
            <h1 className="text-xl font-medium text-foreground">Sovereign Profile</h1>
            <p className="text-sm text-muted-foreground text-center">เข้าสู่ระบบเพื่อดูโปรไฟล์ของคุณ</p>
            <button
              onClick={() => navigate("/auth")}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-medium mt-2"
            >
              <LogIn size={16} /> เข้าสู่ระบบ
            </button>
          </div>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  const displayName = profile?.display_name || profile?.email?.split("@")[0] || "Sovereign";

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-28">
        {/* ── Header ── */}
        <div className="flex flex-col items-center pt-10 pb-6 px-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div
              className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center"
              style={{
                boxShadow: "0 0 0 3px hsl(163,78%,20%), 0 0 24px hsla(163,78%,20%,0.35)",
              }}
            >
              <Crown size={32} strokeWidth={1.5} className="text-score-emerald" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-4 text-lg font-semibold text-foreground"
          >
            {displayName}
          </motion.h1>

          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-xs text-muted-foreground mt-0.5"
          >
            {profile?.email}
          </motion.p>

          {/* Founding Sovereign Badge */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 300 }}
            className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full"
            style={{
              background: "linear-gradient(135deg, hsl(43,74%,49%), hsl(43,74%,65%))",
              boxShadow: "0 2px 12px hsla(43,74%,49%,0.3)",
            }}
          >
            <Crown size={12} className="text-white" />
            <span className="text-[11px] font-semibold text-white tracking-wide">Founding Sovereign · ×20</span>
          </motion.div>
        </div>

        {/* ── Sovereign Stats ── */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mx-6 grid grid-cols-3 gap-3 mb-8"
        >
          {[
            { icon: Gem, label: "Emeralds", value: emeraldCount },
            { icon: Store, label: "Stores", value: storeCount },
            { icon: ChefHat, label: "Palate Lv.", value: palateLevel },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col items-center py-4 rounded-2xl bg-card shadow-luxury">
              <Icon size={18} strokeWidth={1.5} className="text-score-emerald mb-1.5" />
              <span className="text-xl font-bold text-foreground">{value}</span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── Achievement Badges ── */}
        <motion.section
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mx-6 mb-8"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-base">🏆</span>
            Achievements
            <span className="text-[10px] text-muted-foreground font-normal">
              {unlockedBadges.length}/{ACHIEVEMENTS.length}
            </span>
          </h2>

          {/* Unlocked */}
          {unlockedBadges.length > 0 && (
            <div className="grid grid-cols-4 gap-2.5 mb-3">
              {unlockedBadges.map((badge, i) => {
                const tierColors = {
                  emerald: { bg: "bg-score-emerald/10", ring: "shadow-[0_0_0_1.5px_hsl(163,78%,20%),0_0_12px_hsla(163,78%,20%,0.2)]" },
                  gold: { bg: "bg-gold/10", ring: "shadow-[0_0_0_1.5px_hsl(43,74%,49%),0_0_12px_hsla(43,74%,49%,0.2)]" },
                  ruby: { bg: "bg-score-ruby/10", ring: "shadow-[0_0_0_1.5px_hsl(0,68%,35%),0_0_12px_hsla(0,68%,35%,0.2)]" },
                };
                const tc = tierColors[badge.tier];
                return (
                  <motion.div
                    key={badge.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.06, type: "spring", stiffness: 400, damping: 20 }}
                    className={`flex flex-col items-center py-3 rounded-2xl bg-card ${tc.ring}`}
                  >
                    <span className="text-xl mb-1">{badge.icon}</span>
                    <span className="text-[9px] font-semibold text-foreground text-center leading-tight px-1">{badge.titleTh}</span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Locked */}
          {lockedBadges.length > 0 && (
            <div className="grid grid-cols-4 gap-2.5">
              {lockedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center py-3 rounded-2xl bg-muted/50 opacity-40"
                >
                  <span className="text-xl mb-1 grayscale">🔒</span>
                  <span className="text-[9px] font-medium text-muted-foreground text-center leading-tight px-1">{badge.titleTh}</span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mx-6 mb-8"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-score-emerald" />
            Taste DNA
          </h2>
          <div className="bg-card rounded-2xl shadow-luxury p-4">
            {hasTasteDNA ? (
              <TasteDNAChart dna={tasteDNA} />
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="text-2xl mb-2">🧬</span>
                <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล Taste DNA</p>
                <p className="text-[10px] text-muted-foreground mt-1">รีวิวเมนูเพิ่มเพื่อสร้างลายนิ้วมือรสชาติของคุณ</p>
              </div>
            )}
          </div>
        </motion.section>

        {/* ── Emerald Vault ── */}
        <motion.section
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mx-6 mb-8"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Gem size={14} className="text-score-emerald" />
            Emerald Vault
            {emeraldDishes.length > 0 && (
              <span className="text-[10px] text-muted-foreground font-normal">({emeraldDishes.length})</span>
            )}
          </h2>

          {emeraldDishes.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {emeraldDishes.slice(0, 6).map((dish, i) => (
                <motion.div
                  key={dish.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.65 + i * 0.05 }}
                  className="bg-card rounded-2xl shadow-luxury p-3.5 flex flex-col"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-score-emerald/10 flex items-center justify-center">
                      <Gem size={10} className="text-score-emerald" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatDate(dish.date)}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{dish.name}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 truncate">{dish.storeName}</span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-2xl shadow-luxury p-6 text-center">
              <span className="text-2xl mb-2 block">💎</span>
              <p className="text-xs text-muted-foreground">ยังไม่มีเมนู Emerald</p>
              <p className="text-[10px] text-muted-foreground mt-1">ให้คะแนน +2 (ดีเลิศ) เพื่อเก็บเข้า Vault</p>
            </div>
          )}
        </motion.section>

        {/* ── Verdict History ── */}
        <motion.section
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mx-6 mb-8"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-score-emerald" />
            Verdict History
          </h2>

          {verdicts.length > 0 ? (
            <div className="space-y-2">
              {verdicts.map((v, i) => (
                <motion.div
                  key={v.storeId}
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.75 + i * 0.05 }}
                  onClick={() => navigate(`/menu-feedback/${v.storeId}`)}
                  className="bg-card rounded-2xl shadow-luxury p-4 flex items-center gap-3 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${v.consistent ? "bg-score-emerald/10" : "bg-score-amber/10"}`}>
                    <span className="text-base">{v.consistent ? "✨" : "🔄"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground block truncate">{v.storeName}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium ${v.consistent ? "text-score-emerald" : "text-score-amber"}`}>
                        {v.consistent ? "เสน่ห์คงเดิม" : "กลายเป็นอื่น"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">· {v.visits} เมนู · {formatDate(v.lastVisit)}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-2xl shadow-luxury p-6 text-center">
              <span className="text-2xl mb-2 block">📋</span>
              <p className="text-xs text-muted-foreground">ยังไม่มีประวัติการรีวิวร้าน</p>
            </div>
          )}
        </motion.section>

        {/* ── Sign Out ── */}
        <div className="mx-6 mb-6">
          <button
            onClick={signOut}
            className="w-full py-3 rounded-2xl border border-border text-sm text-muted-foreground font-medium active:scale-[0.98] transition-transform"
          >
            ออกจากระบบ
          </button>
        </div>

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default Profile;
