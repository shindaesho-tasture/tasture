import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import ResultCard from "@/components/ResultCard";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { demoResults } from "@/lib/scoring";

const Results = () => {
  const navigate = useNavigate();

  return (
    <PageTransition>
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 glass-effect glass-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
          >
            <ChevronLeft size={22} strokeWidth={1.5} className="text-foreground" />
          </button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              ผลรีวิว
            </h1>
            <p className="text-xs text-muted-foreground">
              Result Cards with Scoring Logic
            </p>
          </div>
        </div>
      </div>

      {/* Result Cards */}
      <div className="px-4 pt-4 space-y-4">
        {demoResults.map((result, i) => (
          <ResultCard key={result.id} data={result} index={i} />
        ))}
      </div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mx-4 mt-6 p-4 rounded-2xl bg-surface border border-border/50"
      >
        <p className="text-[11px] font-semibold text-foreground mb-2.5">Score Legend</p>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { label: "+2 ดีเลิศ", cls: "bg-score-emerald" },
            { label: "+1 ดี", cls: "bg-score-mint" },
            { label: "0 มาตรฐาน", cls: "bg-score-slate" },
            { label: "-1 ติดขัด", cls: "bg-score-amber" },
            { label: "-2 วิกฤต", cls: "bg-score-ruby" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-1">
              <div className={`w-4 h-4 rounded-full ${item.cls}`} />
              <span className="text-[8px] text-muted-foreground text-center leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground mt-2.5 leading-relaxed">
          ความเข้มของสี = จำนวนรีวิว (n≥100 สีเต็ม, n&lt;10 สีจาง 20%)
        </p>
      </motion.div>

      <BottomNav />
    </div>
    </PageTransition>
  );
};

export default Results;
