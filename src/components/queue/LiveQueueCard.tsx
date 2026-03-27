import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, MapPin, AlertTriangle, Ticket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGeolocation, haversineKm } from "@/hooks/use-geolocation";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import DigitalTicket from "./DigitalTicket";

interface LiveQueueCardProps {
  storeId: string;
  storeLat?: number | null;
  storeLng?: number | null;
}

const MAX_DISTANCE_KM = 5;

const LiveQueueCard = ({ storeId, storeLat, storeLng }: LiveQueueCardProps) => {
  const { language } = useLanguage();
  const { position, error: geoError } = useGeolocation();
  const { toast } = useToast();

  const [waitingCount, setWaitingCount] = useState(0);
  const [myTicket, setMyTicket] = useState<{
    id: string;
    queue_number: number;
    status: string;
    party_size: number;
  } | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [booking, setBooking] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showTicket, setShowTicket] = useState(false);

  // Distance calculation
  const distance =
    position && storeLat && storeLng
      ? haversineKm(position.lat, position.lng, storeLat, storeLng)
      : null;
  const withinRange = distance !== null && distance <= MAX_DISTANCE_KM;
  const locationReady = position !== null;

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Fetch initial queue data
  useEffect(() => {
    if (!storeId) return;
    const today = new Date().toISOString().slice(0, 10);

    const fetchQueues = async () => {
      const { data } = await supabase
        .from("queues")
        .select("id, queue_number, status, user_id, party_size")
        .eq("store_id", storeId)
        .gte("created_at", today);

      if (data) {
        setWaitingCount(data.filter((q: any) => q.status === "waiting").length);
        if (userId) {
          const mine = data.find(
            (q: any) => q.user_id === userId && (q.status === "waiting" || q.status === "called")
          );
          if (mine) setMyTicket(mine as any);
        }
      }
    };

    fetchQueues();
  }, [storeId, userId]);

  // Realtime subscription
  useEffect(() => {
    if (!storeId) return;

    const channel = supabase
      .channel(`queue-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queues", filter: `store_id=eq.${storeId}` },
        (payload) => {
          const row = payload.new as any;
          const oldRow = payload.old as any;

          if (payload.eventType === "INSERT") {
            if (row.status === "waiting") setWaitingCount((c) => c + 1);
            if (row.user_id === userId) setMyTicket(row);
          }

          if (payload.eventType === "UPDATE") {
            // If status changed from waiting
            if (oldRow?.status === "waiting" && row.status !== "waiting") {
              setWaitingCount((c) => Math.max(0, c - 1));
            }
            // Update my ticket
            if (row.user_id === userId) {
              if (row.status === "completed" || row.status === "cancelled") {
                setMyTicket(null);
              } else {
                setMyTicket(row);
              }
              // Haptic + toast when called
              if (row.status === "called" && oldRow?.status === "waiting") {
                if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
                toast({
                  title: t("queue.calledTitle", language),
                  description: t("queue.calledDesc", language),
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, userId, language]);

  const handleBook = async () => {
    if (!userId || !storeId || booking) return;
    if (navigator.vibrate) navigator.vibrate(8);
    setBooking(true);

    try {
      // Get next queue number
      const { data: nextNum } = await supabase.rpc("next_queue_number", {
        p_store_id: storeId,
      });

      const { data, error } = await supabase
        .from("queues")
        .insert({
          store_id: storeId,
          user_id: userId,
          queue_number: nextNum || 1,
          party_size: partySize,
          status: "waiting",
        })
        .select("id, queue_number, status, party_size")
        .single();

      if (error) throw error;
      if (data) {
        setMyTicket(data as any);
        setShowTicket(true);
        toast({
          title: t("queue.bookedTitle", language),
          description: t("queue.bookedDesc", language, { number: data.queue_number }),
        });
      }
    } catch (err: any) {
      toast({ title: t("queue.errorTitle", language), description: err.message, variant: "destructive" });
    } finally {
      setBooking(false);
    }
  };

  const handleCancel = async () => {
    if (!myTicket) return;
    if (navigator.vibrate) navigator.vibrate(8);

    await supabase
      .from("queues")
      .update({ status: "cancelled" as any })
      .eq("id", myTicket.id);

    setMyTicket(null);
    setShowTicket(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-4 mt-4 rounded-2xl border border-border/40 bg-card overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-accent/10 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Users size={16} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">{t("queue.title", language)}</h3>
                <p className="text-[10px] text-muted-foreground">{t("queue.subtitle", language)}</p>
              </div>
            </div>
            <div className="text-right">
              <motion.span
                key={waitingCount}
                initial={{ scale: 1.3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-2xl font-black text-primary"
              >
                {waitingCount}
              </motion.span>
              <p className="text-[10px] text-muted-foreground">{t("queue.waiting", language)}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Distance indicator */}
          {storeLat && storeLng && (
            <div className="flex items-center gap-2 text-xs">
              <MapPin size={14} className={withinRange ? "text-primary" : "text-destructive"} />
              {!locationReady ? (
                <span className="text-muted-foreground">{t("queue.locating", language)}</span>
              ) : distance !== null ? (
                <span className={withinRange ? "text-foreground" : "text-destructive"}>
                  {distance.toFixed(1)} km{" "}
                  {withinRange
                    ? `— ${t("queue.inRange", language)}`
                    : `— ${t("queue.outOfRange", language, { max: MAX_DISTANCE_KM })}`}
                </span>
              ) : null}
              {geoError && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle size={12} />
                  {t("queue.geoError", language)}
                </span>
              )}
            </div>
          )}

          {/* My ticket exists */}
          {myTicket ? (
            <div className="space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowTicket(true)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 border border-primary/20"
              >
                <div className="flex items-center gap-2">
                  <Ticket size={18} className="text-primary" />
                  <span className="text-sm font-bold text-foreground">
                    #{myTicket.queue_number}
                  </span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  myTicket.status === "called"
                    ? "bg-score-emerald text-primary-foreground animate-pulse"
                    : "bg-secondary text-muted-foreground"
                }`}>
                  {myTicket.status === "called" ? t("queue.yourTurn", language) : t("queue.waitingStatus", language)}
                </span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCancel}
                className="w-full text-center text-xs text-destructive py-1"
              >
                {t("queue.cancel", language)}
              </motion.button>
            </div>
          ) : userId ? (
            <div className="space-y-3">
              {/* Party size selector */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t("queue.partySize", language)}</span>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setPartySize((p) => Math.max(1, p - 1))}
                    className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-foreground text-sm font-bold"
                  >
                    -
                  </motion.button>
                  <span className="text-sm font-bold text-foreground w-6 text-center">{partySize}</span>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setPartySize((p) => Math.min(20, p + 1))}
                    className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-foreground text-sm font-bold"
                  >
                    +
                  </motion.button>
                </div>
              </div>

              {/* Book button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleBook}
                disabled={booking || (storeLat != null && !withinRange) || !locationReady}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {booking ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Ticket size={16} />
                )}
                {t("queue.bookBtn", language)}
              </motion.button>

              {storeLat && !withinRange && locationReady && (
                <p className="text-[10px] text-destructive text-center flex items-center justify-center gap-1">
                  <AlertTriangle size={10} />
                  {t("queue.tooFar", language)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              {t("queue.loginRequired", language)}
            </p>
          )}
        </div>
      </motion.div>

      {/* Digital Ticket Sheet */}
      {myTicket && (
        <DigitalTicket
          open={showTicket}
          onClose={() => setShowTicket(false)}
          queueNumber={myTicket.queue_number}
          status={myTicket.status}
          partySize={myTicket.party_size}
          waitingAhead={Math.max(0, waitingCount - 1)}
          onCancel={handleCancel}
        />
      )}
    </>
  );
};

export default LiveQueueCard;
