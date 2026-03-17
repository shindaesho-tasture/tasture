import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ShieldCheck, Search, CheckCircle2, XCircle, Users, Store,
  MessageSquare, Dna, BarChart3, TrendingUp, Eye, EyeOff, Trash2, UserCog,
  Crown, Shield, User as UserIcon, RefreshCw, ChevronDown, Filter, Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { categories, getScoreTier, type ScoreTier } from "@/lib/categories";
import { getTrustTier } from "@/lib/trust-tiers";
import TrustTierBadge from "@/components/TrustTierBadge";
import PageTransition from "@/components/PageTransition";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
type AdminTab = "overview" | "stores" | "users" | "content" | "feedback";

interface AdminStore {
  id: string; name: string; category_id: string | null; verified: boolean;
  created_at: string; user_id: string; reviewCount: number; ownerEmail: string | null;
}

interface AdminUser {
  id: string; email: string | null; display_name: string | null;
  avatar_url: string | null; created_at: string; role: string;
  postCount: number; reviewCount: number; banned: boolean;
}

interface AdminPost {
  id: string; user_id: string; userName: string; caption: string | null;
  image_url: string; store_name: string | null; created_at: string;
  likeCount: number; commentCount: number; hidden: boolean;
}

interface AdminReview {
  id: string; user_id: string; userName: string; menu_item_name: string;
  store_name: string; score: number; created_at: string; shared: boolean; hidden: boolean;
}

interface AdminDna {
  menu_item_id: string; menu_item_name: string; store_name: string;
  componentCount: number; userCount: number; avgScore: number;
}

interface OverviewStats {
  totalUsers: number; totalStores: number; totalReviews: number;
  totalPosts: number; totalDna: number; verifiedStores: number;
  newUsersToday: number; newReviewsToday: number;
}

const tierColors: Record<ScoreTier, string> = {
  emerald: "text-score-emerald", mint: "text-score-mint", slate: "text-score-slate",
  amber: "text-score-amber", ruby: "text-score-ruby",
};

const tabs: { id: AdminTab; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "ภาพรวม", icon: BarChart3 },
  { id: "stores", label: "ร้านค้า", icon: Store },
  { id: "users", label: "ผู้ใช้", icon: Users },
  { id: "content", label: "เนื้อหา", icon: MessageSquare },
  { id: "feedback", label: "ฟีดแบค", icon: Dna },
];

const roleIcons: Record<string, typeof Crown> = { admin: Crown, moderator: Shield, user: UserIcon };
const roleLabels: Record<string, string> = { admin: "แอดมิน", moderator: "ผู้ดูแล", user: "ผู้ใช้" };
const roleColors: Record<string, string> = {
  admin: "bg-score-emerald/10 text-score-emerald border-score-emerald/30",
  moderator: "bg-score-amber/10 text-score-amber border-score-amber/30",
  user: "bg-secondary text-muted-foreground border-border/50",
};

