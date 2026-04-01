import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Store, Send, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/hooks/use-toast";
import { categories } from "@/lib/categories";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";

interface StoreResult {
  id: string;
  name: string;
  category_id: string | null;
  verified: boolean;
  user_id: string;
}

interface ClaimRecord {
  id: string;
  store_id: string;
  status: string;
  reason: string | null;
  admin_note: string | null;
  created_at: string;
  store_name?: string;
}

const MerchantClaimStore = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: storeLoading } = useMerchant();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isTh = language === "th";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StoreResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [myClaims, setMyClaims] = useState<ClaimRecord[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreResult | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || storeLoading) return;
    if (!user) { navigate("/m/login", { replace: true }); return; }
    fetchMyClaims();
  }, [user, authLoading, storeLoading]);

  const fetchMyClaims = async () => {
    if (!user) return;
    setLoadingClaims(true);
    const { data } = await (supabase as any)
      .from("store_claims")
      .select("id, store_id, status, reason, admin_note, created_at")
      .eq("claimant_id", user.id)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const storeIds = [...new Set(data.map((c: any) => c.store_id))] as string[];
      const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds);
      const nameMap = new Map((stores || []).map((s) => [s.id, s.name]));
      setMyClaims(data.map((c: any) => ({ ...c, store_name: nameMap.get(c.store_id) || "—" })));
    } else {
      setMyClaims([]);
    }
    setLoadingClaims(false);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("stores")
      .select("id, name, category_id, verified, user_id")
      .ilike("name", `%${query.trim()}%`)
      .neq("user_id", user!.id)
      .limit(20);
    setResults(data || []);
    setSearching(false);
  };

  const handleSubmitClaim = async () => {
    if (!selectedStore || !user) return;
    if (navigator.vibrate) navigator.vibrate(8);
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("store_claims")
        .insert({
          store_id: selectedStore.id,
          claimant_id: user.id,
          reason: reason.trim() || null,
          status: "pending",
        });
      if (error) throw error;
      toast({ title: isTh ? "ส่งคำขอเรียบร้อย" : "Claim submitted", description: isTh ? "รอ Admin อนุมัติ" : "Waiting for admin approval" });
      setSelectedStore(null);
      setReason("");
      setResults([]);
      setQuery("");
      fetchMyClaims();
    } catch (err: any) {
      if (err.code === "23505") {
        toast({ title: isTh ? "คุณเคยยื่นคำขอร้านนี้แล้ว" : "Already claimed", variant: "destructive" });
      } else {
        toast({ title: isTh ? "เกิดข้อผิดพลาด" : "Error", description: err.message, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const statusCfg: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    pending: { label: isTh ? "รออนุมัติ" : "Pending", icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
    approved: { label: isTh ? "อนุมัติแล้ว" : "Approved", icon: CheckCircle2, color: "text-score-emerald", bg: "bg-score-emerald/10" },
    rejected: { label: isTh ? "ถูกปฏิเสธ" : "Rejected", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-28">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Store size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                {isTh ? "เชื่อมร้านค้า" : "Claim Store"}
              </h1>
              <p className="text-[10px] text-muted-foreground">
                {isTh ? "ค้นหาร้านที่มีอยู่แล้วในระบบ" : "Find your existing store"}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={isTh ? "ค้นหาชื่อร้าน..." : "Search store name..."}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleSearch} disabled={searching || !query.trim()}
              className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
              {searching ? <Loader2 size={16} className="animate-spin" /> : (isTh ? "ค้นหา" : "Search")}
            </motion.button>
          </div>
        </div>

        {/* Search Results */}
        {results.length > 0 && (
          <div className="px-4 pt-4 space-y-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              {isTh ? `พบ ${results.length} ร้าน` : `${results.length} stores found`}
            </p>
            {results.map((store) => {
              const cat = categories.find((c) => c.id === store.category_id);
              const isSelected = selectedStore?.id === store.id;
              return (
                <motion.button key={store.id} whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedStore(isSelected ? null : store)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                    isSelected ? "border-primary/40 bg-primary/5 ring-2 ring-primary/20" : "border-border/50 bg-card"
                  }`}>
                  <span className="text-xl">{cat?.icon ?? "🏪"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{store.name}</p>
                    <p className="text-[10px] text-muted-foreground">{cat?.label ?? "Store"}</p>
                  </div>
                  {store.verified && (
                    <span className="text-[9px] text-score-emerald font-bold bg-score-emerald/10 px-1.5 py-0.5 rounded-md">
                      ✓ {isTh ? "ยืนยันแล้ว" : "Verified"}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Claim Form */}
        <AnimatePresence>
          {selectedStore && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="px-4 pt-4">
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-bold text-foreground">
                  {isTh ? `ยื่นคำขอเชื่อม "${selectedStore.name}"` : `Claim "${selectedStore.name}"`}
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={isTh ? "อธิบายว่าคุณเป็นเจ้าของร้านนี้อย่างไร (ไม่บังคับ)" : "Explain how you're the owner (optional)"}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-secondary text-foreground text-sm border border-border/50 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 resize-none"
                />
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmitClaim} disabled={submitting}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {isTh ? "ส่งคำขอ" : "Submit Claim"}
                </motion.button>
                <p className="text-[10px] text-muted-foreground text-center">
                  {isTh ? "Admin จะตรวจสอบและอนุมัติคำขอของคุณ" : "Admin will review and approve your request"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* My Claims */}
        <div className="px-4 pt-6">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
            {isTh ? "คำขอของฉัน" : "My Claims"}
          </p>
          {loadingClaims ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-primary" />
            </div>
          ) : myClaims.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">{isTh ? "ยังไม่มีคำขอ" : "No claims yet"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {myClaims.map((claim) => {
                const cfg = statusCfg[claim.status] || statusCfg.pending;
                const StatusIcon = cfg.icon;
                return (
                  <motion.div key={claim.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border bg-card overflow-hidden ${
                      claim.status === "rejected" ? "border-destructive/30" : "border-border/50"
                    }`}>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                        <StatusIcon size={16} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{claim.store_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(claim.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                    {claim.admin_note && (
                      <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-secondary">
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-semibold">{isTh ? "หมายเหตุ: " : "Note: "}</span>
                          {claim.admin_note}
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <MerchantBottomNav />
      </div>
    </PageTransition>
  );
};

export default MerchantClaimStore;
