import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Users, ListChecks, Divide, Minus, Plus, Check } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { OrderItem } from "@/lib/order-context";
import { cn } from "@/lib/utils";

type SplitMode = "by-item" | "equal";

interface SplitBillSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: OrderItem[];
  totalPrice: number;
}

const SplitBillSheet = ({ open, onOpenChange, items, totalPrice }: SplitBillSheetProps) => {
  const { language } = useLanguage();
  const [mode, setMode] = useState<SplitMode | null>(null);

  // Equal split state
  const [numPeople, setNumPeople] = useState(2);
  const perPerson = useMemo(() => Math.ceil(totalPrice / numPeople), [totalPrice, numPeople]);

  // By-item split state: map of person index → set of menuItemIds
  const [personCount, setPersonCount] = useState(2);
  const [assignments, setAssignments] = useState<Map<number, Set<string>>>(new Map());
  const [activePerson, setActivePerson] = useState(0);

  const toggleItem = (menuItemId: string) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      const personSet = new Set(next.get(activePerson) || []);
      if (personSet.has(menuItemId)) {
        personSet.delete(menuItemId);
      } else {
        personSet.add(menuItemId);
      }
      next.set(activePerson, personSet);
      return next;
    });
  };

  const getPersonTotal = (personIndex: number) => {
    const ids = assignments.get(personIndex);
    if (!ids || ids.size === 0) return 0;
    return items
      .filter((i) => ids.has(i.menuItemId))
      .reduce((s, i) => s + i.price * i.quantity, 0);
  };

  const personTotals = useMemo(() => {
    return Array.from({ length: personCount }, (_, i) => getPersonTotal(i));
  }, [assignments, personCount, items]);

  const assignedTotal = personTotals.reduce((s, v) => s + v, 0);

  const personColors = ["bg-blue-500", "bg-pink-500", "bg-amber-500", "bg-purple-500", "bg-teal-500", "bg-orange-500"];

  const resetState = () => {
    setMode(null);
    setNumPeople(2);
    setPersonCount(2);
    setAssignments(new Map());
    setActivePerson(0);
  };

  const handleClose = (o: boolean) => {
    if (!o) resetState();
    onOpenChange(o);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto pb-8">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center text-base font-bold">
            {language === "th" ? "💸 แยกบิล" : "💸 Split Bill"}
          </SheetTitle>
        </SheetHeader>

        {/* Total */}
        <div className="text-center mb-4">
          <p className="text-xs text-muted-foreground">{language === "th" ? "ยอดรวม" : "Total"}</p>
          <p className="text-2xl font-bold text-foreground">฿{totalPrice.toLocaleString()}</p>
        </div>

        {/* Mode selector */}
        {!mode && (
          <div className="grid grid-cols-2 gap-3 px-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setMode("by-item")}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border-2 border-border/50 hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <ListChecks size={24} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">
                  {language === "th" ? "แยกตามรายการ" : "Split by Item"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {language === "th" ? "เลือกเมนูที่แต่ละคนสั่ง" : "Pick items per person"}
                </p>
              </div>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setMode("equal")}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border-2 border-border/50 hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-score-emerald/10 flex items-center justify-center">
                <Divide size={24} className="text-score-emerald" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">
                  {language === "th" ? "หารเท่าๆ กัน" : "Split Equally"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {language === "th" ? "หารตามจำนวนคน" : "Divide by people"}
                </p>
              </div>
            </motion.button>
          </div>
        )}

        {/* Equal split mode */}
        <AnimatePresence mode="wait">
          {mode === "equal" && (
            <motion.div
              key="equal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5 px-2"
            >
              <button onClick={() => setMode(null)} className="text-xs text-primary font-medium">
                ← {language === "th" ? "เลือกวิธีอื่น" : "Choose another method"}
              </button>

              <div className="flex items-center justify-center gap-5">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setNumPeople(Math.max(2, numPeople - 1))}
                  className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"
                >
                  <Minus size={16} className="text-foreground" />
                </motion.button>
                <div className="text-center">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-muted-foreground" />
                    <span className="text-3xl font-bold text-foreground">{numPeople}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{language === "th" ? "คน" : "people"}</p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setNumPeople(Math.min(20, numPeople + 1))}
                  className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"
                >
                  <Plus size={16} className="text-foreground" />
                </motion.button>
              </div>

              <div className="rounded-2xl bg-score-emerald/10 border border-score-emerald/30 p-5 text-center">
                <p className="text-xs text-muted-foreground">{language === "th" ? "คนละ" : "Per person"}</p>
                <p className="text-3xl font-bold text-score-emerald mt-1">฿{perPerson.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {language === "th"
                    ? `฿${totalPrice.toLocaleString()} ÷ ${numPeople} คน`
                    : `฿${totalPrice.toLocaleString()} ÷ ${numPeople} people`}
                </p>
              </div>
            </motion.div>
          )}

          {/* By-item split mode */}
          {mode === "by-item" && (
            <motion.div
              key="by-item"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 px-2"
            >
              <button onClick={() => setMode(null)} className="text-xs text-primary font-medium">
                ← {language === "th" ? "เลือกวิธีอื่น" : "Choose another method"}
              </button>

              {/* Person count */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  {language === "th" ? "จำนวนคน" : "People"}
                </span>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => {
                      const next = Math.max(2, personCount - 1);
                      setPersonCount(next);
                      if (activePerson >= next) setActivePerson(next - 1);
                    }}
                    className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center"
                  >
                    <Minus size={12} className="text-foreground" />
                  </motion.button>
                  <span className="text-sm font-bold w-5 text-center">{personCount}</span>
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setPersonCount(Math.min(6, personCount + 1))}
                    className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center"
                  >
                    <Plus size={12} className="text-foreground" />
                  </motion.button>
                </div>
              </div>

              {/* Person tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Array.from({ length: personCount }, (_, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setActivePerson(i)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all border-2",
                      activePerson === i
                        ? `${personColors[i % personColors.length]} text-white border-transparent shadow-md`
                        : "bg-secondary text-muted-foreground border-border/50"
                    )}
                  >
                    <span>👤</span>
                    <span>{language === "th" ? `คนที่ ${i + 1}` : `Person ${i + 1}`}</span>
                    {personTotals[i] > 0 && (
                      <span className="text-[9px] opacity-80">฿{personTotals[i].toLocaleString()}</span>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Item list for selection */}
              <div className="space-y-1.5">
                {items.map((item) => {
                  const activePersonItems = assignments.get(activePerson);
                  const isSelected = activePersonItems?.has(item.menuItemId) || false;
                  // Check if assigned to someone else
                  const assignedTo = Array.from({ length: personCount }, (_, i) => i).find(
                    (i) => i !== activePerson && assignments.get(i)?.has(item.menuItemId)
                  );

                  return (
                    <motion.button
                      key={item.menuItemId}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => toggleItem(item.menuItemId)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border-2",
                        isSelected
                          ? `${personColors[activePerson % personColors.length]}/10 border-current`
                          : assignedTo !== undefined
                          ? "bg-secondary/50 border-border/30 opacity-50"
                          : "bg-card border-border/50"
                      )}
                      style={isSelected ? { borderColor: `var(--${personColors[activePerson % personColors.length]})` } : undefined}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center shrink-0 border",
                        isSelected
                          ? `${personColors[activePerson % personColors.length]} border-transparent`
                          : "bg-secondary border-border/50"
                      )}>
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          ×{item.quantity} · ฿{(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                      {assignedTo !== undefined && (
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-full text-white shrink-0",
                          personColors[assignedTo % personColors.length]
                        )}>
                          {language === "th" ? `คน ${assignedTo + 1}` : `P${assignedTo + 1}`}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Summary per person */}
              <div className="rounded-2xl bg-card border border-border/50 p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  {language === "th" ? "สรุปแต่ละคน" : "Per Person Summary"}
                </p>
                {Array.from({ length: personCount }, (_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", personColors[i % personColors.length])} />
                      <span className="text-xs text-foreground font-medium">
                        {language === "th" ? `คนที่ ${i + 1}` : `Person ${i + 1}`}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      ฿{personTotals[i].toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t border-border/30 pt-2 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {language === "th" ? "รวมที่แบ่งแล้ว" : "Assigned total"}
                  </span>
                  <span className={cn(
                    "text-xs font-bold",
                    assignedTotal === totalPrice ? "text-score-emerald" : "text-score-amber"
                  )}>
                    ฿{assignedTotal.toLocaleString()} / ฿{totalPrice.toLocaleString()}
                  </span>
                </div>
                {assignedTotal !== totalPrice && (
                  <p className="text-[10px] text-score-amber">
                    {language === "th"
                      ? `ยังเหลืออีก ฿${(totalPrice - assignedTotal).toLocaleString()} ที่ยังไม่ได้แบ่ง`
                      : `฿${(totalPrice - assignedTotal).toLocaleString()} remaining unassigned`}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
};

export default SplitBillSheet;
