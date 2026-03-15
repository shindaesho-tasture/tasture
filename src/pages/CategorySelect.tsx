import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { categories } from "@/lib/categories";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

const CategorySelect = () => {
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
              เลือกหมวดหมู่
            </h1>
            <p className="text-xs text-muted-foreground">
              7 Sovereign Categories
            </p>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="px-4 pt-4 grid grid-cols-2 gap-3"
      >
        {categories.map((cat) => (
          <motion.button
            key={cat.id}
            variants={item}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(`/review/${cat.id}`)}
            className="flex flex-col items-start gap-3 p-5 rounded-xl bg-surface-elevated shadow-luxury border border-border/50 text-left transition-all hover:shadow-card-elevated active:bg-secondary"
          >
            <span className="text-3xl">{cat.icon}</span>
            <div className="space-y-1">
              <span className="text-sm font-semibold text-foreground leading-tight block">
                {cat.labelTh}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase block">
                {cat.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {cat.description}
            </p>
            {/* Metric count badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-[10px] font-medium text-muted-foreground">
              {cat.metrics.length} metrics
            </span>
          </motion.button>
        ))}
      </motion.div>

      <BottomNav />
    </div>
    </PageTransition>
  );
};

export default CategorySelect;
