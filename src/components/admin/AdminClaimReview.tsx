import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Clock, Store, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Claim {
  id: string;
  store_id: string;
  claimant_id: string;
  status: string;
  reason: string | null;
  admin_note: string | null;
  created_at: string;
  store_name: string;
  claimant_email: string | null;
  claimant_name: string | null;
}

const AdminClaimReview = () => {
  const { toast } = useToast();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const fetchClaims = async () => {
    setLoading(true);
    let query = (supabase as any).from("store_claims")
      .select("id, store_id, claimant_id, status, reason, admin_note, created_at")
      .order("created_at", { ascending: false });

    if (filter === "pending") {
      query = query.eq("status", "pending");
    }

    const { data } = await query;
    if (!data || data.length === 0) { setClaims([]); setLoading(false); return; }

    const storeIds = [...new Set(data.map((c: any) => c.store_id))] as string[];
    const claimantIds = [...new Set(data.map((c: any) => c.claimant_id))] as string[];

    const [storesRes, profilesRes] = await Promise.all([
      supabase.from("stores").select("id, name").in("id", storeIds),
      supabase.from("profiles").select("id, display_name, email").in("id", claimantIds),
    ]);

    const storeMap = new Map((storesRes.data || []).map((s) => [s.id, s.name]));
    const profileMap = new Map((profilesRes.data || []).map((p) => [p.id, p]));

    setClaims(data.map((c: any) => {
      const profile = profileMap.get(c.claimant_id);
      return {
        ...c,
        store_name: storeMap.get(c.store_id) || "—",
        claimant_email: profile?.email || null,
        claimant_name: profile?.display_name || null,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { fetchClaims(); }, [filter]);

  const handleAction = async (claim: Claim, action: "approved" | "rejected") => {
    setActionLoading(claim.id);
    if (navigator.vibrate) navigator.vibrate(8);
    try {
      // Update claim status
      const adminNote = noteInputs[claim.id]?.trim() || null;
      const { error } = await (supabase as any)
        .from("store_claims")
        .update({ status: action, admin_note: adminNote, updated_at: new Date().toISOString() })
        .eq("id", claim.id);
      if (error) throw error;

      // If approved, transfer store ownership
      if (action === "approved") {
        const { error: storeErr } = await supabase
          .from("stores")
          .update({ user_id: claim.claimant_id } as any)
          .eq("id", claim.store_id);
        if (storeErr) throw storeErr;
      }

      // Notify merchant
      await supabase.from("notifications").insert({
        user_id: claim.claimant_id,
        type: "claim",
        title: action === "approved"
          ? `✅ คำขอเชื่อมร้าน "${claim.store_name}" ได้รับการอนุมัติแล้ว`
          : `❌ คำขอเชื่อมร้าน "${claim.store_name}" ถูกปฏิเสธ`,
        body: adminNote || (action === "approved" ? "ร้านถูกโอนมาให้คุณแล้ว" : "กรุณาติดต่อ Admin หากมีข้อสงสัย"),
        ref_type: "store",
        ref_id: claim.store_id,
      });

      toast({ title: action === "approved" ? "✅ อนุมัติแล้ว — โอนร้านเรียบร้อย" : "❌ ปฏิเสธแล้ว" });
      fetchClaims();
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const statusCfg: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: "รออนุมัติ", color: "text-amber-600", bg: "bg-amber-500/10" },
    approved: { label: "อนุมัติแล้ว", color: "text-score-emerald", bg: "bg-score-emerald/10" },
    rejected: { label: "ปฏิเสธ", color: "text-destructive", bg: "bg-destructive/10" },
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {(["pending", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}>
            {f === "pending" ? "รอดำเนินการ" : "ทั้งหมด"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-12">
          <Store size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">ไม่มีคำขอ</p>
        </div>
      ) : (
        <AnimatePresence>
          {claims.map((claim) => {
            const cfg = statusCfg[claim.status] || statusCfg.pending;
            const isPending = claim.status === "pending";
            return (
              <motion.div key={claim.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                <div className="px-4 py-3 space-y-2">
                  {/* Store info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Store size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{claim.store_name}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(claim.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Claimant info */}
                  <div className="flex items-center gap-2 px-1">
                    <User size={12} className="text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">
                      {claim.claimant_name || claim.claimant_email || claim.claimant_id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Reason */}
                  {claim.reason && (
                    <div className="px-3 py-2 rounded-xl bg-secondary">
                      <p className="text-[11px] text-foreground">"{claim.reason}"</p>
                    </div>
                  )}

                  {/* Admin note input + actions */}
                  {isPending && (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        value={noteInputs[claim.id] || ""}
                        onChange={(e) => setNoteInputs((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                        placeholder="หมายเหตุ admin (ไม่บังคับ)"
                        className="w-full px-3 py-2 rounded-xl bg-secondary text-foreground text-xs border border-border/50 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                      />
                      <div className="flex gap-2">
                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={() => handleAction(claim, "approved")}
                          disabled={actionLoading === claim.id}
                          className="flex-1 py-2.5 rounded-xl bg-score-emerald text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                          {actionLoading === claim.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                          อนุมัติ (โอนร้าน)
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.95 }}
                          onClick={() => handleAction(claim, "rejected")}
                          disabled={actionLoading === claim.id}
                          className="flex-1 py-2.5 rounded-xl bg-destructive/10 text-destructive text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                          <XCircle size={14} />
                          ปฏิเสธ
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {/* Admin note (for reviewed) */}
                  {!isPending && claim.admin_note && (
                    <div className="px-3 py-2 rounded-xl bg-muted/50">
                      <p className="text-[10px] text-muted-foreground">
                        <span className="font-semibold">หมายเหตุ: </span>{claim.admin_note}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
};

export default AdminClaimReview;
