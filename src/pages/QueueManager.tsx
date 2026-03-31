import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Users, PhoneCall, CheckCircle2, XCircle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";

interface QueueEntry {
  id: string;
  queue_number: number;
  status: string;
  party_size: number;
  user_id: string;
  created_at: string;
  profile?: { display_name: string | null };
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: "รอ", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
  called: { label: "เรียกแล้ว", color: "text-score-emerald", bg: "bg-score-emerald/15" },
  completed: { label: "เสร็จ", color: "text-muted-foreground", bg: "bg-secondary" },
  cancelled: { label: "ยกเลิก", color: "text-destructive", bg: "bg-destructive/10" },
};

const QueueManager = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();

  const [storeName, setStoreName] = useState("");
  const [queues, setQueues] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");

  // Fetch store info & queues
  useEffect(() => {
    if (authLoading || !user || !storeId) return;

    const fetchData = async () => {
      setLoading(true);

      // Verify ownership
      const { data: store } = await supabase
        .from("stores")
        .select("name, user_id")
        .eq("id", storeId)
        .single();

      if (!store || store.user_id !== user.id) {
        toast({ title: "ไม่มีสิทธิ์เข้าถึง", variant: "destructive" });
        navigate("/");
        return;
      }
      setStoreName(store.name);

      await fetchQueues();
    };
    fetchData();
  }, [storeId, user, authLoading]);

  const fetchQueues = async () => {
    if (!storeId) return;
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);

    const { data } = await (supabase as any)
      .from("queues")
      .select("id, queue_number, status, party_size, user_id, created_at")
      .eq("store_id", storeId)
      .gte("created_at", today)
      .order("queue_number", { ascending: true });

    if (data) {
      // Fetch profiles for display names
      const userIds = [...new Set(data.map((q: any) => q.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      setQueues(
        data.map((q: any) => ({
          ...q,
          profile: profileMap.get(q.user_id) || null,
        }))
      );
    }
    setLoading(false);
  };

  // Realtime
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`queue-mgr-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues", filter: `store_id=eq.${storeId}` },
        () => {
          // Refetch on any change
          fetchQueues();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId]);

  const updateStatus = async (queueId: string, newStatus: string) => {
    setActionLoading(queueId);
    try {
      const { error } = await (supabase as any)
        .from("queues")
        .update({ status: newStatus })
        .eq("id", queueId);

      if (error) throw error;

      setQueues((prev) =>
        prev.map((q) => (q.id === queueId ? { ...q, status: newStatus } : q))
      );

      const labels: Record<string, string> = {
        called: "เรียกคิวแล้ว",
        completed: "เสร็จสิ้น",
        cancelled: "ยกเลิกแล้ว",
      };
      toast({ title: labels[newStatus] || "อัปเดตแล้ว" });
    } catch (err: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const activeQueues = queues.filter((q) => q.status === "waiting" || q.status === "called");
  const displayQueues = filter === "active" ? activeQueues : queues;

  const waitingCount = queues.filter((q) => q.status === "waiting").length;
  const calledCount = queues.filter((q) => q.status === "called").length;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 glass-effect glass-border">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
              <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-medium tracking-tight text-foreground">
                {t("queueMgr.title", language)}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                {storeName}
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={fetchQueues}
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center"
            >
              <RefreshCw size={16} className="text-muted-foreground" />
            </motion.button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 pt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30 p-4 text-center">
            <motion.span
              key={waitingCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-3xl font-black text-amber-600 dark:text-amber-400"
            >
              {waitingCount}
            </motion.span>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
              {t("queueMgr.waiting", language)}
            </p>
          </div>
          <div className="rounded-2xl bg-score-emerald/10 border border-score-emerald/20 p-4 text-center">
            <motion.span
              key={calledCount}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-3xl font-black text-score-emerald"
            >
              {calledCount}
            </motion.span>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
              {t("queueMgr.called", language)}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-4 pt-4 flex gap-2">
          {(["active", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {f === "active" ? t("queueMgr.filterActive", language) : t("queueMgr.filterAll", language)}
            </button>
          ))}
        </div>

        {/* Queue List */}
        <div className="px-4 pt-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">กำลังโหลด...</span>
            </div>
          ) : displayQueues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                <Users size={24} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">{t("queueMgr.empty", language)}</p>
            </div>
          ) : (
            <AnimatePresence>
              {displayQueues.map((q, i) => {
                const cfg = statusConfig[q.status] || statusConfig.waiting;
                const isActive = q.status === "waiting" || q.status === "called";

                return (
                  <motion.div
                    key={q.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-2xl border border-border/50 bg-card overflow-hidden ${
                      q.status === "called" ? "ring-2 ring-score-emerald/40" : ""
                    }`}
                  >
                    <div className="px-4 py-3 flex items-center gap-3">
                      {/* Queue number */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                        <span className={`text-lg font-black ${cfg.color}`}>
                          #{q.queue_number}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {q.profile?.display_name || t("queueMgr.guest", language)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            <Users size={10} className="inline mr-0.5" />
                            {q.party_size} {t("queue.persons", language)}
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(q.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      {isActive && (
                        <div className="flex items-center gap-1.5">
                          {q.status === "waiting" && (
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => updateStatus(q.id, "called")}
                              disabled={actionLoading === q.id}
                              className="w-9 h-9 rounded-xl bg-score-emerald flex items-center justify-center shadow-md disabled:opacity-50"
                              title="เรียกคิว"
                            >
                              {actionLoading === q.id ? (
                                <Loader2 size={14} className="animate-spin text-primary-foreground" />
                              ) : (
                                <PhoneCall size={14} className="text-primary-foreground" />
                              )}
                            </motion.button>
                          )}
                          {q.status === "called" && (
                            <motion.button
                              whileTap={{ scale: 0.85 }}
                              onClick={() => updateStatus(q.id, "completed")}
                              disabled={actionLoading === q.id}
                              className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md disabled:opacity-50"
                              title="เสร็จสิ้น"
                            >
                              {actionLoading === q.id ? (
                                <Loader2 size={14} className="animate-spin text-primary-foreground" />
                              ) : (
                                <CheckCircle2 size={14} className="text-primary-foreground" />
                              )}
                            </motion.button>
                          )}
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => updateStatus(q.id, "cancelled")}
                            disabled={actionLoading === q.id}
                            className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center disabled:opacity-50"
                            title="ยกเลิก"
                          >
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
      </div>
    </PageTransition>
  );
};

export default QueueManager;