const haptic = () => navigator.vibrate?.(8);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  // Data states
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [dnaItems, setDnaItems] = useState<AdminDna[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [storeFilter, setStoreFilter] = useState<"all" | "verified" | "unverified">("all");
  const [contentTab, setContentTab] = useState<"posts" | "reviews">("posts");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    checkAdmin();
  }, [user, authLoading]);

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) { setIsAdmin(false); setLoading(false); return; }
    setIsAdmin(true);
    await fetchAll();
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchStores(), fetchUsers(), fetchPosts(), fetchReviews(), fetchDna()]);
    setLoading(false);
  };

  const fetchStats = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [
      { count: totalUsers }, { count: totalStores }, { count: totalReviews },
      { count: totalPosts }, { count: totalDna }, { count: verifiedStores },
      { count: newUsersToday }, { count: newReviewsToday },
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("stores").select("id", { count: "exact", head: true }),
      supabase.from("menu_reviews").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("dish_dna").select("id", { count: "exact", head: true }),
      supabase.from("stores").select("id", { count: "exact", head: true }).eq("verified", true),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("menu_reviews").select("id", { count: "exact", head: true }).gte("created_at", today),
    ]);
    setStats({
      totalUsers: totalUsers || 0, totalStores: totalStores || 0, totalReviews: totalReviews || 0,
      totalPosts: totalPosts || 0, totalDna: totalDna || 0, verifiedStores: verifiedStores || 0,
      newUsersToday: newUsersToday || 0, newReviewsToday: newReviewsToday || 0,
    });
  };

  const fetchStores = async () => {
    const { data: storesData } = await supabase
      .from("stores").select("id, name, category_id, verified, created_at, user_id")
      .order("created_at", { ascending: false });
    const storeIds = (storesData || []).map((s) => s.id);
    const userIds = [...new Set((storesData || []).map((s) => s.user_id))];
    const [{ data: reviewsData }, { data: profiles }] = await Promise.all([
      supabase.from("reviews").select("store_id").in("store_id", storeIds),
      supabase.from("profiles").select("id, email").in("id", userIds),
    ]);
    const countMap = new Map<string, number>();
    (reviewsData || []).forEach((r) => countMap.set(r.store_id, (countMap.get(r.store_id) || 0) + 1));
    const emailMap = new Map<string, string>();
    (profiles || []).forEach((p) => { if (p.email) emailMap.set(p.id, p.email); });
    setStores((storesData || []).map((s) => ({
      ...s, reviewCount: countMap.get(s.id) || 0, ownerEmail: emailMap.get(s.user_id) || null,
    })));
  };

  const fetchUsers = async () => {
    const { data: profilesData } = await supabase
      .from("profiles").select("id, email, display_name, avatar_url, created_at, banned")
      .order("created_at", { ascending: false }).limit(200);
    const ids = (profilesData || []).map((p) => p.id);
    const [{ data: rolesData }, { data: postsData }, { data: reviewsData }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      supabase.from("posts").select("user_id").in("user_id", ids),
      supabase.from("menu_reviews").select("user_id").in("user_id", ids),
    ]);
    const roleMap = new Map<string, string>();
    (rolesData || []).forEach((r) => roleMap.set(r.user_id, r.role));
    const postCountMap = new Map<string, number>();
    (postsData || []).forEach((p) => postCountMap.set(p.user_id, (postCountMap.get(p.user_id) || 0) + 1));
    const reviewCountMap = new Map<string, number>();
    (reviewsData || []).forEach((r) => reviewCountMap.set(r.user_id, (reviewCountMap.get(r.user_id) || 0) + 1));
    setUsers((profilesData || []).map((p) => ({
      ...p, role: roleMap.get(p.id) || "user",
      postCount: postCountMap.get(p.id) || 0, reviewCount: reviewCountMap.get(p.id) || 0,
      banned: (p as any).banned ?? false,
    })));
  };

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("posts").select("id, user_id, caption, image_url, store_id, created_at, hidden")
      .order("created_at", { ascending: false }).limit(100);
    if (!data) { setPosts([]); return; }
    const userIds = [...new Set(data.map((p) => p.user_id))];
    const storeIds = [...new Set(data.filter((p) => p.store_id).map((p) => p.store_id!))];
    const [{ data: profiles }, { data: storesData }, { data: likes }, { data: comments }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", userIds),
      storeIds.length > 0 ? supabase.from("stores").select("id, name").in("id", storeIds) : { data: [] },
      supabase.from("post_likes").select("ref_id").in("ref_id", data.map((p) => p.id)),
      supabase.from("feed_comments").select("ref_id").in("ref_id", data.map((p) => p.id)),
    ]);
    const nameMap = new Map<string, string>();
    (profiles || []).forEach((p) => nameMap.set(p.id, p.display_name || "ผู้ใช้"));
    const storeNameMap = new Map<string, string>();
    (storesData || []).forEach((s) => storeNameMap.set(s.id, s.name));
    const likeMap = new Map<string, number>();
    (likes || []).forEach((l) => likeMap.set(l.ref_id, (likeMap.get(l.ref_id) || 0) + 1));
    const commentMap = new Map<string, number>();
    (comments || []).forEach((c) => commentMap.set(c.ref_id, (commentMap.get(c.ref_id) || 0) + 1));
    setPosts(data.map((p) => ({
      ...p, userName: nameMap.get(p.user_id) || "ผู้ใช้",
      store_name: p.store_id ? storeNameMap.get(p.store_id) || null : null,
      likeCount: likeMap.get(p.id) || 0, commentCount: commentMap.get(p.id) || 0,
      hidden: (p as any).hidden ?? false,
    })));
  };

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("menu_reviews").select("id, user_id, menu_item_id, score, created_at, shared, hidden")
      .order("created_at", { ascending: false }).limit(200);
    if (!data) { setReviews([]); return; }
    const userIds = [...new Set(data.map((r) => r.user_id))];
    const menuIds = [...new Set(data.map((r) => r.menu_item_id))];
    const [{ data: profiles }, { data: menuItems }] = await Promise.all([
      supabase.from("profiles").select("id, display_name").in("id", userIds),
      supabase.from("menu_items").select("id, name, store_id").in("id", menuIds),
    ]);
    const nameMap = new Map<string, string>();
    (profiles || []).forEach((p) => nameMap.set(p.id, p.display_name || "ผู้ใช้"));
    const menuMap = new Map<string, { name: string; store_id: string }>();
    (menuItems || []).forEach((m) => menuMap.set(m.id, { name: m.name, store_id: m.store_id }));
    const storeIds = [...new Set([...(menuItems || []).map((m) => m.store_id)])];
    const { data: storesData } = storeIds.length > 0
      ? await supabase.from("stores").select("id, name").in("id", storeIds)
      : { data: [] };
    const storeNameMap = new Map<string, string>();
    (storesData || []).forEach((s) => storeNameMap.set(s.id, s.name));
    setReviews(data.map((r) => {
      const menu = menuMap.get(r.menu_item_id);
      return {
        ...r, userName: nameMap.get(r.user_id) || "ผู้ใช้",
        menu_item_name: menu?.name || "เมนู",
        store_name: menu ? (storeNameMap.get(menu.store_id) || "ร้าน") : "ร้าน",
        shared: r.shared ?? true,
        hidden: (r as any).hidden ?? false,
      };
    }));
  };

  const fetchDna = async () => {
    const { data } = await supabase
      .from("dish_dna").select("menu_item_id, user_id, selected_score")
      .limit(500);
    if (!data || data.length === 0) { setDnaItems([]); return; }
    const grouped = new Map<string, { users: Set<string>; count: number; totalScore: number }>();
    data.forEach((d) => {
      if (!grouped.has(d.menu_item_id)) grouped.set(d.menu_item_id, { users: new Set(), count: 0, totalScore: 0 });
      const g = grouped.get(d.menu_item_id)!;
      g.users.add(d.user_id); g.count++; g.totalScore += d.selected_score;
    });
    const menuIds = [...grouped.keys()];
    const { data: menuItems } = await supabase.from("menu_items").select("id, name, store_id").in("id", menuIds);
    const storeIds = [...new Set((menuItems || []).map((m) => m.store_id))];
    const { data: storesData } = storeIds.length > 0
      ? await supabase.from("stores").select("id, name").in("id", storeIds)
      : { data: [] };
    const menuMap = new Map<string, { name: string; store_id: string }>();
    (menuItems || []).forEach((m) => menuMap.set(m.id, { name: m.name, store_id: m.store_id }));
    const storeNameMap = new Map<string, string>();
    (storesData || []).forEach((s) => storeNameMap.set(s.id, s.name));
    setDnaItems([...grouped.entries()].map(([id, g]) => {
      const menu = menuMap.get(id);
      return {
        menu_item_id: id, menu_item_name: menu?.name || "เมนู",
        store_name: menu ? (storeNameMap.get(menu.store_id) || "ร้าน") : "ร้าน",
        componentCount: g.count, userCount: g.users.size,
        avgScore: g.count > 0 ? g.totalScore / g.count : 0,
      };
    }).sort((a, b) => b.userCount - a.userCount));
  };

  /* ─── Actions ─── */
  const toggleVerification = async (storeId: string, current: boolean) => {
    haptic();
    await supabase.from("stores").update({ verified: !current }).eq("id", storeId);
    setStores((p) => p.map((s) => s.id === storeId ? { ...s, verified: !current } : s));
    toast({ title: !current ? "✅ ยืนยันร้านแล้ว" : "❌ ยกเลิกการยืนยัน" });
  };

  const changeRole = async (userId: string, newRole: string) => {
    haptic();
    if (newRole === "user") {
      await supabase.from("user_roles").delete().eq("user_id", userId);
    } else {
      await supabase.from("user_roles").upsert(
        { user_id: userId, role: newRole } as any,
        { onConflict: "user_id,role" }
      );
    }
    setUsers((p) => p.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    toast({ title: `เปลี่ยน role เป็น ${roleLabels[newRole]}` });
  };

  const deletePost = async (postId: string) => {
    haptic();
    await supabase.from("post_images").delete().eq("post_id", postId);
    await supabase.from("post_likes").delete().eq("ref_id", postId);
    await supabase.from("feed_comments").delete().eq("ref_id", postId);
    await supabase.from("posts").delete().eq("id", postId);
    setPosts((p) => p.filter((x) => x.id !== postId));
    toast({ title: "🗑️ ลบโพสแล้ว" });
  };

  const deleteReview = async (reviewId: string) => {
    haptic();
    await supabase.from("menu_reviews").delete().eq("id", reviewId);
    setReviews((p) => p.filter((r) => r.id !== reviewId));
    toast({ title: "🗑️ ลบรีวิวแล้ว" });
  };

  /* ─── Filters ─── */
  const filteredStores = stores.filter((s) => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.ownerEmail && s.ownerEmail.toLowerCase().includes(search.toLowerCase()));
    const matchFilter = storeFilter === "all" || (storeFilter === "verified" && s.verified) || (storeFilter === "unverified" && !s.verified);
    return matchSearch && matchFilter;
  });

  const filteredUsers = users.filter((u) =>
    !search || (u.display_name && u.display_name.toLowerCase().includes(search.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredPosts = posts.filter((p) =>
    !search || p.userName.toLowerCase().includes(search.toLowerCase()) ||
    (p.caption && p.caption.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredReviews = reviews.filter((r) =>
    !search || r.userName.toLowerCase().includes(search.toLowerCase()) ||
    r.menu_item_name.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryInfo = (id: string | null) => categories.find((c) => c.id === id);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}น`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}ชม`;
    return `${Math.floor(hrs / 24)}ว`;
  };

  /* ─── Access Denied ─── */
  if (!authLoading && !loading && !isAdmin) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="text-center space-y-3">
            <ShieldCheck size={48} className="mx-auto text-muted-foreground" />
            <h1 className="text-lg font-semibold text-foreground">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="text-sm text-muted-foreground">คุณไม่มีสิทธิ์แอดมิน</p>
            <button onClick={() => navigate("/")} className="text-sm text-score-emerald font-medium">
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-32">
        {/* Header */}
        <div className="sticky top-0 z-20 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground">ศูนย์ควบคุม</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Admin Control Center</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { haptic(); fetchAll(); }}
              className="p-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <RefreshCw size={16} className="text-muted-foreground" />
            </motion.button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-score-emerald/15 border border-score-emerald/30">
              <ShieldCheck size={14} className="text-score-emerald" />
              <span className="text-[10px] font-semibold text-score-emerald">ADMIN</span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="sticky top-[60px] z-10 glass-effect glass-border">
          <div className="flex overflow-x-auto gap-0.5 px-2 py-2 no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { haptic(); setActiveTab(tab.id); setSearch(""); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all",
                    active
                      ? "bg-foreground text-background shadow-luxury"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  )}
                >
                  <Icon size={13} />
                  {tab.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
            <span className="text-xs text-muted-foreground">กำลังโหลดข้อมูล...</span>
          </div>
        ) : (
          <div className="px-4 pt-4">
            <AnimatePresence mode="wait">
              {/* ─── Overview Tab ─── */}
              {activeTab === "overview" && stats && (
                <motion.div key="overview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  {/* Today highlight */}
                  <div className="rounded-2xl bg-gradient-to-br from-score-emerald/10 to-score-emerald/5 border border-score-emerald/20 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp size={16} className="text-score-emerald" />
                      <span className="text-xs font-semibold text-score-emerald">วันนี้</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <StatMini label="ผู้ใช้ใหม่" value={stats.newUsersToday} icon="👤" />
                      <StatMini label="รีวิวใหม่" value={stats.newReviewsToday} icon="⭐" />
                    </div>
                  </div>

                  {/* Main Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="ผู้ใช้ทั้งหมด" value={stats.totalUsers} icon="👥" color="bg-primary/5 border-primary/20" />
                    <StatCard label="ร้านค้าทั้งหมด" value={stats.totalStores} icon="🏪" color="bg-score-amber/5 border-score-amber/20" />
                    <StatCard label="รีวิวทั้งหมด" value={stats.totalReviews} icon="⭐" color="bg-score-emerald/5 border-score-emerald/20" />
                    <StatCard label="โพสทั้งหมด" value={stats.totalPosts} icon="📸" color="bg-score-ruby/5 border-score-ruby/20" />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <StatCard label="ร้านยืนยันแล้ว" value={stats.verifiedStores} icon="✅" color="bg-score-emerald/5 border-score-emerald/20" />
                    <StatCard label="Dish DNA" value={stats.totalDna} icon="🧬" color="bg-primary/5 border-primary/20" />
                  </div>

                  {/* Quick Action */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ลัด</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "ร้านรอยืนยัน", count: stores.filter((s) => !s.verified).length, tab: "stores" as AdminTab, emoji: "⏳" },
                        { label: "ผู้ใช้ล่าสุด", count: stats.newUsersToday, tab: "users" as AdminTab, emoji: "🆕" },
                      ].map((q) => (
                        <motion.button
                          key={q.label}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => { setActiveTab(q.tab); if (q.tab === "stores") setStoreFilter("unverified"); }}
                          className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-elevated border border-border/50 shadow-luxury text-left"
                        >
                          <span className="text-lg">{q.emoji}</span>
                          <div>
                            <p className="text-sm font-bold text-foreground">{q.count}</p>
                            <p className="text-[10px] text-muted-foreground">{q.label}</p>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── Stores Tab ─── */}
              {activeTab === "stores" && (
                <motion.div key="stores" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาร้าน..." />
                  <div className="flex gap-2">
                    {(["all", "verified", "unverified"] as const).map((f) => (
                      <FilterChip key={f} active={storeFilter === f} label={f === "all" ? "ทั้งหมด" : f === "verified" ? "✅ ยืนยัน" : "⏳ รอ"} onClick={() => setStoreFilter(f)} />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{filteredStores.length} ร้าน</p>
                  <div className="space-y-2">
                    {filteredStores.map((store) => {
                      const cat = getCategoryInfo(store.category_id);
                      const tier = getTrustTier(store.reviewCount, store.verified);
                      return (
                        <motion.div key={store.id} layout className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className="text-xl flex-shrink-0">{cat?.icon ?? "🏪"}</span>
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold text-foreground truncate">{store.name}</h3>
                                <p className="text-[10px] text-muted-foreground">{cat?.label ?? "ไม่ระบุ"} · {store.reviewCount} รีวิว</p>
                                {store.ownerEmail && <p className="text-[10px] text-muted-foreground truncate">👤 {store.ownerEmail}</p>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <TrustTierBadge tier={tier} compact />
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => toggleVerification(store.id, store.verified)}
                                className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                                  store.verified ? "bg-destructive/10 text-destructive" : "bg-score-emerald/15 text-score-emerald"
                                )}
                              >
                                {store.verified ? <><XCircle size={12} /> ยกเลิก</> : <><CheckCircle2 size={12} /> ยืนยัน</>}
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ─── Users Tab ─── */}
              {activeTab === "users" && (
                <motion.div key="users" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาผู้ใช้..." />
                  <p className="text-[10px] text-muted-foreground">{filteredUsers.length} ผู้ใช้</p>
                  <div className="space-y-2">
                    {filteredUsers.map((u) => {
                      const RoleIcon = roleIcons[u.role] || UserIcon;
                      return (
                        <motion.div key={u.id} layout className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden shrink-0 ring-2 ring-border/30">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                                  {(u.display_name || "?").charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{u.display_name || "ไม่มีชื่อ"}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{u.email || "—"}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted-foreground">📸 {u.postCount}</span>
                                <span className="text-[10px] text-muted-foreground">⭐ {u.reviewCount}</span>
                                <span className="text-[10px] text-muted-foreground">· {timeAgo(u.created_at)}</span>
                              </div>
                            </div>
                            <RoleSelector currentRole={u.role} onChange={(role) => changeRole(u.id, role)} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ─── Content Tab ─── */}
              {activeTab === "content" && (
                <motion.div key="content" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="flex gap-2 mb-1">
                    <FilterChip active={contentTab === "posts"} label={`📸 โพส (${posts.length})`} onClick={() => setContentTab("posts")} />
                    <FilterChip active={contentTab === "reviews"} label={`⭐ รีวิว (${reviews.length})`} onClick={() => setContentTab("reviews")} />
                  </div>
                  <SearchBar value={search} onChange={setSearch} placeholder="ค้นหา..." />

                  {contentTab === "posts" && (
                    <div className="space-y-2">
                      {filteredPosts.map((p) => (
                        <motion.div key={p.id} layout className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 overflow-hidden">
                          <div className="flex gap-3 p-3">
                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary shrink-0">
                              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{p.userName}</p>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{p.caption || "ไม่มีคำอธิบาย"}</p>
                              {p.store_name && <p className="text-[10px] text-muted-foreground mt-0.5">🏪 {p.store_name}</p>}
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-muted-foreground">❤️ {p.likeCount}</span>
                                <span className="text-[10px] text-muted-foreground">💬 {p.commentCount}</span>
                                <span className="text-[10px] text-muted-foreground/60 ml-auto">{timeAgo(p.created_at)}</span>
                              </div>
                            </div>
                            <ConfirmDeleteButton onDelete={() => deletePost(p.id)} />
                          </div>
                        </motion.div>
                      ))}
                      {filteredPosts.length === 0 && <EmptyState text="ไม่พบโพส" />}
                    </div>
                  )}

                  {contentTab === "reviews" && (
                    <div className="space-y-2">
                      {filteredReviews.map((r) => {
                        const tier = getScoreTier(r.score);
                        return (
                          <motion.div key={r.id} layout className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 p-3">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
                                `bg-score-${tier}/10`, tierColors[tier]
                              )}>
                                {r.score > 0 ? "+" : ""}{r.score}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{r.menu_item_name}</p>
                                <p className="text-[10px] text-muted-foreground">{r.userName} · {r.store_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded-md font-medium",
                                    r.shared ? "bg-score-emerald/10 text-score-emerald" : "bg-secondary text-muted-foreground"
                                  )}>
                                    {r.shared ? "แชร์แล้ว" : "ส่วนตัว"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground/60">{timeAgo(r.created_at)}</span>
                                </div>
                              </div>
                              <ConfirmDeleteButton onDelete={() => deleteReview(r.id)} />
                            </div>
                          </motion.div>
                        );
                      })}
                      {filteredReviews.length === 0 && <EmptyState text="ไม่พบรีวิว" />}
                    </div>
                  )}
                </motion.div>
              )}

              {/* ─── Feedback Tab (DNA & Sensory) ─── */}
              {activeTab === "feedback" && (
                <motion.div key="feedback" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                  <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-score-emerald/5 border border-primary/20 p-4 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Dna size={16} className="text-score-emerald" />
                      <span className="text-xs font-semibold text-foreground">Dish DNA Analytics</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <StatMini label="เมนูที่มี DNA" value={dnaItems.length} icon="🍽️" />
                      <StatMini label="ผู้ประเมินรวม" value={dnaItems.reduce((s, d) => s + d.userCount, 0)} icon="👥" />
                    </div>
                  </div>

                  <SearchBar value={search} onChange={setSearch} placeholder="ค้นหาเมนู..." />

                  <div className="space-y-2">
                    {dnaItems
                      .filter((d) => !search || d.menu_item_name.toLowerCase().includes(search.toLowerCase()) || d.store_name.toLowerCase().includes(search.toLowerCase()))
                      .map((d) => {
                        const tier = getScoreTier(d.avgScore);
                        return (
                          <motion.div key={d.menu_item_id} layout className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 p-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-12 h-12 rounded-xl flex flex-col items-center justify-center",
                                `bg-score-${tier}/10`
                              )}>
                                <span className="text-lg">🧬</span>
                                <span className={cn("text-[9px] font-bold", tierColors[tier])}>
                                  {d.avgScore > 0 ? "+" : ""}{d.avgScore.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{d.menu_item_name}</p>
                                <p className="text-[10px] text-muted-foreground">{d.store_name}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] text-muted-foreground">👥 {d.userCount} คน</span>
                                  <span className="text-[10px] text-muted-foreground">🔬 {d.componentCount} components</span>
                                </div>
                              </div>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => navigate(`/dish-dna/${d.menu_item_id}`)}
                                className="p-2 rounded-lg bg-secondary hover:bg-accent transition-colors"
                              >
                                <Eye size={14} className="text-muted-foreground" />
                              </motion.button>
                            </div>
                          </motion.div>
                        );
                      })}
                    {dnaItems.length === 0 && <EmptyState text="ยังไม่มี Dish DNA" />}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

/* ─── Sub Components ─── */
const StatCard = ({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) => (
  <div className={cn("rounded-2xl border p-4 text-center", color)}>
    <span className="text-2xl">{icon}</span>
    <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value.toLocaleString()}</p>
    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
  </div>
);

const StatMini = ({ label, value, icon }: { label: string; value: number; icon: string }) => (
  <div className="flex items-center gap-2">
    <span className="text-base">{icon}</span>
    <div>
      <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  </div>
);

const SearchBar = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative">
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    <input
      type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/50 focus:border-score-emerald/50 transition-colors"
    />
  </div>
);

const FilterChip = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
      active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
    )}
  >
    {label}
  </button>
);

const EmptyState = ({ text }: { text: string }) => (
  <p className="text-center text-sm text-muted-foreground py-10">{text}</p>
);

const RoleSelector = ({ currentRole, onChange }: { currentRole: string; onChange: (role: string) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => { haptic(); setOpen(!open); }}
        className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors", roleColors[currentRole])}
      >
        {React.createElement(roleIcons[currentRole] || UserIcon, { size: 10 })}
        {roleLabels[currentRole]}
        <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            className="absolute right-0 top-full mt-1 z-30 bg-surface-elevated border border-border/50 rounded-xl shadow-luxury overflow-hidden min-w-[100px]"
          >
            {(["admin", "moderator", "user"] as const).map((role) => (
              <button
                key={role}
                onClick={() => { onChange(role); setOpen(false); }}
                className={cn("w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium hover:bg-secondary transition-colors text-left",
                  currentRole === role && "bg-secondary"
                )}
              >
                {React.createElement(roleIcons[role], { size: 10 })}
                {roleLabels[role]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ConfirmDeleteButton = ({ onDelete }: { onDelete: () => void }) => {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (confirm) {
      const t = setTimeout(() => setConfirm(false), 3000);
      return () => clearTimeout(t);
    }
  }, [confirm]);

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => {
        if (confirm) { onDelete(); setConfirm(false); }
        else { haptic(); setConfirm(true); }
      }}
      className={cn("p-2 rounded-lg transition-colors shrink-0",
        confirm ? "bg-destructive/15 text-destructive" : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
      )}
    >
      <Trash2 size={14} />
    </motion.button>
  );
};

// Need React import for createElement
import React from "react";

export default AdminDashboard;
