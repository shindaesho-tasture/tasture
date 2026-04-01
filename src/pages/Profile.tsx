import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Gem, Store, LogIn, Pencil, Check, X, Camera, Users, ChefHat, Grid3X3, Bookmark, Heart, MessageCircle, Trophy, Globe } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import PostDetailSheet from "@/components/PostDetailSheet";
import AchievementDetailSheet from "@/components/AchievementDetailSheet";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useLanguage, LANGUAGES, type AppLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";

/* ── Types ── */
interface UserPost {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  store_id: string | null;
  likeCount: number;
  commentCount: number;
  images: string[];
}

interface SavedStoreItem {
  id: string;
  storeId: string;
  storeName: string;
  savedAt: string;
}

interface TasteDNA {
  salty: number;
  sweet: number;
  sour: number;
  spicy: number;
  umami: number;
}

interface Achievement {
  id: string;
  icon: string;
  titleKey: string;
  descKey: string;
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
  { id: "first-emerald", icon: "💎", titleKey: "achievement.firstEmerald", descKey: "achievement.firstEmeraldDesc", check: (c) => c.emeraldCount >= 1, tier: "emerald" },
  { id: "emerald-5", icon: "💎", titleKey: "achievement.emeraldCollector", descKey: "achievement.emeraldCollectorDesc", check: (c) => c.emeraldCount >= 5, tier: "emerald" },
  { id: "emerald-20", icon: "👑", titleKey: "achievement.emeraldCrown", descKey: "achievement.emeraldCrownDesc", check: (c) => c.emeraldCount >= 20, tier: "gold" },
  { id: "store-1", icon: "🏪", titleKey: "achievement.firstStep", descKey: "achievement.firstStepDesc", check: (c) => c.storeCount >= 1, tier: "emerald" },
  { id: "store-10", icon: "🗺️", titleKey: "achievement.explorer", descKey: "achievement.explorerDesc", check: (c) => c.storeCount >= 10, tier: "gold" },
  { id: "store-30", icon: "🌍", titleKey: "achievement.worldConqueror", descKey: "achievement.worldConquerorDesc", check: (c) => c.storeCount >= 30, tier: "ruby" },
  { id: "reviews-10", icon: "📝", titleKey: "achievement.critic", descKey: "achievement.criticDesc", check: (c) => c.totalReviews >= 10, tier: "emerald" },
  { id: "reviews-50", icon: "🔥", titleKey: "achievement.superCritic", descKey: "achievement.superCriticDesc", check: (c) => c.totalReviews >= 50, tier: "gold" },
  { id: "spice-lord", icon: "🌶️", titleKey: "achievement.spiceLord", descKey: "achievement.spiceLordDesc", check: (c) => c.tasteDNA.spicy >= 4, tier: "ruby" },
  { id: "sweet-tooth", icon: "🍯", titleKey: "achievement.sweetTooth", descKey: "achievement.sweetToothDesc", check: (c) => c.tasteDNA.sweet >= 4, tier: "gold" },
  { id: "umami-sage", icon: "🍄", titleKey: "achievement.umamiSage", descKey: "achievement.umamiSageDesc", check: (c) => c.tasteDNA.umami >= 4, tier: "emerald" },
  { id: "dna-explorer", icon: "🧬", titleKey: "achievement.dnaExplorer", descKey: "achievement.dnaExplorerDesc", check: (c) => c.dnaEntryCount >= 5, tier: "emerald" },
];

/* ── Taste DNA Spider Chart ── */
const TasteDNAChart = ({ dna, language }: { dna: TasteDNA; language: AppLanguage }) => {
  const axes = [
    { name: t("taste.salty", language), key: "salty" as keyof TasteDNA },
    { name: t("taste.sweet", language), key: "sweet" as keyof TasteDNA },
    { name: t("taste.sour", language), key: "sour" as keyof TasteDNA },
    { name: t("taste.spicy", language), key: "spicy" as keyof TasteDNA },
    { name: t("taste.umami", language), key: "umami" as keyof TasteDNA },
  ];
  const cx = 100, cy = 100, maxR = 70, n = axes.length;
  const step = (2 * Math.PI) / n;
  const pt = (i: number, lv: number) => {
    const a = step * i - Math.PI / 2;
    const r = (lv / 5) * maxR;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const dataPoints = axes.map((a, i) => pt(i, Math.min(dna[a.key], 5)));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[220px] mx-auto">
      {[1, 2, 3, 4, 5].map((ring) => {
        const pts = axes.map((_, i) => pt(i, ring));
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
        return <path key={ring} d={d} fill="none" stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.6} />;
      })}
      {axes.map((_, i) => {
        const o = pt(i, 5);
        return <line key={i} x1={cx} y1={cy} x2={o.x} y2={o.y} stroke="hsl(var(--border))" strokeWidth={0.5} />;
      })}
      <motion.path
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8 }}
        d={dataPath}
        fill="hsla(163,78%,20%,0.15)"
        stroke="hsl(163,78%,20%)"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {dataPoints.map((p, i) => (
        <motion.circle key={i} initial={{ r: 0 }} animate={{ r: 3 }} transition={{ delay: 0.3 + i * 0.08 }}
          cx={p.x} cy={p.y} fill="hsl(163,78%,20%)" stroke="white" strokeWidth={1.5} />
      ))}
      {axes.map((a, i) => {
        const lp = pt(i, 6.5);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="500">{a.name}</text>
        );
      })}
    </svg>
  );
};

