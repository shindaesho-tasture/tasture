import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Clock, Ticket, PartyPopper } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { t } from "@/lib/i18n";

interface DigitalTicketProps {
  open: boolean;
  onClose: () => void;
  queueNumber: number;
  status: string;
  partySize: number;
  waitingAhead: number;
  onCancel: () => void;
}

const DigitalTicket = ({
  open,
  onClose,
  queueNumber,
  status,
  partySize,
  waitingAhead,
  onCancel,
}: DigitalTicketProps) => {
  const { language } = useLanguage();
  const isCalled = status === "called";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-foreground/50 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-card rounded-3xl overflow-hidden shadow-2xl"
          >
            {/* Ticket Top */}
            <div
              className={`relative px-6 pt-8 pb-10 text-center ${
                isCalled
                  ? "bg-gradient-to-br from-score-emerald to-primary"
                  : "bg-gradient-to-br from-primary to-accent"
              }`}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-background/20 flex items-center justify-center"
              >
                <X size={16} className="text-primary-foreground" />
              </button>

              {isCalled ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <PartyPopper size={40} className="text-primary-foreground mx-auto mb-2" />
                </motion.div>
              ) : (
                <Ticket size={32} className="text-primary-foreground/70 mx-auto mb-2" />
              )}

              <p className="text-primary-foreground/80 text-xs font-medium uppercase tracking-widest mb-1">
                {isCalled ? t("queue.yourTurnTitle", language) : t("queue.ticketLabel", language)}
              </p>

              <motion.span
                key={queueNumber}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl font-black text-primary-foreground"
              >
                #{queueNumber}
              </motion.span>
            </div>

            {/* Dashed separator */}
            <div className="relative h-0">
              <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-background" />
              <div className="absolute -top-4 -right-4 w-8 h-8 rounded-full bg-background" />
              <div className="border-t-2 border-dashed border-border mx-6" />
            </div>

            {/* Ticket details */}
            <div className="px-6 pt-6 pb-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users size={14} />
                  <span className="text-xs">{t("queue.partySize", language)}</span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {partySize} {t("queue.persons", language)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock size={14} />
                  <span className="text-xs">{t("queue.ahead", language)}</span>
                </div>
                <motion.span
                  key={waitingAhead}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className="text-sm font-bold text-foreground"
                >
                  {waitingAhead} {t("queue.groups", language)}
                </motion.span>
              </div>

              {/* Status badge */}
              <div className="flex justify-center pt-2">
                <motion.span
                  animate={isCalled ? { scale: [1, 1.05, 1] } : {}}
                  transition={isCalled ? { repeat: Infinity, duration: 1.5 } : {}}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                    isCalled
                      ? "bg-score-emerald text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isCalled ? t("queue.goNow", language) : t("queue.pleaseWait", language)}
                </motion.span>
              </div>
            </div>

            {/* Cancel */}
            <div className="px-6 pb-6">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onCancel}
                className="w-full py-2.5 rounded-xl border border-destructive/30 text-destructive text-xs font-medium"
              >
                {t("queue.cancelTicket", language)}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default DigitalTicket;
