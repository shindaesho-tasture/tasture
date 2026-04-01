import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, Receipt } from "lucide-react";
import PageTransition from "@/components/PageTransition";

const personColors = ["bg-blue-500", "bg-pink-500", "bg-amber-500", "bg-purple-500", "bg-teal-500", "bg-orange-500"];

const SplitView = () => {
  const [params] = useSearchParams();
  const mode = params.get("mode") || "equal";
  const total = Number(params.get("total") || 0);
  const numPeople = Number(params.get("n") || 2);
  const perPerson = Number(params.get("pp") || Math.ceil(total / numPeople));
  const highlight = params.get("highlight") !== null ? Number(params.get("highlight")) : null;

  const personData = useMemo(() => {
    if (mode !== "by-item") return [];
    return Array.from({ length: numPeople }, (_, i) => {
      const raw = params.get(`p${i}`) || "";
      const items = raw
        .split("|")
        .filter(Boolean)
        .map((entry) => {
          const [name, qty, price] = entry.split(":");
          return { name, qty: Number(qty) || 1, price: Number(price) || 0 };
        });
      const subtotal = items.reduce((s, item) => s + item.price * item.qty, 0);
      return { items, subtotal };
    });
  }, [params, mode, numPeople]);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-4xl">💸</span>
          <h1 className="text-lg font-bold text-foreground mt-2">แยกบิล</h1>
          <p className="text-xs text-muted-foreground mt-1">ยอดรวม ฿{total.toLocaleString()}</p>
        </div>

        {mode === "equal" ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="rounded-2xl bg-card border border-border p-6 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground mb-3">
                <Users size={18} />
                <span className="text-sm font-medium">{numPeople} คน</span>
              </div>
              <p className="text-xs text-muted-foreground">คนละ</p>
              <p className="text-4xl font-bold text-primary mt-1">฿{perPerson.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground mt-2">
                ฿{total.toLocaleString()} ÷ {numPeople} คน
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {personData.map((person, i) => {
              const isHighlighted = highlight === i;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`rounded-2xl border p-4 ${
                    isHighlighted
                      ? "bg-primary/5 border-primary/40 ring-2 ring-primary/20"
                      : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full ${personColors[i % personColors.length]}`} />
                      <span className="text-sm font-bold text-foreground">
                        คนที่ {i + 1}
                        {isHighlighted && <span className="ml-1 text-primary text-xs">(คุณ)</span>}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-foreground">฿{person.subtotal.toLocaleString()}</span>
                  </div>
                  {person.items.length > 0 ? (
                    <div className="space-y-1 pl-5">
                      {person.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-muted-foreground">
                          <span className="truncate mr-2">{item.name}</span>
                          <span className="shrink-0">×{item.qty} · ฿{(item.price * item.qty).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground pl-5">ยังไม่มีรายการ</p>
                  )}
                </motion.div>
              );
            })}

            {/* Total summary */}
            <div className="rounded-2xl bg-card border border-border p-4 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Receipt size={14} />
                  <span className="text-xs font-medium">ยอดรวมทั้งหมด</span>
                </div>
                <span className="text-sm font-bold text-foreground">฿{total.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        )}

        <p className="text-center text-[10px] text-muted-foreground mt-6">
          สร้างโดย Tasture · แยกบิลง่ายๆ
        </p>
      </div>
    </PageTransition>
  );
};

export default SplitView;