/* ── Main Page ── */
const Profile = () => {
  const { user, loading, signOut } = useAuth();
  const { language, setLanguage, currentOption } = useLanguage();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; email: string | null; avatar_url: string | null } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Stats
  const [postCount, setPostCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Tabs
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "stats">("posts");

  // Posts grid
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Saved stores
  const [savedStores, setSavedStores] = useState<SavedStoreItem[]>([]);

  // Post detail sheet
  const [selectedPost, setSelectedPost] = useState<UserPost | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);

  // Achievement / DNA data
  const [emeraldCount, setEmeraldCount] = useState(0);
  const [storeCount, setStoreCount] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [dnaEntryCount, setDnaEntryCount] = useState(0);
  const [tasteDNA, setTasteDNA] = useState<TasteDNA>({ salty: 0, sweet: 0, sour: 0, spicy: 0, umami: 0 });

  const handleSaveName = async () => {
    if (!user || !nameInput.trim()) return;
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: nameInput.trim() } as any).eq("id", user.id);
    if (!error) setProfile((p) => p ? { ...p, display_name: nameInput.trim() } : p);
    setSavingName(false);
    setEditingName(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return;
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadErr) { setUploadingAvatar(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: avatarUrl } as any).eq("id", user.id);
    setProfile((p) => p ? { ...p, avatar_url: avatarUrl } : p);
    setUploadingAvatar(false);
  };

  // Load profile, stats, achievements
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profRes, followersRes, followingRes, postsCountRes] = await Promise.all([
        supabase.from("profiles").select("display_name, email, avatar_url" as any).eq("id", user.id).single(),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("hidden", false),
      ]);
      if (profRes.data) setProfile(profRes.data as any);
      setFollowerCount(followersRes.count || 0);
      setFollowingCount(followingRes.count || 0);
      setPostCount(postsCountRes.count || 0);

      // Saved stores
      const { data: savedData } = await supabase
        .from("saved_stores")
        .select("id, store_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (savedData && savedData.length > 0) {
        const savedStoreIds = savedData.map((s) => s.store_id);
        const { data: storesData } = await supabase.from("stores").select("id, name").in("id", savedStoreIds);
        const nameMap = new Map((storesData || []).map((s) => [s.id, s.name]));
        setSavedStores(savedData.map((s) => ({
          id: s.id,
          storeId: s.store_id,
          storeName: nameMap.get(s.store_id) || "ร้านค้า",
          savedAt: s.created_at,
        })));
      }

      // Reviews for achievements
      const { data: reviews } = await supabase.from("menu_reviews").select("id, score, menu_item_id").eq("user_id", user.id);
      if (reviews) {
        setTotalReviews(reviews.length);
        setEmeraldCount(reviews.filter((r) => r.score === 2).length);
        const itemIds = [...new Set(reviews.map((r) => r.menu_item_id))];
        if (itemIds.length > 0) {
          const { data: items } = await supabase.from("menu_items").select("store_id").in("id", itemIds);
          setStoreCount(new Set((items || []).map((i) => i.store_id)).size);
        }
      }

      // Taste DNA from dish_dna
      const { data: dnaEntries } = await supabase.from("dish_dna").select("component_name, selected_score").eq("user_id", user.id);
      setDnaEntryCount(dnaEntries?.length || 0);
      if (dnaEntries && dnaEntries.length > 0) {
        const tasteKeywords: Record<string, keyof TasteDNA> = {
          "เค็ม": "salty", "salty": "salty",
          "หวาน": "sweet", "sweet": "sweet",
          "เปรี้ยว": "sour", "sour": "sour",
          "เผ็ด": "spicy", "spicy": "spicy",
          "อูมามิ": "umami", "umami": "umami",
        };
        const tasteMap: Record<string, { total: number; count: number }> = {};
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
          dna[key as keyof TasteDNA] = Math.max(0, Math.min(5, ((val.total / val.count) + 2) * 1.25));
        }
        setTasteDNA(dna);
      }
    };
    load();
  }, [user]);

  // Load posts
  useEffect(() => {
    if (!user) return;
    const loadPosts = async () => {
      setLoadingPosts(true);
      const { data: rawPosts } = await supabase
        .from("posts")
        .select("id, image_url, caption, created_at, store_id")
        .eq("user_id", user.id)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(60);

      if (!rawPosts || rawPosts.length === 0) { setPosts([]); setLoadingPosts(false); return; }

      const postIds = rawPosts.map((p) => p.id);
      const [likesRes, commentsRes, imagesRes] = await Promise.all([
        supabase.from("post_likes").select("ref_id").in("ref_id", postIds),
        supabase.from("feed_comments").select("ref_id").in("ref_id", postIds),
        supabase.from("post_images").select("post_id, image_url, sort_order").in("post_id", postIds).order("sort_order", { ascending: true }),
      ]);

      const likesMap = new Map<string, number>();
      (likesRes.data || []).forEach((l) => likesMap.set(l.ref_id, (likesMap.get(l.ref_id) || 0) + 1));
      const commentsMap = new Map<string, number>();
      (commentsRes.data || []).forEach((c) => commentsMap.set(c.ref_id, (commentsMap.get(c.ref_id) || 0) + 1));
      const imagesMap = new Map<string, string[]>();
      (imagesRes.data || []).forEach((img) => {
        if (!imagesMap.has(img.post_id)) imagesMap.set(img.post_id, []);
        imagesMap.get(img.post_id)!.push(img.image_url);
      });

      setPosts(rawPosts.map((p) => ({
        id: p.id,
        image_url: p.image_url,
        caption: p.caption,
        created_at: p.created_at,
        store_id: p.store_id,
        likeCount: likesMap.get(p.id) || 0,
        commentCount: commentsMap.get(p.id) || 0,
        images: imagesMap.get(p.id) || [p.image_url],
      })));
      setLoadingPosts(false);
    };
    loadPosts();
  }, [user]);

  // Achievement context
  const achievementCtx: AchievementCtx = { emeraldCount, storeCount, totalReviews, tasteDNA, dnaEntryCount };
  const unlockedBadges = ACHIEVEMENTS.filter((a) => a.check(achievementCtx));
  const lockedBadges = ACHIEVEMENTS.filter((a) => !a.check(achievementCtx));
  const hasTasteDNA = Object.values(tasteDNA).some((v) => v > 0);

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-24">
          <div className="px-5 pt-safe-top">
            <div className="flex items-center justify-between py-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
            <div className="flex items-center gap-5 pb-4">
              <Skeleton className="w-20 h-20 rounded-full flex-shrink-0" />
              <div className="flex-1 flex justify-around">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="h-4 w-48 mb-4" />
            <div className="flex gap-2 mb-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          </div>
          <BottomNav />
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
            <p className="text-sm text-muted-foreground text-center">{t("profile.loginPrompt", language)}</p>
            <button onClick={() => navigate("/auth")} className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-medium mt-2">
              <LogIn size={16} /> {t("common.login", language)}
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
      <div className="min-h-screen bg-background pb-24">
        {/* ── IG-style Header ── */}
        <div className="px-5 pt-safe-top">
          <div className="flex items-center justify-between py-3">
            <h1 className="text-lg font-bold text-foreground">{displayName}</h1>
            <button onClick={signOut} className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg border border-border">
              {t("common.logout", language)}
            </button>
          </div>

          {/* Profile row */}
          <div className="flex items-center gap-5 pb-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative flex-shrink-0">
              <label className="cursor-pointer block">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center overflow-hidden"
                  style={{ boxShadow: "0 0 0 3px hsl(163,78%,20%), 0 0 24px hsla(163,78%,20%,0.35)" }}>
                  {uploadingAvatar ? (
                    <div className="w-6 h-6 border-2 border-score-emerald border-t-transparent rounded-full animate-spin" />
                  ) : profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Crown size={32} strokeWidth={1.5} className="text-score-emerald" />
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-score-emerald flex items-center justify-center border-2 border-background">
                  <Camera size={10} className="text-white" />
                </div>
              </label>
            </motion.div>

            <div className="flex-1 flex justify-around">
              {[
                { value: postCount, label: t("profile.posts", language), link: null },
                { value: followerCount, label: t("profile.followers", language), link: "/follows?tab=followers" },
                { value: followingCount, label: t("profile.following", language), link: "/follows?tab=following" },
              ].map(({ value, label, link }) => (
                <button key={label} onClick={() => link && navigate(link)} className="flex flex-col items-center">
                  <span className="text-lg font-bold text-foreground">{value}</span>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name + edit */}
          <div className="pb-3">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input autoFocus value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="text-sm font-semibold text-foreground bg-transparent border-b-2 border-score-emerald outline-none w-40 pb-0.5"
                  maxLength={30} />
                <button onClick={handleSaveName} disabled={savingName} className="w-6 h-6 rounded-full bg-score-emerald/10 flex items-center justify-center">
                  <Check size={12} className="text-score-emerald" />
                </button>
                <button onClick={() => setEditingName(false)} className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <X size={12} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">{displayName}</span>
                <button onClick={() => { setNameInput(profile?.display_name || ""); setEditingName(true); }}
                  className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                  <Pencil size={9} className="text-muted-foreground" />
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">{profile?.email}</p>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{t("common.language", language)}:</span>
            <div className="flex gap-1.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
                    language === lang.code
                      ? "bg-score-emerald text-white shadow-sm"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  {lang.flag} {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Badge */}
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-4"
            style={{ background: "linear-gradient(135deg, hsl(43,74%,49%), hsl(43,74%,65%))", boxShadow: "0 2px 12px hsla(43,74%,49%,0.3)" }}>
            <Crown size={11} className="text-white" />
            <span className="text-[10px] font-semibold text-white tracking-wide">{t("profile.foundingSovereign", language)}</span>
          </motion.div>
        </div>

        {/* ── Tab Bar (Grid / Saved / Stats) ── */}
        <div className="flex border-t border-border">
          {([
            { key: "posts" as const, icon: Grid3X3 },
            { key: "saved" as const, icon: Bookmark },
            { key: "stats" as const, icon: Trophy },
          ]).map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex-1 flex items-center justify-center py-3 transition-colors border-b-2",
                activeTab === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
              )}
            >
              <Icon size={20} strokeWidth={activeTab === key ? 2 : 1.5} />
            </button>
          ))}
        </div>

        {/* ── Tab: Posts Grid ── */}
        {activeTab === "posts" && (
          <div>
            {loadingPosts ? (
              <div className="grid grid-cols-3 gap-[1px]">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-secondary animate-pulse" />
                ))}
              </div>
            ) : posts.length > 0 ? (
              <div className="grid grid-cols-3 gap-[1px]">
                {posts.map((post) => (
                  <motion.button
                    key={post.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative aspect-square bg-secondary overflow-hidden group"
                    onClick={() => setSelectedPost(post)}
                  >
                    <img src={post.images[0] || post.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    {post.images.length > 1 && (
                      <div className="absolute top-2 right-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="drop-shadow-md">
                          <rect x="3" y="3" width="14" height="14" rx="2" />
                          <path d="M7 21h14a2 2 0 0 0 2-2V7" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-foreground/40 opacity-0 group-active:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <div className="flex items-center gap-1">
                        <Heart size={16} fill="white" className="text-white" />
                        <span className="text-white text-sm font-bold">{post.likeCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle size={16} fill="white" className="text-white" />
                        <span className="text-white text-sm font-bold">{post.commentCount}</span>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
                  <Camera size={28} strokeWidth={1.5} className="text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">{t("profile.sharePhotos", language)}</h3>
                <p className="text-sm text-muted-foreground text-center">{t("profile.sharePhotosDesc", language)}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Saved ── */}
        {activeTab === "saved" && (
          <div className="px-4 pt-4">
            {savedStores.length > 0 ? (
              <div className="space-y-2">
                {savedStores.map((s, i) => (
                  <motion.button key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => navigate(`/store/${s.storeId}/order`)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-card shadow-luxury border border-border/30 text-left active:scale-[0.98] transition-transform">
                    <div className="w-11 h-11 rounded-xl bg-score-emerald/10 flex items-center justify-center shrink-0">
                      <Store size={18} className="text-score-emerald" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground block truncate">{s.storeName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {t("profile.savedAt", language)} {new Date(s.savedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6">
                <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
                  <Bookmark size={28} strokeWidth={1.5} className="text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-1">{t("profile.savedStores", language)}</h3>
                <p className="text-sm text-muted-foreground text-center">{t("profile.savedStoresDesc", language)}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Stats (Achievements + Taste DNA) ── */}
        {activeTab === "stats" && (
          <div className="px-5 pt-5 space-y-6">
            {/* Taste DNA */}
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-base">🧬</span> {t("profile.tasteDNA", language)}
              </h2>
              <div className="bg-card rounded-2xl shadow-luxury p-4">
                {hasTasteDNA ? (
                  <TasteDNAChart dna={tasteDNA} language={language} />
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <span className="text-2xl mb-2">🧬</span>
                    <p className="text-xs text-muted-foreground">{t("profile.noTasteDNA", language)}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{t("profile.noTasteDNADesc", language)}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Emerald Vault mini */}
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Gem size={14} className="text-score-emerald" /> {t("profile.emeraldVault", language)}
                <span className="text-[10px] text-muted-foreground font-normal">({emeraldCount})</span>
              </h2>
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { icon: Gem, label: t("profile.emeralds", language), value: emeraldCount },
                  { icon: Store, label: t("profile.stores", language), value: storeCount },
                  { icon: ChefHat, label: t("profile.reviews", language), value: totalReviews },
                  { icon: Trophy, label: t("profile.badges", language), value: unlockedBadges.length },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex flex-col items-center py-3 rounded-2xl bg-card shadow-luxury">
                    <Icon size={14} strokeWidth={1.5} className="text-score-emerald mb-1" />
                    <span className="text-base font-bold text-foreground">{value}</span>
                    <span className="text-[9px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Achievements */}
            <section>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-base">🏆</span> {t("profile.achievements", language)}
                <span className="text-[10px] text-muted-foreground font-normal">
                  {unlockedBadges.length}/{ACHIEVEMENTS.length}
                </span>
              </h2>

              {unlockedBadges.length > 0 && (
                <div className="grid grid-cols-4 gap-2.5 mb-3">
                  {unlockedBadges.map((badge, i) => {
                    const tc = {
                      emerald: "shadow-[0_0_0_1.5px_hsl(163,78%,20%),0_0_12px_hsla(163,78%,20%,0.2)]",
                      gold: "shadow-[0_0_0_1.5px_hsl(43,74%,49%),0_0_12px_hsla(43,74%,49%,0.2)]",
                      ruby: "shadow-[0_0_0_1.5px_hsl(0,68%,35%),0_0_12px_hsla(0,68%,35%,0.2)]",
                    }[badge.tier];
                    return (
                      <motion.button key={badge.id} initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 400, damping: 20 }}
                        onClick={() => setSelectedBadge(badge)}
                        className={`flex flex-col items-center py-3 rounded-2xl bg-card ${tc} active:scale-95 transition-transform`}>
                        <span className="text-xl mb-1">{badge.icon}</span>
                        <span className="text-[9px] font-semibold text-foreground text-center leading-tight px-1">{t(badge.titleKey, language)}</span>
                        <span className="text-[8px] text-muted-foreground mt-0.5 text-center px-1">{t(badge.descKey, language)}</span>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {lockedBadges.length > 0 && (
                <div className="grid grid-cols-4 gap-2.5">
                  {lockedBadges.map((badge) => (
                    <button key={badge.id} onClick={() => setSelectedBadge(badge)}
                      className="flex flex-col items-center py-3 rounded-2xl bg-muted/50 opacity-40 active:scale-95 transition-transform">
                      <span className="text-xl mb-1 grayscale">🔒</span>
                      <span className="text-[9px] font-medium text-muted-foreground text-center leading-tight px-1">{t(badge.titleKey, language)}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Post Detail Sheet */}
        <PostDetailSheet
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          postId={selectedPost?.id || ""}
          preload={selectedPost ? {
            imageUrl: selectedPost.image_url,
            images: selectedPost.images,
            caption: selectedPost.caption,
            likeCount: selectedPost.likeCount,
            commentCount: selectedPost.commentCount,
          } : undefined}
        />

        <AchievementDetailSheet
          open={!!selectedBadge}
          onClose={() => setSelectedBadge(null)}
          badge={selectedBadge}
          ctx={achievementCtx}
        />

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default Profile;
