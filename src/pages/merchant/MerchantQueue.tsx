import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, PhoneCall, CheckCircle2, XCircle, RefreshCw,
  Loader2, Bell, BellOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMerchant } from "@/lib/merchant-context";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";
import MerchantBottomNav from "@/components/merchant/MerchantBottomNav";
import { Skeleton } from "@/components/ui/skeleton";
import { useMerchantNotifications } from "@/hooks/use-merchant-notifications";

interface QueueEntry {
  id: string;
  queue_number: number;
  status: string;
  party_size: number;
  user_id: string;
  created_at: string;
  profileName?: string;
}

const statusCfg: Record<string, { label: string; labelEn: string; color: string; bg: string }> = {
  waiting: { label: "รอ", labelEn: "Waiting", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  called:  { label: "เรียกแล้ว", labelEn: "Called", color: "text-score-emerald", bg: "bg-score-emerald/10" },
  completed: { label: "เสร็จ", labelEn: "Done", color: "text-muted-foreground", bg: "bg-secondary" },
  cancelled: { label: "ยกเลิก", labelEn: "Cancelled", color: "text-destructive", bg: "bg-destructive/10" },
};

const MerchantQueue = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeStore, loading: storeLoading, soundEnabled: soundOn, setSoundEnabled: setSoundOn } = useMerchant();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isTh = language === "th";

  const [queues, setQueues] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");
  // Auth guard
  useEffect(() => {
    if (authLoading || storeLoading) return;
    if (!user) { navigate("/m/login", { replace: true }); return; }
    if (!activeStore) { navigate("/m", { replace: true }); return; }
  }, [user, authLoading, activeStore, storeLoading]);

  const storeId = activeStore?.id;

  const fetchQueues = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const { data } = await supabase
      .from("queues")
      .select("id, queue_number, status, party_size, user_id, created_at")
      .eq("store_id", storeId)
      .gte("created_at", today)
      .order("queue_number", { ascending: true });

    if (data) {
      const userIds = [...new Set(data.map((q: any) => q.user_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      const pMap = new Map((profiles || []).map((p) => [p.id, p.display_name]));
      setQueues(data.map((q: any) => ({ ...q, profileName: pMap.get(q.user_id) || undefined })));
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchQueues(); }, [fetchQueues]);

  // Realtime
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`m-queue-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues", filter: `store_id=eq.${storeId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            if (soundOn && navigator.vibrate) navigator.vibrate([80, 40, 80]);
            toast({ title: isTh ? "🆕 คิวใหม่!" : "🆕 New queue!", description: `#${(payload.new as any).queue_number}` });
          }
          fetchQueues();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [storeId, soundOn, isTh, fetchQueues]);

  const updateStatus = async (queueId: string, newStatus: string) => {
    setActionLoading(queueId);
    if (navigator.vibrate) navigator.vibrate(8);
    try {
      const { error } = await supabase.from("queues").update({ status: newStatus }).eq("id", queueId);
      if (error) throw error;
      setQueues((prev) => prev.map((q) => (q.id === queueId ? { ...q, status: newStatus } : q)));
      const labels: Record<string, string> = {
        called: isTh ? "เรียกคิวแล้ว" : "Called",
        completed: isTh ? "เสร็จสิ้น" : "Completed",
        cancelled: isTh ? "ยกเลิกแล้ว" : "Cancelled",
      };
      toast({ title: labels[newStatus] || "Updated" });
    } catch (err: any) {
      toast({ title: isTh ? "เกิดข้อผิดพลาด" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const waitingCount = queues.filter((q) => q.status === "waiting").length;
  const calledCount = queues.filter((q) => q.status === "called").length;
  const completedCount = queues.filter((q) => q.status === "completed").length;
  const activeQueues = queues.filter((q) => q.status === "waiting" || q.status === "called");
  const displayQueues = filter === "active" ? activeQueues : queues;

  if (authLoading || storeLoading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background pb-24 px-4 pt-16 space-y-3">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <MerchantBottomNav />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-28">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Users size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                {isTh ? "จัดการคิว" : "Queue Manager"}
              </h1>
              <p className="text-[10px] text-muted-foreground truncate">
                {activeStore?.name}
              </p>
            </div>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => setSoundOn(!soundOn)}
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
              {soundOn ? <Bell size={16} className="text-score-emerald" /> : <BellOff size={16} className="text-muted-foreground" />}
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={fetchQueues}
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
              <RefreshCw size={16} className="text-muted-foreground" />
            </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pt-4 grid grid-cols-3 gap-2">
          {[
            { n: waitingCount, label: isTh ? "รอ" : "Waiting", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
            { n: calledCount, label: isTh ? "เรียกแล้ว" : "Called", color: "text-score-emerald", bg: "bg-score-emerald/10" },
            { n: completedCount, label: isTh ? "เสร็จ" : "Done", color: "text-muted-foreground", bg: "bg-secondary" },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl border border-border/40 ${s.bg} p-3 text-center`}>
              <motion.span key={s.n} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={`text-2xl font-black ${s.color}`}>
                {s.n}
              </motion.span>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="px-4 pt-4 flex gap-2">
          {(["active", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
              {f === "active" ? (isTh ? "กำลังดำเนินการ" : "Active") : (isTh ? "ทั้งหมด" : "All")}
            </button>
          ))}
        </div>

        {/* Queue List */}
        <div className="px-4 pt-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{isTh ? "กำลังโหลด..." : "Loading..."}</span>
            </div>
          ) : displayQueues.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                <Users size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{isTh ? "ยังไม่มีคิว" : "No queues yet"}</p>
            </div>
          ) : (
            <AnimatePresence>
              {displayQueues.map((q, i) => {
                const cfg = statusCfg[q.status] || statusCfg.waiting;
                const isActive = q.status === "waiting" || q.status === "called";
                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-2xl border bg-card overflow-hidden ${
                      q.status === "called" ? "ring-2 ring-score-emerald/40 border-score-emerald/20" : "border-border/50"
                    }`}
                  >
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                        <span className={`text-lg font-black ${cfg.color}`}>#{q.queue_number}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {q.profileName || (isTh ? "ลูกค้า" : "Guest")}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            <Users size={10} className="inline mr-0.5" />
                            {q.party_size} {isTh ? "คน" : "pax"}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
                            {isTh ? cfg.label : cfg.labelEn}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(q.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      {isActive && (
                        <div className="flex items-center gap-1.5">
                          {q.status === "waiting" && (
                            <motion.button whileTap={{ scale: 0.85 }}
                              onClick={() => updateStatus(q.id, "called")}
                              disabled={actionLoading === q.id}
                              className="w-9 h-9 rounded-xl bg-score-emerald flex items-center justify-center shadow-md disabled:opacity-50"
                              title={isTh ? "เรียกคิว" : "Call"}>
                              {actionLoading === q.id ? <Loader2 size={14} className="animate-spin text-white" /> : <PhoneCall size={14} className="text-white" />}
                            </motion.button>
                          )}
                          {q.status === "called" && (
                            <motion.button whileTap={{ scale: 0.85 }}
                              onClick={() => updateStatus(q.id, "completed")}
                              disabled={actionLoading === q.id}
                              className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md disabled:opacity-50"
                              title={isTh ? "เสร็จ" : "Done"}>
                              {actionLoading === q.id ? <Loader2 size={14} className="animate-spin text-primary-foreground" /> : <CheckCircle2 size={14} className="text-primary-foreground" />}
                            </motion.button>
                          )}
                          <motion.button whileTap={{ scale: 0.85 }}
                            onClick={() => updateStatus(q.id, "cancelled")}
                            disabled={actionLoading === q.id}
                            className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center disabled:opacity-50"
                            title={isTh ? "ยกเลิก" : "Cancel"}>
                            <XCircle size={14} className="text-destructive" />
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <MerchantBottomNav />
      </div>
    </PageTransition>
  );
};

export default MerchantQueue;
