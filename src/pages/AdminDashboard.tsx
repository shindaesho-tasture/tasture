import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ShieldCheck, Search, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { categories } from "@/lib/categories";
import { getTrustTier } from "@/lib/trust-tiers";
import TrustTierBadge from "@/components/TrustTierBadge";
import PageTransition from "@/components/PageTransition";
import { toast } from "@/hooks/use-toast";

interface AdminStore {
  id: string;
  name: string;
  category_id: string | null;
  verified: boolean;
  created_at: string;
  user_id: string;
  reviewCount: number;
  ownerEmail: string | null;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    checkAdminAndFetch();
  }, [user, authLoading]);

  const checkAdminAndFetch = async () => {
    if (!user) return;
    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);
    await fetchAllStores();
  };

  const fetchAllStores = async () => {
    setLoading(true);
    try {
      const { data: storesData, error } = await supabase
        .from("stores")
        .select("id, name, category_id, verified, created_at, user_id")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get review counts
      const storeIds = (storesData || []).map((s) => s.id);
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("store_id")
        .in("store_id", storeIds);

      const countMap = new Map<string, number>();
      (reviewsData || []).forEach((r) => {
        countMap.set(r.store_id, (countMap.get(r.store_id) || 0) + 1);
      });

      // Get owner emails
      const userIds = [...new Set((storesData || []).map((s) => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      const emailMap = new Map<string, string>();
      (profiles || []).forEach((p) => {
        if (p.email) emailMap.set(p.id, p.email);
      });

      const result: AdminStore[] = (storesData || []).map((s) => ({
        ...s,
        reviewCount: countMap.get(s.id) || 0,
        ownerEmail: emailMap.get(s.user_id) || null,
      }));

      setStores(result);
    } catch (err) {
      console.error("Failed to fetch stores:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async (storeId: string, currentVerified: boolean) => {
    const { error } = await supabase
      .from("stores")
      .update({ verified: !currentVerified })
      .eq("id", storeId);

    if (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
      return;
    }

    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, verified: !currentVerified } : s))
    );
    toast({
      title: !currentVerified ? "✅ ยืนยันร้านแล้ว" : "❌ ยกเลิกการยืนยัน",
      description: !currentVerified ? "ร้านได้รับการยืนยันเรียบร้อย" : "ยกเลิกการยืนยันร้านแล้ว",
    });
  };

  const getCategoryInfo = (categoryId: string | null) =>
    categories.find((c) => c.id === categoryId);

  const filteredStores = stores.filter((s) => {
    const matchSearch =
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.ownerEmail && s.ownerEmail.toLowerCase().includes(search.toLowerCase()));
    const matchFilter =
      filter === "all" ||
      (filter === "verified" && s.verified) ||
      (filter === "unverified" && !s.verified);
    return matchSearch && matchFilter;
  });

  if (!authLoading && !loading && !isAdmin) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="text-center space-y-3">
            <ShieldCheck size={48} className="mx-auto text-muted-foreground" />
            <h1 className="text-lg font-semibold text-foreground">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="text-sm text-muted-foreground">คุณไม่มีสิทธิ์แอดมิน</p>
            <button
              onClick={() => navigate("/")}
              className="text-sm text-score-emerald font-medium"
            >
              กลับหน้าหลัก
            </button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-8">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground">
                แอดมิน
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                Admin Dashboard
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-score-emerald/15 border border-score-emerald/30">
              <ShieldCheck size={14} className="text-score-emerald" />
              <span className="text-[10px] font-semibold text-score-emerald">ADMIN</span>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="ค้นหาร้าน หรือ อีเมล..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary text-sm text-foreground placeholder:text-muted-foreground outline-none border border-border/50 focus:border-score-emerald/50 transition-colors"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "verified", "unverified"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    filter === f
                      ? "bg-foreground text-background"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {f === "all" ? "ทั้งหมด" : f === "verified" ? "✅ ยืนยันแล้ว" : "⏳ รอยืนยัน"}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-secondary p-3 text-center">
              <p className="text-xl font-bold text-foreground">{stores.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">ร้านทั้งหมด</p>
            </div>
            <div className="rounded-xl bg-score-emerald/10 p-3 text-center">
              <p className="text-xl font-bold text-score-emerald">
                {stores.filter((s) => s.verified).length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">ยืนยันแล้ว</p>
            </div>
            <div className="rounded-xl bg-score-amber/10 p-3 text-center">
              <p className="text-xl font-bold text-score-amber">
                {stores.filter((s) => !s.verified).length}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">รอยืนยัน</p>
            </div>
          </div>

          {/* Store List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-score-emerald border-t-transparent animate-spin" />
              <span className="text-xs text-muted-foreground">กำลังโหลด...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStores.map((store) => {
                const cat = getCategoryInfo(store.category_id);
                const tier = getTrustTier(store.reviewCount, store.verified);

                return (
                  <motion.div
                    key={store.id}
                    layout
                    className="rounded-2xl bg-surface-elevated shadow-luxury border border-border/50 overflow-hidden"
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-xl flex-shrink-0">{cat?.icon ?? "🏪"}</span>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-foreground truncate">
                              {store.name}
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {cat?.label ?? "ไม่ระบุ"} · {store.reviewCount} รีวิว
                            </p>
                            {store.ownerEmail && (
                              <p className="text-[10px] text-muted-foreground truncate">
                                👤 {store.ownerEmail}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <TrustTierBadge tier={tier} compact />
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => toggleVerification(store.id, store.verified)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                              store.verified
                                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : "bg-score-emerald/15 text-score-emerald hover:bg-score-emerald/25"
                            }`}
                          >
                            {store.verified ? (
                              <>
                                <XCircle size={12} /> ยกเลิก
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={12} /> ยืนยัน
                              </>
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {filteredStores.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-10">
                  ไม่พบร้านที่ตรงกับตัวกรอง
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default AdminDashboard;
